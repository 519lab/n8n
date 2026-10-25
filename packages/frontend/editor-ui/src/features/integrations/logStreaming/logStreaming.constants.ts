import type { BaseTextKey } from '@n8n/i18n';
import { MessageEventBusDestinationTypeNames } from 'n8n-workflow';

import type { EventGroup, MessageEventBusDestinationType } from './logStreaming.types';

/** Base path of the log-streaming (event bus) REST endpoints (mounted under `/rest`). */
export const LOG_STREAMING_API_ROOT = '/eventbus';

/** Destination types offered when creating a new log-stream destination, in display order. */
export const DESTINATION_TYPES: MessageEventBusDestinationType[] = [
	MessageEventBusDestinationTypeNames.webhook,
	MessageEventBusDestinationTypeNames.sentry,
	MessageEventBusDestinationTypeNames.syslog,
];

/** Display-name i18n key per destination type. */
export const DESTINATION_TYPE_LABEL_KEYS: Record<MessageEventBusDestinationType, BaseTextKey> = {
	[MessageEventBusDestinationTypeNames.webhook]:
		'settings.log-streaming.$$MessageEventBusDestinationWebhook',
	[MessageEventBusDestinationTypeNames.sentry]:
		'settings.log-streaming.$$MessageEventBusDestinationSentry',
	[MessageEventBusDestinationTypeNames.syslog]:
		'settings.log-streaming.$$MessageEventBusDestinationSyslog',
};

/** Fallback label for a destination whose type the UI does not know. */
export const UNKNOWN_DESTINATION_TYPE_LABEL_KEY: BaseTextKey =
	'settings.log-streaming.$$AbstractMessageEventBusDestination';

/**
 * Subscribable event tree, grouped by prefix. Group `name`s (e.g. `n8n.workflow`)
 * are what the backend persists and expands into their member events, so a whole
 * group can be subscribed by storing the prefix alone. Event names mirror the
 * canonical fair-code event catalogue exposed by the message event bus.
 */
export const EVENT_GROUPS: EventGroup[] = [
	{
		name: 'n8n.audit',
		events: [
			'n8n.audit.user.login.success',
			'n8n.audit.user.login.failed',
			'n8n.audit.user.signedup',
			'n8n.audit.user.updated',
			'n8n.audit.user.deleted',
			'n8n.audit.user.invited',
			'n8n.audit.user.invitation.accepted',
			'n8n.audit.user.reinvited',
			'n8n.audit.user.email.failed',
			'n8n.audit.user.reset.requested',
			'n8n.audit.user.reset',
			'n8n.audit.user.credentials.created',
			'n8n.audit.user.credentials.shared',
			'n8n.audit.user.credentials.updated',
			'n8n.audit.user.credentials.deleted',
			'n8n.audit.user.api.created',
			'n8n.audit.user.api.deleted',
			'n8n.audit.user.api.rotated',
			'n8n.audit.user.mfa.enabled',
			'n8n.audit.user.mfa.disabled',
			'n8n.audit.workflow.created',
			'n8n.audit.workflow.deleted',
			'n8n.audit.workflow.updated',
			'n8n.audit.workflow.archived',
			'n8n.audit.workflow.unarchived',
			'n8n.audit.workflow.activated',
			'n8n.audit.workflow.deactivated',
			'n8n.audit.variable.created',
			'n8n.audit.variable.updated',
			'n8n.audit.variable.deleted',
			'n8n.audit.mcp.oauth.completed',
			'n8n.audit.mcp.tool.called',
			'n8n.audit.mcp.access.updated',
		],
	},
	{
		name: 'n8n.workflow',
		events: [
			'n8n.workflow.started',
			'n8n.workflow.success',
			'n8n.workflow.failed',
			'n8n.workflow.cancelled',
		],
	},
	{
		name: 'n8n.node',
		events: ['n8n.node.started', 'n8n.node.finished'],
	},
	{
		name: 'n8n.ai',
		events: [
			'n8n.ai.memory.get.messages',
			'n8n.ai.memory.added.message',
			'n8n.ai.output.parser.parsed',
			'n8n.ai.retriever.get.relevant.documents',
			'n8n.ai.embeddings.embedded.document',
			'n8n.ai.embeddings.embedded.query',
			'n8n.ai.document.processed',
			'n8n.ai.text.splitter.split',
			'n8n.ai.tool.called',
			'n8n.ai.vector.store.searched',
			'n8n.ai.llm.generated',
			'n8n.ai.llm.error',
			'n8n.ai.vector.store.populated',
			'n8n.ai.vector.store.updated',
		],
	},
	{
		name: 'n8n.runner',
		events: ['n8n.runner.task.requested', 'n8n.runner.response.received'],
	},
	{
		name: 'n8n.queue',
		events: [
			'n8n.queue.job.enqueued',
			'n8n.queue.job.dequeued',
			'n8n.queue.job.completed',
			'n8n.queue.job.failed',
			'n8n.queue.job.stalled',
		],
	},
];

/** Display-name i18n key per event group. */
export const EVENT_GROUP_LABEL_KEYS: Partial<Record<string, BaseTextKey>> = {
	'n8n.audit': 'settings.log-streaming.eventGroup.n8n.audit',
	'n8n.workflow': 'settings.log-streaming.eventGroup.n8n.workflow',
	'n8n.node': 'settings.log-streaming.eventGroup.n8n.node',
	'n8n.ai': 'settings.log-streaming.eventGroup.n8n.ai',
	'n8n.runner': 'settings.log-streaming.eventGroup.n8n.runner',
	'n8n.queue': 'settings.log-streaming.eventGroup.n8n.queue',
};

/** Events with a friendly display name; any other event is shown by its name. */
export const EVENT_LABEL_KEYS: Partial<Record<string, BaseTextKey>> = {
	'n8n.audit.mcp.oauth.completed': 'settings.log-streaming.eventName.n8n.audit.mcp.oauth.completed',
	'n8n.audit.mcp.tool.called': 'settings.log-streaming.eventName.n8n.audit.mcp.tool.called',
	'n8n.audit.mcp.access.updated': 'settings.log-streaming.eventName.n8n.audit.mcp.access.updated',
};
