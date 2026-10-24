import type { Logger } from '@n8n/backend-common';
import type { GlobalConfig } from '@n8n/config';
import type {
	CredentialsEntity,
	CredentialsRepository,
	User,
	WorkflowEntity,
	WorkflowRepository,
} from '@n8n/db';
import { mock } from 'vitest-mock-extended';

import type { CredentialsFinderService } from '@/credentials/credentials-finder.service';
import { BadRequestError } from '@/errors/response-errors/bad-request.error';
import { NotFoundError } from '@/errors/response-errors/not-found.error';
import type { OauthService } from '@/oauth/oauth.service';
import type { CacheService } from '@/services/cache/cache.service';
import type { UrlService } from '@/services/url.service';

import { SYSTEM_RESOLVER_ID } from '../../constants';
import type { DynamicCredentialEntryStorage } from '../../credential-resolvers/storage/dynamic-credential-entry-storage';
import type { DynamicCredentialUserEntryStorage } from '../../credential-resolvers/storage/dynamic-credential-user-entry-storage';
import type { CredentialResolverService } from '../credential-resolver.service';
import { DynamicCredentialAuthorizationService } from '../dynamic-credential-authorization.service';

const EXTERNAL = { kind: 'external' as const, authorizationHeader: 'Bearer ext-token' };
const user = mock<User>({ id: 'user-1' });
const USER = { kind: 'user' as const, user, cookieToken: 'cookie-jwt' };

// A plain object, not mock(): a deep mock answers `resolverId` with a function, not null.
const credential = {
	id: 'cred-1',
	name: 'Calendar',
	type: 'oAuth2Api',
	isResolvable: true,
	resolverId: null,
} as unknown as CredentialsEntity;

const setup = () => {
	const cache = new Map<string, unknown>();
	const cacheService = mock<CacheService>();
	cacheService.set.mockImplementation(async (key, value) => {
		cache.set(key, value);
	});
	cacheService.get.mockImplementation(async (key) => cache.get(key) as never);
	cacheService.delete.mockImplementation(async (key) => {
		cache.delete(key);
	});

	const deps = {
		globalConfig: mock<GlobalConfig>({ endpoints: { rest: 'rest' } }),
		urlService: mock<UrlService>(),
		oauthService: mock<OauthService>(),
		credentialsFinderService: mock<CredentialsFinderService>(),
		credentialsRepository: mock<CredentialsRepository>(),
		workflowRepository: mock<WorkflowRepository>(),
		resolverService: mock<CredentialResolverService>(),
		userEntryStorage: mock<DynamicCredentialUserEntryStorage>(),
		entryStorage: mock<DynamicCredentialEntryStorage>(),
	};
	deps.urlService.getInstanceBaseUrl.mockReturnValue('https://n8n.example.com');
	deps.credentialsRepository.findOneBy.mockResolvedValue(credential);
	deps.credentialsFinderService.findCredentialForUser.mockResolvedValue(credential);
	deps.resolverService.resolveExternalSubject.mockResolvedValue('sub-ext');
	deps.oauthService.generateAOauth2AuthUri.mockResolvedValue('https://idp.example.com/auth?x=1');

	const service = new DynamicCredentialAuthorizationService(
		mock<Logger>(),
		deps.globalConfig,
		deps.urlService,
		cacheService,
		deps.oauthService,
		deps.credentialsFinderService,
		deps.credentialsRepository,
		deps.workflowRepository,
		deps.resolverService,
		deps.userEntryStorage,
		deps.entryStorage,
	);
	return { service, ...deps };
};

const workflowUsing = (resolverId?: string) =>
	({
		id: 'wf-1',
		nodes: [{ credentials: { oAuth2Api: { id: 'cred-1', name: 'Calendar' } } }],
		settings: resolverId ? { credentialResolverId: resolverId } : {},
	}) as unknown as WorkflowEntity;

describe('DynamicCredentialAuthorizationService', () => {
	describe('getExecutionStatus', () => {
		it('reports a missing external credential with an authorize URL from the configured base', async () => {
			const { service, workflowRepository, credentialsRepository, entryStorage } = setup();
			workflowRepository.findById.mockResolvedValue(workflowUsing('resolver-1'));
			credentialsRepository.getManyByIds.mockResolvedValue([credential]);
			entryStorage.getCredentialData.mockResolvedValue(null);

			const status = await service.getExecutionStatus('wf-1', EXTERNAL);

			expect(status.readyToExecute).toBe(false);
			expect(status.credentials).toEqual([
				expect.objectContaining({
					credentialId: 'cred-1',
					credentialStatus: 'missing',
					authorizationUrl:
						'https://n8n.example.com/rest/credentials/cred-1/authorize?resolverId=resolver-1',
				}),
			]);
			// Looked up under the verified subject, never the raw token.
			expect(entryStorage.getCredentialData).toHaveBeenCalledWith(
				'cred-1',
				'sub-ext',
				'resolver-1',
				{},
			);
		});

		it('is ready once every credential is configured for the caller', async () => {
			const { service, workflowRepository, credentialsRepository, userEntryStorage } = setup();
			workflowRepository.findById.mockResolvedValue(workflowUsing());
			credentialsRepository.getManyByIds.mockResolvedValue([credential]);
			userEntryStorage.getCredentialData.mockResolvedValue('encrypted');

			const status = await service.getExecutionStatus('wf-1', USER);

			expect(status.readyToExecute).toBe(true);
			expect(status.credentials?.[0]).toMatchObject({
				credentialStatus: 'configured',
				revokeUrl: expect.stringContaining('/rest/credentials/cred-1/revoke?resolverId=system-n8n'),
			});
		});

		it('reports resolver_missing when the identity kind does not fit the resolver', async () => {
			const { service, workflowRepository, credentialsRepository } = setup();
			workflowRepository.findById.mockResolvedValue(workflowUsing());
			credentialsRepository.getManyByIds.mockResolvedValue([credential]);

			const status = await service.getExecutionStatus('wf-1', EXTERNAL);

			expect(status.credentials?.[0].credentialStatus).toBe('resolver_missing');
		});

		it('404s for an unknown workflow', async () => {
			const { service, workflowRepository } = setup();
			workflowRepository.findById.mockResolvedValue(null);

			await expect(service.getExecutionStatus('nope', USER)).rejects.toThrow(NotFoundError);
		});
	});

	describe('startAuthorization', () => {
		it('starts an external flow only after verifying the caller, without a userId in the state', async () => {
			const { service, resolverService, oauthService } = setup();

			await expect(service.startAuthorization('cred-1', 'resolver-1', EXTERNAL)).resolves.toBe(
				'https://idp.example.com/auth?x=1',
			);
			expect(resolverService.resolveExternalSubject).toHaveBeenCalledWith(
				'resolver-1',
				'Bearer ext-token',
				'cred-1',
			);
			const [, csrf] = oauthService.generateAOauth2AuthUri.mock.calls[0];
			expect(csrf).toMatchObject({
				origin: 'dynamic-credential',
				credentialResolverId: 'resolver-1',
				authorizationHeader: 'Bearer ext-token',
			});
			expect(csrf).not.toHaveProperty('userId');
		});

		it('refuses an external caller on the n8n resolver and a session user on another', async () => {
			const { service } = setup();

			await expect(
				service.startAuthorization('cred-1', SYSTEM_RESOLVER_ID, EXTERNAL),
			).rejects.toThrow(BadRequestError);
			await expect(service.startAuthorization('cred-1', 'resolver-1', USER)).rejects.toThrow(
				BadRequestError,
			);
		});

		it('404s for a credential that is not end-user (resolvable)', async () => {
			const { service, credentialsRepository } = setup();
			credentialsRepository.findOneBy.mockResolvedValue(
				mock<CredentialsEntity>({ id: 'cred-1', isResolvable: false }),
			);

			await expect(service.startAuthorization('cred-1', 'resolver-1', EXTERNAL)).rejects.toThrow(
				NotFoundError,
			);
		});
	});

	describe('authorize links', () => {
		const link = {
			credentialId: 'cred-1',
			resolverId: 'resolver-1',
			authorizationHeader: 'Bearer ext-token',
			source: 'external',
		};

		it('mints a link without the Bearer token in it and starts the flow once', async () => {
			const { service } = setup();

			const url = await service.issueAuthorizeLink(link);
			expect(url).toMatch(
				/^https:\/\/n8n\.example\.com\/rest\/credentials\/cred-1\/authorize\?token=/,
			);
			expect(url).not.toContain('ext-token');

			const token = new URL(url).searchParams.get('token')!;
			await expect(service.consumeAuthorizeLink('cred-1', token)).resolves.toBe(
				'https://idp.example.com/auth?x=1',
			);
			await expect(service.consumeAuthorizeLink('cred-1', token)).rejects.toThrow(NotFoundError);
		});

		it('refuses a link presented for a different credential', async () => {
			const { service } = setup();
			const token = new URL(await service.issueAuthorizeLink(link)).searchParams.get('token')!;

			await expect(service.consumeAuthorizeLink('cred-2', token)).rejects.toThrow(NotFoundError);
		});
	});

	describe('revoke', () => {
		it("removes only the external caller's own entry", async () => {
			const { service, entryStorage, userEntryStorage } = setup();

			await service.revoke('cred-1', 'resolver-1', EXTERNAL);

			expect(entryStorage.deleteCredentialData).toHaveBeenCalledWith(
				'cred-1',
				'sub-ext',
				'resolver-1',
				{},
			);
			expect(userEntryStorage.deleteCredentialData).not.toHaveBeenCalled();
		});

		it("removes only the session user's own entry", async () => {
			const { service, userEntryStorage } = setup();

			await service.revoke('cred-1', SYSTEM_RESOLVER_ID, USER);

			expect(userEntryStorage.deleteCredentialData).toHaveBeenCalledWith(
				'cred-1',
				'user-1',
				SYSTEM_RESOLVER_ID,
				{},
			);
		});
	});
});
