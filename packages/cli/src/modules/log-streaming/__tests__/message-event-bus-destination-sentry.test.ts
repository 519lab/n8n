import { Logger } from '@n8n/backend-common';
import type { HttpRequestClient, OutboundHttp } from '@n8n/backend-network';
import { mockInstance } from '@n8n/backend-test-utils';
import type { MessageEventBusDestinationSentryOptions } from 'n8n-workflow';
import { MessageEventBusDestinationTypeNames } from 'n8n-workflow';
import { mock } from 'vitest-mock-extended';

import { EventMessageGeneric } from '@/eventbus/event-message-classes/event-message-generic';
import type { MessageEventBus } from '@/eventbus/message-event-bus/message-event-bus';

import { MessageEventBusDestinationSentry } from '../destinations/message-event-bus-destination-sentry';

const logger = mockInstance(Logger);

const eventBus = mock<MessageEventBus>();
const httpClient = mock<HttpRequestClient>();
const outboundHttp = mock<OutboundHttp>();
outboundHttp.requests.mockReturnValue(httpClient);

const createDestination = (dsn: string) => {
	const options: MessageEventBusDestinationSentryOptions = {
		__type: MessageEventBusDestinationTypeNames.sentry,
		id: 'sentry-1',
		label: 'Sentry under test',
		dsn,
	};
	return new MessageEventBusDestinationSentry(eventBus, outboundHttp, options);
};

const message = new EventMessageGeneric({ eventName: 'n8n.workflow.success' });

describe('MessageEventBusDestinationSentry', () => {
	beforeEach(() => {
		httpClient.request.mockReset();
		logger.warn.mockReset();
	});

	it('counts an event as sent once it is dispatched to the envelope endpoint', async () => {
		httpClient.request.mockResolvedValue({ statusCode: 200, body: {}, headers: {} });

		await expect(
			createDestination('https://key@sentry.example.com/42').receiveFromEventBus(message),
		).resolves.toBe(true);
		expect(httpClient.request).toHaveBeenCalledWith(
			expect.objectContaining({
				url: 'https://sentry.example.com/api/42/envelope/',
				qs: { sentry_key: 'key', sentry_version: '7' },
			}),
		);
	});

	it('does not fail the send when Sentry rejects the event, but logs it', async () => {
		httpClient.request.mockResolvedValue({ statusCode: 403, body: {}, headers: {} });

		await expect(
			createDestination('https://key@sentry.example.com/42').receiveFromEventBus(message),
		).resolves.toBe(true);
		await vi.waitFor(() =>
			expect(logger.warn).toHaveBeenCalledWith(
				'Sentry rejected a log-streaming event',
				expect.objectContaining({ statusCode: 403 }),
			),
		);
	});

	it('logs an unreachable Sentry host without failing the send', async () => {
		httpClient.request.mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));

		await expect(
			createDestination('https://key@sentry.example.com/42').receiveFromEventBus(message),
		).resolves.toBe(true);
		await vi.waitFor(() =>
			expect(logger.warn).toHaveBeenCalledWith(
				'Could not deliver a log-streaming event to Sentry',
				expect.objectContaining({ error: 'getaddrinfo ENOTFOUND' }),
			),
		);
	});

	it('fails the send when the DSN is malformed', async () => {
		await expect(createDestination('not a dsn').receiveFromEventBus(message)).resolves.toBe(false);
		expect(httpClient.request).not.toHaveBeenCalled();
	});
});
