import { Logger } from '@n8n/backend-common';
import { Service } from '@n8n/di';

import { CredentialResolutionError } from '../../errors/credential-resolution.error';

/** Resolver type whose subjects are identified through an OIDC UserInfo endpoint. */
export const OAUTH2_RESOLVER_TYPE = 'credential-resolver.oauth2-1.0';

/** `config.validation` value selecting UserInfo-based identification. */
export const OAUTH2_USERINFO_VALIDATION = 'oauth2-userinfo';

const REQUEST_TIMEOUT_MS = 10_000;
const DISCOVERY_TTL_MS = 10 * 60_000;

const NOT_IDENTIFIED = 'The external user could not be identified by the credential resolver';

type DiscoveryEntry = { userinfoEndpoint: string; expiresAt: number };

/**
 * Identifies an external user for a `credential-resolver.oauth2-1.0` resolver.
 *
 * The caller's Bearer access token is presented to the provider's UserInfo
 * endpoint (OIDC Core §5.3); the endpoint is read from the discovery document at
 * the resolver's `metadataUri` (OIDC Discovery). The subject is the returned
 * `sub` claim — stable for the user, unlike the access token itself.
 */
@Service()
export class OAuth2UserinfoIdentifier {
	private readonly discovery = new Map<string, DiscoveryEntry>();

	constructor(private readonly logger: Logger) {}

	/** Whether this identifier can verify subjects for a resolver of `type` with `config`. */
	static supports(type: string, config: Record<string, unknown>): boolean {
		return (
			type === OAUTH2_RESOLVER_TYPE &&
			config.validation === OAUTH2_USERINFO_VALIDATION &&
			typeof config.metadataUri === 'string'
		);
	}

	async resolve(identity: string, config: Record<string, unknown>): Promise<string> {
		const token = bearerToken(identity);
		if (!token || typeof config.metadataUri !== 'string') {
			throw new CredentialResolutionError(NOT_IDENTIFIED);
		}

		const userinfoEndpoint = await this.userinfoEndpoint(config.metadataUri);
		const response = await this.fetchOrFail(userinfoEndpoint, {
			headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
		});
		if (!response.ok) {
			this.logger.debug('UserInfo rejected the external user token', {
				status: response.status,
			});
			throw new CredentialResolutionError(NOT_IDENTIFIED);
		}

		const body: unknown = await response.json().catch(() => null);
		const sub = isRecord(body) ? body.sub : undefined;
		if (typeof sub !== 'string' || sub.length === 0) {
			throw new CredentialResolutionError(NOT_IDENTIFIED);
		}
		return sub;
	}

	private async userinfoEndpoint(metadataUri: string): Promise<string> {
		const cached = this.discovery.get(metadataUri);
		if (cached && cached.expiresAt > Date.now()) return cached.userinfoEndpoint;

		const response = await this.fetchOrFail(metadataUri, {
			headers: { Accept: 'application/json' },
		});
		const document: unknown = response.ok ? await response.json().catch(() => null) : null;
		const endpoint = isRecord(document) ? document.userinfo_endpoint : undefined;
		if (typeof endpoint !== 'string') {
			this.logger.warn('OIDC discovery document has no userinfo_endpoint', { metadataUri });
			throw new CredentialResolutionError(NOT_IDENTIFIED);
		}

		this.discovery.set(metadataUri, {
			userinfoEndpoint: endpoint,
			expiresAt: Date.now() + DISCOVERY_TTL_MS,
		});
		return endpoint;
	}

	private async fetchOrFail(url: string, init: RequestInit): Promise<Response> {
		try {
			return await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
		} catch (error) {
			this.logger.warn('Could not reach the OAuth2 provider to identify an external user', {
				url,
				error,
			});
			throw new CredentialResolutionError(NOT_IDENTIFIED);
		}
	}
}

/**
 * The identity arrives as `Bearer <token>` from request headers, or as the bare
 * token once the OAuth callback has stripped the prefix.
 */
function bearerToken(identity: string): string | undefined {
	const trimmed = identity.trim();
	const match = /^Bearer\s+(\S+)$/i.exec(trimmed);
	if (match) return match[1];
	return trimmed.length > 0 && !/\s/.test(trimmed) ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
