import type { BaseTextKey } from '@n8n/i18n';
import get from 'lodash/get';
import isEqual from 'lodash/isEqual';
import set from 'lodash/set';
import unset from 'lodash/unset';
import type { INodeParameters, NodeParameterValueType } from 'n8n-workflow';
import {
	defaultMessageEventBusDestinationSentryOptions,
	defaultMessageEventBusDestinationSyslogOptions,
	defaultMessageEventBusDestinationWebhookOptions,
	deepCopy,
	MessageEventBusDestinationTypeNames,
} from 'n8n-workflow';

import {
	DESTINATION_TYPE_LABEL_KEYS,
	DESTINATION_TYPES,
	UNKNOWN_DESTINATION_TYPE_LABEL_KEY,
} from './logStreaming.constants';
import type {
	MessageEventBusDestinationOptions,
	MessageEventBusDestinationType,
} from './logStreaming.types';

/**
 * Editable copy of a destination, split into the fields every destination
 * shares (edited by the modal itself) and its type-specific settings (edited
 * through the parameter form).
 */
export interface DestinationDraft {
	shared: MessageEventBusDestinationOptions;
	parameters: INodeParameters;
}

/** Keys of `MessageEventBusDestinationOptions`; everything else is type-specific. */
const SHARED_KEYS = new Set([
	'__type',
	'id',
	'label',
	'enabled',
	'subscribedEvents',
	'credentials',
	'anonymizeAuditMessages',
	'circuitBreaker',
]);

export function isDestinationType(value: unknown): value is MessageEventBusDestinationType {
	return DESTINATION_TYPES.some((type) => type === value);
}

/** i18n key of a destination type's display name. */
export function destinationTypeLabelKey(type: unknown): BaseTextKey {
	return isDestinationType(type)
		? DESTINATION_TYPE_LABEL_KEYS[type]
		: UNKNOWN_DESTINATION_TYPE_LABEL_KEY;
}

/** Runtime destination values come from the API, so any JSON value is accepted. */
function isParameterValue(value: unknown): value is NodeParameterValueType {
	return typeof value !== 'function' && typeof value !== 'symbol' && typeof value !== 'bigint';
}

/** Fresh default options for a newly created destination of the given type. */
export function defaultDestinationFor(
	type: MessageEventBusDestinationType,
): MessageEventBusDestinationOptions {
	switch (type) {
		case MessageEventBusDestinationTypeNames.webhook:
			return deepCopy(defaultMessageEventBusDestinationWebhookOptions);
		case MessageEventBusDestinationTypeNames.sentry:
			return deepCopy(defaultMessageEventBusDestinationSentryOptions);
		case MessageEventBusDestinationTypeNames.syslog:
			return deepCopy(defaultMessageEventBusDestinationSyslogOptions);
	}
}

export function toDraft(destination: MessageEventBusDestinationOptions): DestinationDraft {
	const copy = deepCopy(destination);
	const shared: MessageEventBusDestinationOptions = {
		__type: copy.__type,
		id: copy.id,
		label: copy.label,
		enabled: copy.enabled,
		subscribedEvents: Array.isArray(copy.subscribedEvents) ? copy.subscribedEvents : [],
		credentials: copy.credentials,
		anonymizeAuditMessages: copy.anonymizeAuditMessages,
		circuitBreaker: copy.circuitBreaker,
	};

	const parameters: INodeParameters = {};
	const entries: Array<[string, unknown]> = Object.entries(copy);
	for (const [key, value] of entries) {
		if (!SHARED_KEYS.has(key) && isParameterValue(value)) parameters[key] = value;
	}

	return { shared, parameters };
}

/**
 * Request body for a draft. Empty (`null`/`undefined`) settings are dropped
 * because the backend schema treats them as absent, not as `null`.
 */
export function toDestination(draft: DestinationDraft): MessageEventBusDestinationOptions {
	const destination: MessageEventBusDestinationOptions = {};
	const shared: Array<[string, unknown]> = Object.entries(draft.shared);
	for (const [key, value] of shared) {
		if (value !== undefined) set(destination, key, value);
	}
	for (const [key, value] of Object.entries(draft.parameters)) {
		if (value !== undefined && value !== null) set(destination, key, value);
	}
	return destination;
}

const ARRAY_ITEM_PATH = /^(.*)\[(\d+)\]$/;

/**
 * Apply a (possibly nested) setting update emitted by the parameter inputs,
 * e.g. `headerParameters.parameters[0].name`. An `undefined` value removes the
 * setting; for an array item it removes the item itself.
 */
export function applyParameterUpdate(
	parameters: INodeParameters,
	path: string,
	value: NodeParameterValueType,
): INodeParameters {
	const next = deepCopy(parameters);
	if (value !== undefined) {
		set(next, path, value);
		return next;
	}

	const arrayItem = ARRAY_ITEM_PATH.exec(path);
	if (arrayItem) {
		const list: unknown = get(next, arrayItem[1]);
		if (Array.isArray(list)) {
			list.splice(Number(arrayItem[2]), 1);
			return next;
		}
	}
	unset(next, path);
	return next;
}

export function isDraftEqual(a: DestinationDraft, b: DestinationDraft): boolean {
	return isEqual(toDestination(a), toDestination(b));
}
