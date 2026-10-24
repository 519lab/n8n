import type { WorkflowExecutionStatus } from '@n8n/api-types';
import { Logger } from '@n8n/backend-common';
import { GlobalConfig } from '@n8n/config';
import {
	CredentialsRepository,
	WorkflowRepository,
	type CredentialsEntity,
	type User,
} from '@n8n/db';
import { Service } from '@n8n/di';
import { randomBytes } from 'node:crypto';

import { CredentialsFinderService } from '@/credentials/credentials-finder.service';
import { BadRequestError } from '@/errors/response-errors/bad-request.error';
import { NotFoundError } from '@/errors/response-errors/not-found.error';
import type { CreateCsrfStateData } from '@/oauth/oauth.service';
import { OauthService } from '@/oauth/oauth.service';
import { CacheService } from '@/services/cache/cache.service';
import { UrlService } from '@/services/url.service';

import { SYSTEM_RESOLVER_ID } from '../constants';
import { DynamicCredentialEntryStorage } from '../credential-resolvers/storage/dynamic-credential-entry-storage';
import { DynamicCredentialUserEntryStorage } from '../credential-resolvers/storage/dynamic-credential-user-entry-storage';
import { collectCredentialIds } from './credential-check.service';
import { CredentialResolverService } from './credential-resolver.service';

/**
 * Who a dynamic-credential request acts for: the signed-in n8n user (system
 * resolver), or an external user named by a Bearer token that a non-system
 * resolver verifies.
 */
export type CallerIdentity =
	| { kind: 'user'; user: User; cookieToken: string }
	| { kind: 'external'; authorizationHeader: string };

type CredentialStatus = NonNullable<WorkflowExecutionStatus['credentials']>[number];

/**
 * What a single-use link starts: the identity's authorization header and its
 * source travel server-side, so the flow resolves the same subject the gate saw.
 */
export type AuthorizeLink = {
	credentialId: string;
	resolverId: string;
	authorizationHeader: string;
	/** Credential-context source, e.g. `n8n-oauth` for an MCP client's n8n token. */
	source: string;
	/** Set when the identity is an n8n user (system resolver). */
	userId?: string;
};

const LINK_TTL_MS = 10 * 60_000;
const LINK_CACHE_PREFIX = 'dynamic-credentials:authorize-link:';

/**
 * The externally facing half of dynamic credentials: report which end-user
 * credentials a workflow still needs, start the OAuth authorization that
 * connects one, and revoke a connection. Storage and subject resolution stay in
 * `CredentialResolverService`; the OAuth callback that stores the tokens is the
 * existing `origin: 'dynamic-credential'` path in `OauthService`.
 */
@Service()
export class DynamicCredentialAuthorizationService {
	constructor(
		private readonly logger: Logger,
		private readonly globalConfig: GlobalConfig,
		private readonly urlService: UrlService,
		private readonly cacheService: CacheService,
		private readonly oauthService: OauthService,
		private readonly credentialsFinderService: CredentialsFinderService,
		private readonly credentialsRepository: CredentialsRepository,
		private readonly workflowRepository: WorkflowRepository,
		private readonly resolverService: CredentialResolverService,
		private readonly userEntryStorage: DynamicCredentialUserEntryStorage,
		private readonly entryStorage: DynamicCredentialEntryStorage,
	) {}

	async getExecutionStatus(
		workflowId: string,
		identity: CallerIdentity,
	): Promise<WorkflowExecutionStatus> {
		const workflow = await this.workflowRepository.findById(workflowId);
		if (!workflow) throw new NotFoundError(`Workflow "${workflowId}" could not be found.`);

		const credentialIds = collectCredentialIds(workflow.nodes ?? []);
		const resolvable =
			credentialIds.length === 0
				? []
				: (await this.credentialsRepository.getManyByIds(credentialIds)).filter(
						(credential) => credential.isResolvable,
					);

		const credentials: CredentialStatus[] = [];
		for (const credential of resolvable) {
			const resolverId =
				credential.resolverId ?? workflow.settings?.credentialResolverId ?? SYSTEM_RESOLVER_ID;
			credentials.push(await this.statusFor(credential, resolverId, identity));
		}

		return {
			workflowId,
			readyToExecute: credentials.every((c) => c.credentialStatus === 'configured'),
			credentials,
		};
	}

	/** Returns the OAuth provider URL that connects `credentialId` for `identity`. */
	async startAuthorization(
		credentialId: string,
		resolverId: string,
		identity: CallerIdentity,
	): Promise<string> {
		const credential = await this.findAuthorizableCredential(credentialId, identity);

		let csrfData: CreateCsrfStateData;
		if (identity.kind === 'user') {
			if (resolverId !== SYSTEM_RESOLVER_ID) {
				throw new BadRequestError('Signed-in users connect through the n8n resolver');
			}
			csrfData = {
				cid: credential.id,
				origin: 'dynamic-credential',
				userId: identity.user.id,
				credentialResolverId: resolverId,
				authorizationHeader: `Bearer ${identity.cookieToken}`,
				authMetadata: { source: 'manual-execution' },
			};
		} else {
			if (resolverId === SYSTEM_RESOLVER_ID) {
				throw new BadRequestError('External users connect through a non-n8n resolver');
			}
			// Verify the caller before a flow is started on their behalf; the callback
			// verifies again when it stores the tokens.
			await this.resolverService.resolveExternalSubject(
				resolverId,
				identity.authorizationHeader,
				credential.id,
			);
			// No userId: the callback then skips its same-user check, as it does for
			// every externally initiated flow.
			csrfData = {
				cid: credential.id,
				origin: 'dynamic-credential',
				credentialResolverId: resolverId,
				authorizationHeader: identity.authorizationHeader,
				authMetadata: { source: 'external' },
			};
		}

		return await this.oauthService.generateAOauth2AuthUri(credential, csrfData);
	}

	/**
	 * Mints a single-use link that starts the authorization for an external
	 * identity without ever putting its Bearer token in a URL.
	 */
	async issueAuthorizeLink(link: AuthorizeLink): Promise<string> {
		const { credentialId } = link;
		const token = randomBytes(32).toString('base64url');
		await this.cacheService.set(`${LINK_CACHE_PREFIX}${token}`, link, LINK_TTL_MS);
		return `${this.restBaseUrl()}/credentials/${encodeURIComponent(credentialId)}/authorize?token=${token}`;
	}

	/** Consumes a link minted by `issueAuthorizeLink` and returns the provider URL. */
	async consumeAuthorizeLink(credentialId: string, token: string): Promise<string> {
		const key = `${LINK_CACHE_PREFIX}${token}`;
		const link = await this.cacheService.get<AuthorizeLink>(key);
		// Single-use: removed before the flow starts, so a replay finds nothing.
		await this.cacheService.delete(key);
		if (!link || link.credentialId !== credentialId) {
			throw new NotFoundError('This authorization link is invalid or has expired.');
		}
		const credential = await this.credentialsRepository.findOneBy({ id: link.credentialId });
		if (!credential?.isResolvable) {
			throw new NotFoundError(`Credential "${credentialId}" could not be found.`);
		}
		if (link.resolverId !== SYSTEM_RESOLVER_ID) {
			await this.resolverService.resolveExternalSubject(
				link.resolverId,
				link.authorizationHeader,
				credential.id,
			);
		}
		return await this.oauthService.generateAOauth2AuthUri(credential, {
			cid: credential.id,
			origin: 'dynamic-credential',
			credentialResolverId: link.resolverId,
			authorizationHeader: link.authorizationHeader,
			authMetadata: { source: link.source },
			...(link.userId ? { userId: link.userId } : {}),
		});
	}

	/** Removes the caller's own connection for the credential under that resolver. */
	async revoke(credentialId: string, resolverId: string, identity: CallerIdentity): Promise<void> {
		const credential = await this.findAuthorizableCredential(credentialId, identity);

		if (identity.kind === 'user') {
			await this.userEntryStorage.deleteCredentialData(
				credential.id,
				identity.user.id,
				resolverId,
				{},
			);
			return;
		}

		const subject = await this.resolverService.resolveExternalSubject(
			resolverId,
			identity.authorizationHeader,
			credential.id,
		);
		await this.entryStorage.deleteCredentialData(credential.id, subject, resolverId, {});
	}

	private async statusFor(
		credential: CredentialsEntity,
		resolverId: string,
		identity: CallerIdentity,
	): Promise<CredentialStatus> {
		const base = {
			credentialId: credential.id,
			credentialName: credential.name,
			credentialType: credential.type,
		};

		const isSystem = resolverId === SYSTEM_RESOLVER_ID;
		// Each identity kind connects through exactly one kind of resolver.
		if (isSystem !== (identity.kind === 'user')) {
			return { ...base, credentialStatus: 'resolver_missing' };
		}

		const stored =
			identity.kind === 'user'
				? await this.userEntryStorage.getCredentialData(
						credential.id,
						identity.user.id,
						resolverId,
						{},
					)
				: await this.entryStorage.getCredentialData(
						credential.id,
						await this.resolverService.resolveExternalSubject(
							resolverId,
							identity.authorizationHeader,
							credential.id,
						),
						resolverId,
						{},
					);

		const query = `resolverId=${encodeURIComponent(resolverId)}${identity.kind === 'user' ? '&authSource=cookie' : ''}`;
		const credentialUrl = `${this.restBaseUrl()}/credentials/${encodeURIComponent(credential.id)}`;

		if (stored === null) {
			return {
				...base,
				credentialStatus: 'missing',
				authorizationUrl: `${credentialUrl}/authorize?${query}`,
			};
		}
		return {
			...base,
			credentialStatus: 'configured',
			revokeUrl: `${credentialUrl}/revoke?${query}`,
		};
	}

	private async findAuthorizableCredential(
		credentialId: string,
		identity: CallerIdentity,
	): Promise<CredentialsEntity> {
		const credential =
			identity.kind === 'user'
				? await this.credentialsFinderService.findCredentialForUser(credentialId, identity.user, [
						'credential:connect',
					])
				: await this.credentialsRepository.findOneBy({ id: credentialId });

		if (!credential?.isResolvable) {
			this.logger.debug('Dynamic credential authorization refused', { credentialId });
			throw new NotFoundError(`Credential "${credentialId}" could not be found.`);
		}
		return credential;
	}

	/** Absolute REST base from configuration, never from the request's Host header. */
	private restBaseUrl(): string {
		return `${this.urlService.getInstanceBaseUrl()}/${this.globalConfig.endpoints.rest}`;
	}
}
