import { mock } from 'vitest-mock-extended';
import type { Logger } from '@n8n/backend-common';

import { CredentialResolutionError } from '../../../errors/credential-resolution.error';
import {
	OAUTH2_RESOLVER_TYPE,
	OAUTH2_USERINFO_VALIDATION,
	OAuth2UserinfoIdentifier,
} from '../oauth2-userinfo-identifier';

const METADATA_URI = 'https://idp.example.com/.well-known/openid-configuration';
const USERINFO = 'https://idp.example.com/userinfo';
const config = { metadataUri: METADATA_URI, validation: OAUTH2_USERINFO_VALIDATION };

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('OAuth2UserinfoIdentifier', () => {
	let fetchMock: ReturnType<typeof vi.fn>;
	let identifier: OAuth2UserinfoIdentifier;

	beforeEach(() => {
		fetchMock = vi.fn(async (url: string) =>
			url === METADATA_URI ? json({ userinfo_endpoint: USERINFO }) : json({ sub: 'user-123' }),
		);
		vi.stubGlobal('fetch', fetchMock);
		identifier = new OAuth2UserinfoIdentifier(mock<Logger>());
	});

	afterEach(() => vi.unstubAllGlobals());

	describe('supports', () => {
		it('accepts only the oauth2 resolver type with userinfo validation and a metadata URI', () => {
			expect(OAuth2UserinfoIdentifier.supports(OAUTH2_RESOLVER_TYPE, config)).toBe(true);
			expect(OAuth2UserinfoIdentifier.supports('n8n', config)).toBe(false);
			expect(
				OAuth2UserinfoIdentifier.supports(OAUTH2_RESOLVER_TYPE, { metadataUri: METADATA_URI }),
			).toBe(false);
			expect(
				OAuth2UserinfoIdentifier.supports(OAUTH2_RESOLVER_TYPE, {
					validation: OAUTH2_USERINFO_VALIDATION,
				}),
			).toBe(false);
		});
	});

	it('identifies the user by the UserInfo sub claim, presenting the Bearer token', async () => {
		await expect(identifier.resolve('Bearer access-token', config)).resolves.toBe('user-123');

		const userinfoCall = fetchMock.mock.calls.find(([url]) => url === USERINFO);
		expect(userinfoCall?.[1]?.headers).toMatchObject({ Authorization: 'Bearer access-token' });
	});

	it('accepts the bare token the OAuth callback passes after stripping the prefix', async () => {
		await expect(identifier.resolve('access-token', config)).resolves.toBe('user-123');
	});

	it('caches the discovery document across calls', async () => {
		await identifier.resolve('Bearer a', config);
		await identifier.resolve('Bearer b', config);

		expect(fetchMock.mock.calls.filter(([url]) => url === METADATA_URI)).toHaveLength(1);
	});

	it('refuses a token the provider rejects', async () => {
		fetchMock.mockImplementation(async (url: string) =>
			url === METADATA_URI ? json({ userinfo_endpoint: USERINFO }) : json({}, 401),
		);

		await expect(identifier.resolve('Bearer forged', config)).rejects.toThrow(
			CredentialResolutionError,
		);
	});

	it('refuses a UserInfo answer without a sub claim', async () => {
		fetchMock.mockImplementation(async (url: string) =>
			url === METADATA_URI ? json({ userinfo_endpoint: USERINFO }) : json({ email: 'a@b.c' }),
		);

		await expect(identifier.resolve('Bearer t', config)).rejects.toThrow(CredentialResolutionError);
	});

	it('refuses a discovery document without a userinfo_endpoint', async () => {
		fetchMock.mockImplementation(async () => json({ issuer: 'x' }));

		await expect(identifier.resolve('Bearer t', config)).rejects.toThrow(CredentialResolutionError);
	});

	it('refuses an empty or multi-word identity without calling the provider', async () => {
		await expect(identifier.resolve('', config)).rejects.toThrow(CredentialResolutionError);
		await expect(identifier.resolve('Basic dXNlcjpwYXNz', config)).rejects.toThrow(
			CredentialResolutionError,
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('refuses when the provider cannot be reached', async () => {
		fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

		await expect(identifier.resolve('Bearer t', config)).rejects.toThrow(CredentialResolutionError);
	});
});
