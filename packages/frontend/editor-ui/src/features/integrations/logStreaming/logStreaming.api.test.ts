import type { IRestApiContext } from '@n8n/rest-api-client';
import { makeRestApiRequest } from '@n8n/rest-api-client';
import { MessageEventBusDestinationTypeNames } from 'n8n-workflow';

import {
	deleteDestination,
	getDestinations,
	saveDestination,
	sendTestMessage,
} from './logStreaming.api';

vi.mock('@n8n/rest-api-client', () => ({
	makeRestApiRequest: vi.fn(),
}));

const requestMock = vi.mocked(makeRestApiRequest);

const context: IRestApiContext = { baseUrl: 'http://localhost:5678', pushRef: '' };

describe('logStreaming.api', () => {
	beforeEach(() => {
		requestMock.mockReset();
	});

	describe('saveDestination', () => {
		it('omits an empty id so the backend assigns one', async () => {
			requestMock.mockResolvedValueOnce({ id: 'new-id' });

			await saveDestination(context, {
				__type: MessageEventBusDestinationTypeNames.webhook,
				id: '',
				label: 'Webhook',
			});

			expect(requestMock).toHaveBeenCalledWith(context, 'POST', '/eventbus/destination', {
				__type: MessageEventBusDestinationTypeNames.webhook,
				label: 'Webhook',
			});
		});

		it('keeps the id when updating an existing destination', async () => {
			const destination = {
				__type: MessageEventBusDestinationTypeNames.sentry,
				id: 'existing-id',
				label: 'Sentry',
			};
			requestMock.mockResolvedValueOnce(destination);

			const result = await saveDestination(context, destination);

			expect(requestMock).toHaveBeenCalledWith(
				context,
				'POST',
				'/eventbus/destination',
				destination,
			);
			expect(result).toEqual(destination);
		});
	});

	it('getDestinations requests all destinations without an id', async () => {
		requestMock.mockResolvedValueOnce([]);

		await getDestinations(context);

		expect(requestMock).toHaveBeenCalledWith(context, 'GET', '/eventbus/destination', undefined);
	});

	it('deleteDestination sends the id as a query parameter', async () => {
		requestMock.mockResolvedValueOnce({ success: true });

		await deleteDestination(context, 'abc');

		expect(requestMock).toHaveBeenCalledWith(context, 'DELETE', '/eventbus/destination', {
			id: 'abc',
		});
	});

	it('sendTestMessage resolves to the backend result', async () => {
		requestMock.mockResolvedValueOnce(true);

		await expect(sendTestMessage(context, 'abc')).resolves.toBe(true);
		expect(requestMock).toHaveBeenCalledWith(context, 'GET', '/eventbus/testmessage', {
			id: 'abc',
		});
	});
});
