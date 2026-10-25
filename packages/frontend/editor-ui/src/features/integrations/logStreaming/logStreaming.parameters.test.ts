import type { INodeParameters } from 'n8n-workflow';
import {
	defaultMessageEventBusDestinationWebhookOptions,
	MessageEventBusDestinationTypeNames,
} from 'n8n-workflow';

import { getDestinationParameters, isParameterVisible } from './logStreaming.parameters';
import { toDraft } from './logStreaming.utils';
import type { MessageEventBusDestinationType } from './logStreaming.types';

const translate = (key: string) => key;

function visibleNames(values: INodeParameters) {
	return getDestinationParameters(MessageEventBusDestinationTypeNames.webhook, translate)
		.filter((parameter) => isParameterVisible(parameter, values))
		.map((parameter) => parameter.property.name);
}

describe('logStreaming.parameters', () => {
	it('shows a single text field (the URL) for a new webhook', () => {
		const { parameters } = toDraft(defaultMessageEventBusDestinationWebhookOptions);
		const visible = getDestinationParameters(
			MessageEventBusDestinationTypeNames.webhook,
			translate,
		).filter((parameter) => isParameterVisible(parameter, parameters));

		expect(visible.filter((parameter) => parameter.property.type === 'string')).toHaveLength(1);
		expect(visible[0].property.name).toBe('url');
		expect(visible.map((parameter) => parameter.property.name)).not.toContain('specifyHeaders');
	});

	it('reveals header settings step by step', () => {
		expect(visibleNames({ sendHeaders: true, specifyHeaders: '' })).toContain('specifyHeaders');
		expect(visibleNames({ sendHeaders: true, specifyHeaders: '' })).not.toContain('jsonHeaders');
		expect(visibleNames({ sendHeaders: true, specifyHeaders: 'json' })).toContain('jsonHeaders');
		expect(visibleNames({ sendHeaders: true, specifyHeaders: 'keypair' })).toContain(
			'headerParameters',
		);
		expect(visibleNames({ sendHeaders: false, specifyHeaders: 'json' })).not.toContain(
			'jsonHeaders',
		);
	});

	it('offers the header modes with their display names', () => {
		const specifyHeaders = getDestinationParameters(
			MessageEventBusDestinationTypeNames.webhook,
			translate,
		).find((parameter) => parameter.property.name === 'specifyHeaders');

		expect(specifyHeaders?.property.options).toEqual([
			{ name: 'settings.log-streaming.parameter.specify.keypair', value: 'keypair' },
			{ name: 'settings.log-streaming.parameter.specify.json', value: 'json' },
		]);
	});

	it('lists the HTTP methods by name', () => {
		const method = getDestinationParameters(
			MessageEventBusDestinationTypeNames.webhook,
			translate,
		).find((parameter) => parameter.property.name === 'method');

		expect(method?.property.options).toEqual(
			['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].map((name) => ({ name, value: name })),
		);
	});

	it.each<[MessageEventBusDestinationType, string[]]>([
		[MessageEventBusDestinationTypeNames.sentry, ['dsn', 'tracesSampleRate', 'sendPayload']],
		[
			MessageEventBusDestinationTypeNames.syslog,
			['host', 'port', 'protocol', 'facility', 'app_name'],
		],
	])('describes the %s settings', (type, names) => {
		expect(getDestinationParameters(type, translate).map((p) => p.property.name)).toEqual(names);
	});

	it('disables expressions on every setting', () => {
		const parameters = getDestinationParameters(
			MessageEventBusDestinationTypeNames.webhook,
			translate,
		);

		expect(parameters.every((parameter) => parameter.property.noDataExpression)).toBe(true);
	});
});
