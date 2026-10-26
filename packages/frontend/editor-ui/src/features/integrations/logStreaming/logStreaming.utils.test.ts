import {
	defaultMessageEventBusDestinationWebhookOptions,
	MessageEventBusDestinationTypeNames,
} from 'n8n-workflow';

import {
	applyParameterUpdate,
	defaultDestinationFor,
	destinationTypeLabelKey,
	isDestinationType,
	isDraftEqual,
	toDestination,
	toDraft,
} from './logStreaming.utils';

describe('logStreaming.utils', () => {
	describe('isDestinationType', () => {
		it('accepts the three creatable destination types only', () => {
			expect(isDestinationType(MessageEventBusDestinationTypeNames.webhook)).toBe(true);
			expect(isDestinationType(MessageEventBusDestinationTypeNames.sentry)).toBe(true);
			expect(isDestinationType(MessageEventBusDestinationTypeNames.syslog)).toBe(true);
			expect(isDestinationType(MessageEventBusDestinationTypeNames.abstract)).toBe(false);
			expect(isDestinationType(undefined)).toBe(false);
		});
	});

	describe('destinationTypeLabelKey', () => {
		it('maps known types to their label and anything else to the generic label', () => {
			expect(destinationTypeLabelKey(MessageEventBusDestinationTypeNames.sentry)).toBe(
				'settings.log-streaming.$$MessageEventBusDestinationSentry',
			);
			expect(destinationTypeLabelKey('unknown')).toBe(
				'settings.log-streaming.$$AbstractMessageEventBusDestination',
			);
		});
	});

	describe('defaultDestinationFor', () => {
		it('returns a fresh copy of the type defaults', () => {
			const first = defaultDestinationFor(MessageEventBusDestinationTypeNames.webhook);
			first.label = 'changed';

			expect(first.__type).toBe(MessageEventBusDestinationTypeNames.webhook);
			expect(defaultMessageEventBusDestinationWebhookOptions.label).toBe('Webhook Endpoint');
		});
	});

	describe('toDraft / toDestination', () => {
		it('splits shared fields from type-specific settings and merges them back', () => {
			const destination = {
				__type: MessageEventBusDestinationTypeNames.syslog,
				id: 'abc',
				label: 'Syslog',
				enabled: true,
				subscribedEvents: ['n8n.workflow'],
				host: 'localhost',
				port: 514,
			};

			const draft = toDraft(destination);

			expect(draft.shared).toMatchObject({ id: 'abc', label: 'Syslog', enabled: true });
			expect(draft.parameters).toEqual({ host: 'localhost', port: 514 });
			expect(toDestination(draft)).toEqual(destination);
		});

		it('drops empty settings so the backend sees them as absent', () => {
			const draft = toDraft({ __type: MessageEventBusDestinationTypeNames.sentry, label: 'S' });
			draft.parameters.tracesSampleRate = null;
			draft.parameters.dsn = 'https://key@example.com/1';

			expect(toDestination(draft)).toEqual({
				__type: MessageEventBusDestinationTypeNames.sentry,
				label: 'S',
				subscribedEvents: [],
				dsn: 'https://key@example.com/1',
			});
		});

		it('does not share state with the source destination', () => {
			const destination = { label: 'A', subscribedEvents: ['n8n.audit'] };
			const draft = toDraft(destination);
			draft.shared.subscribedEvents?.push('n8n.workflow');

			expect(destination.subscribedEvents).toEqual(['n8n.audit']);
		});
	});

	describe('applyParameterUpdate', () => {
		it('sets a top-level setting without mutating the input', () => {
			const parameters = { url: 'https://' };
			const next = applyParameterUpdate(parameters, 'url', 'https://example.com');

			expect(next).toEqual({ url: 'https://example.com' });
			expect(parameters).toEqual({ url: 'https://' });
		});

		it('sets a nested fixed-collection value', () => {
			const next = applyParameterUpdate(
				{ headerParameters: { parameters: [{ name: '', value: '' }] } },
				'headerParameters.parameters[0].name',
				'X-Test',
			);

			expect(next).toEqual({ headerParameters: { parameters: [{ name: 'X-Test', value: '' }] } });
		});

		it('removes an array item when its value is cleared', () => {
			const next = applyParameterUpdate(
				{ headerParameters: { parameters: [{ name: 'a' }, { name: 'b' }] } },
				'headerParameters.parameters[0]',
				undefined,
			);

			expect(next).toEqual({ headerParameters: { parameters: [{ name: 'b' }] } });
		});

		it('removes a setting when its value is cleared', () => {
			const next = applyParameterUpdate({ jsonHeaders: '{}', url: 'x' }, 'jsonHeaders', undefined);

			expect(next).toEqual({ url: 'x' });
		});
	});

	describe('isDraftEqual', () => {
		it('compares drafts by content', () => {
			const destination = { label: 'A', url: 'https://example.com' };

			expect(isDraftEqual(toDraft(destination), toDraft(destination))).toBe(true);

			const changed = toDraft(destination);
			changed.parameters.url = 'https://other.example.com';
			expect(isDraftEqual(toDraft(destination), changed)).toBe(false);
		});
	});
});
