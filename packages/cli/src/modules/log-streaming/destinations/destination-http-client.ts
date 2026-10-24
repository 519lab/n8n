import type { HttpRequestClient, OutboundHttp } from '@n8n/backend-network';
import { SsrfProtectionService } from '@n8n/backend-network';
import { SsrfProtectionConfig } from '@n8n/config';
import { Container } from '@n8n/di';

/**
 * Destination URLs are administrator-configured, so they follow the instance-wide
 * SSRF setting like other admin-configured endpoints (SAML, OIDC) instead of
 * forcing protection on: log sinks commonly live on internal addresses.
 */
export function destinationHttpClient(outboundHttp: OutboundHttp): HttpRequestClient {
	const { enabled } = Container.get(SsrfProtectionConfig);
	return outboundHttp.requests({
		ssrf: enabled ? Container.get(SsrfProtectionService) : 'disabled',
	});
}
