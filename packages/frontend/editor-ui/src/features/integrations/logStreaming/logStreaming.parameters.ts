import type { BaseTextKey } from '@n8n/i18n';
import type {
	INodeParameters,
	INodeProperties,
	INodePropertyOptions,
	NodeParameterValue,
} from 'n8n-workflow';
import { MessageEventBusDestinationTypeNames } from 'n8n-workflow';

import type { MessageEventBusDestinationType } from './logStreaming.types';

/**
 * Form description of one type-specific destination setting. Properties are
 * rendered with the shared parameter inputs, so they follow the
 * `INodeProperties` shape; their names and values mirror the destination
 * option schemas in `n8n-workflow` (`message-event-bus.ts`).
 */
export interface DestinationParameter {
	property: INodeProperties;
	/** Shown only while every listed setting holds one of the given values. */
	showWhen?: Record<string, NodeParameterValue[]>;
}

type Translate = (key: BaseTextKey) => string;

/** HTTP methods the webhook destination can send with. */
const WEBHOOK_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'];

function specifyOptions(t: Translate): INodePropertyOptions[] {
	return [
		{ name: t('settings.log-streaming.parameter.specify.keypair'), value: 'keypair' },
		{ name: t('settings.log-streaming.parameter.specify.json'), value: 'json' },
	];
}

function keyValueCollection(t: Translate, name: string, displayName: string): INodeProperties {
	return {
		displayName,
		name,
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: t('settings.log-streaming.parameter.addParameter'),
		default: { parameters: [] },
		options: [
			{
				name: 'parameters',
				displayName: t('settings.log-streaming.parameter.parameter'),
				values: [
					{
						displayName: t('settings.log-streaming.parameter.name'),
						name: 'name',
						type: 'string',
						noDataExpression: true,
						default: '',
					},
					{
						displayName: t('settings.log-streaming.parameter.value'),
						name: 'value',
						type: 'string',
						noDataExpression: true,
						default: '',
					},
				],
			},
		],
	};
}

function webhookParameters(t: Translate): DestinationParameter[] {
	return [
		{
			property: {
				displayName: t('settings.log-streaming.parameter.url'),
				name: 'url',
				type: 'string',
				required: true,
				placeholder: 'https://',
				default: '',
			},
		},
		{
			property: {
				displayName: t('settings.log-streaming.parameter.method'),
				name: 'method',
				type: 'options',
				options: WEBHOOK_METHODS.map((method) => ({ name: method, value: method })),
				default: 'POST',
			},
		},
		{
			property: {
				displayName: t('settings.log-streaming.parameter.sendQuery'),
				name: 'sendQuery',
				type: 'boolean',
				default: false,
			},
		},
		{
			property: {
				displayName: t('settings.log-streaming.parameter.specifyQuery'),
				name: 'specifyQuery',
				type: 'options',
				options: specifyOptions(t),
				default: 'keypair',
			},
			showWhen: { sendQuery: [true] },
		},
		{
			property: keyValueCollection(
				t,
				'queryParameters',
				t('settings.log-streaming.parameter.queryParameters'),
			),
			showWhen: { sendQuery: [true], specifyQuery: ['keypair'] },
		},
		{
			property: {
				displayName: t('settings.log-streaming.parameter.jsonQuery'),
				name: 'jsonQuery',
				type: 'json',
				default: '',
			},
			showWhen: { sendQuery: [true], specifyQuery: ['json'] },
		},
		{
			property: {
				displayName: t('settings.log-streaming.parameter.sendHeaders'),
				name: 'sendHeaders',
				type: 'boolean',
				default: false,
			},
		},
		{
			property: {
				displayName: t('settings.log-streaming.parameter.specifyHeaders'),
				name: 'specifyHeaders',
				type: 'options',
				options: specifyOptions(t),
				default: 'keypair',
			},
			showWhen: { sendHeaders: [true] },
		},
		{
			property: keyValueCollection(
				t,
				'headerParameters',
				t('settings.log-streaming.parameter.headerParameters'),
			),
			showWhen: { sendHeaders: [true], specifyHeaders: ['keypair'] },
		},
		{
			property: {
				displayName: t('settings.log-streaming.parameter.jsonHeaders'),
				name: 'jsonHeaders',
				type: 'json',
				default: '',
			},
			showWhen: { sendHeaders: [true], specifyHeaders: ['json'] },
		},
		{
			property: {
				displayName: t('settings.log-streaming.parameter.sendPayload'),
				name: 'sendPayload',
				type: 'boolean',
				default: true,
			},
		},
		{
			property: {
				displayName: t('settings.log-streaming.parameter.responseCodeMustMatch'),
				name: 'responseCodeMustMatch',
				type: 'boolean',
				default: false,
			},
		},
		{
			property: {
				displayName: t('settings.log-streaming.parameter.expectedStatusCode'),
				name: 'expectedStatusCode',
				type: 'number',
				typeOptions: { minValue: 100, maxValue: 599 },
				default: 200,
			},
			showWhen: { responseCodeMustMatch: [true] },
		},
	];
}

function sentryParameters(t: Translate): DestinationParameter[] {
	return [
		{
			property: {
				displayName: t('settings.log-streaming.parameter.dsn'),
				name: 'dsn',
				type: 'string',
				required: true,
				placeholder: 'https://',
				default: '',
			},
		},
		{
			property: {
				displayName: t('settings.log-streaming.parameter.tracesSampleRate'),
				name: 'tracesSampleRate',
				type: 'number',
				typeOptions: { minValue: 0, maxValue: 1, numberPrecision: 2 },
				default: 1,
			},
		},
		{
			property: {
				displayName: t('settings.log-streaming.parameter.sendPayload'),
				name: 'sendPayload',
				type: 'boolean',
				default: true,
			},
		},
	];
}

function syslogParameters(t: Translate): DestinationParameter[] {
	return [
		{
			property: {
				displayName: t('settings.log-streaming.parameter.host'),
				name: 'host',
				type: 'string',
				required: true,
				default: '',
			},
		},
		{
			property: {
				displayName: t('settings.log-streaming.parameter.port'),
				name: 'port',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 65535 },
				default: 514,
			},
		},
		{
			property: {
				displayName: t('settings.log-streaming.parameter.protocol'),
				name: 'protocol',
				type: 'options',
				options: [
					{ name: 'TCP', value: 'tcp' },
					{ name: 'UDP', value: 'udp' },
					{ name: 'TLS', value: 'tls' },
				],
				default: 'tcp',
			},
		},
		{
			property: {
				displayName: t('settings.log-streaming.parameter.facility'),
				name: 'facility',
				type: 'number',
				typeOptions: { minValue: 0, maxValue: 23 },
				default: 16,
			},
		},
		{
			property: {
				displayName: t('settings.log-streaming.parameter.appName'),
				name: 'app_name',
				type: 'string',
				default: 'n8n',
			},
		},
	];
}

function parametersFor(type: MessageEventBusDestinationType, t: Translate): DestinationParameter[] {
	switch (type) {
		case MessageEventBusDestinationTypeNames.webhook:
			return webhookParameters(t);
		case MessageEventBusDestinationTypeNames.sentry:
			return sentryParameters(t);
		case MessageEventBusDestinationTypeNames.syslog:
			return syslogParameters(t);
	}
}

/**
 * All form settings for a destination type, in display order. Destinations
 * store literal values, so expressions are switched off for every setting.
 */
export function getDestinationParameters(
	type: MessageEventBusDestinationType,
	t: Translate,
): DestinationParameter[] {
	return parametersFor(type, t).map((parameter) => ({
		...parameter,
		property: { ...parameter.property, noDataExpression: true },
	}));
}

/** Whether a setting should be shown given the current values of the others. */
export function isParameterVisible(parameter: DestinationParameter, values: INodeParameters) {
	if (!parameter.showWhen) return true;
	return Object.entries(parameter.showWhen).every(([name, allowed]) =>
		allowed.some((value) => value === values[name]),
	);
}
