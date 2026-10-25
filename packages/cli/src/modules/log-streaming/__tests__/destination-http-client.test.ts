import type { HttpRequestClient, OutboundHttp } from '@n8n/backend-network';
import { SsrfProtectionService } from '@n8n/backend-network';
import { mockInstance } from '@n8n/backend-test-utils';
import { SsrfProtectionConfig } from '@n8n/config';
import { mock } from 'vitest-mock-extended';

import { destinationHttpClient } from '../destinations/destination-http-client';

describe('destinationHttpClient', () => {
	const ssrfConfig = mockInstance(SsrfProtectionConfig);
	const ssrfService = mockInstance(SsrfProtectionService);
	const outboundHttp = mock<OutboundHttp>();
	const client = mock<HttpRequestClient>();

	beforeEach(() => {
		outboundHttp.requests.mockReset();
		outboundHttp.requests.mockReturnValue(client);
	});

	it('reaches internal sinks when instance SSRF protection is off', () => {
		ssrfConfig.enabled = false;

		expect(destinationHttpClient(outboundHttp)).toBe(client);
		expect(outboundHttp.requests).toHaveBeenCalledWith({ ssrf: 'disabled' });
	});

	it('applies SSRF protection when it is enabled for the instance', () => {
		ssrfConfig.enabled = true;

		destinationHttpClient(outboundHttp);
		expect(outboundHttp.requests).toHaveBeenCalledWith({ ssrf: ssrfService });
	});
});
