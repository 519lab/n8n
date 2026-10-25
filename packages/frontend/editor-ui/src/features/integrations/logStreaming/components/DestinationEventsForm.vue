<script lang="ts" setup>
import { ref } from 'vue';
import { useI18n } from '@n8n/i18n';
import { N8nCheckbox, N8nIcon, N8nSwitch, N8nText } from '@n8n/design-system';

import { EVENT_GROUP_LABEL_KEYS, EVENT_GROUPS, EVENT_LABEL_KEYS } from '../logStreaming.constants';
import type { EventGroup } from '../logStreaming.types';

defineProps<{
	readOnly?: boolean;
}>();

const subscribedEvents = defineModel<string[]>('subscribedEvents', { required: true });
const anonymizeAuditMessages = defineModel<boolean>('anonymizeAuditMessages', { default: false });

const i18n = useI18n();

const expandedGroups = ref<Set<string>>(new Set());

function isEventChecked(group: EventGroup, event: string): boolean {
	return subscribedEvents.value.includes(event) || subscribedEvents.value.includes(group.name);
}

function isGroupChecked(group: EventGroup): boolean {
	const events = subscribedEvents.value;
	return events.includes(group.name) || group.events.every((event) => events.includes(event));
}

function isGroupIndeterminate(group: EventGroup): boolean {
	if (isGroupChecked(group)) return false;
	return group.events.some((event) => subscribedEvents.value.includes(event));
}

function toggleGroup(group: EventGroup, value: boolean) {
	const set = new Set(subscribedEvents.value);
	group.events.forEach((event) => set.delete(event));
	set.delete(group.name);
	if (value) set.add(group.name);
	subscribedEvents.value = [...set];
}

function toggleEvent(group: EventGroup, event: string, value: boolean) {
	const set = new Set(subscribedEvents.value);
	// expand a group-level subscription into its members before editing a single one
	if (set.has(group.name)) {
		set.delete(group.name);
		group.events.forEach((name) => set.add(name));
	}
	if (value) set.add(event);
	else set.delete(event);
	// collapse back to the group prefix when every member is subscribed
	if (group.events.every((name) => set.has(name))) {
		group.events.forEach((name) => set.delete(name));
		set.add(group.name);
	}
	subscribedEvents.value = [...set];
}

function toggleExpanded(name: string) {
	const next = new Set(expandedGroups.value);
	if (next.has(name)) next.delete(name);
	else next.add(name);
	expandedGroups.value = next;
}

function groupLabel(name: string): string {
	const key = EVENT_GROUP_LABEL_KEYS[name];
	return key ? i18n.baseText(key) : name;
}

function eventLabel(event: string): string {
	const key = EVENT_LABEL_KEYS[event];
	return key ? i18n.baseText(key) : event;
}
</script>

<template>
	<div :class="$style.container">
		<N8nText size="small" color="text-light">
			{{ i18n.baseText('settings.log-streaming.tab.events.title') }}
		</N8nText>

		<div
			v-for="group in EVENT_GROUPS"
			:key="group.name"
			:class="$style.group"
			:data-test-id="`event-group-${group.name}`"
		>
			<div :class="$style.groupHeader">
				<N8nCheckbox
					:model-value="isGroupChecked(group)"
					:indeterminate="isGroupIndeterminate(group)"
					:disabled="readOnly"
					:label="groupLabel(group.name)"
					@update:model-value="(value: boolean) => toggleGroup(group, value)"
				/>
				<button
					type="button"
					:class="$style.expandButton"
					:aria-label="groupLabel(group.name)"
					:aria-expanded="expandedGroups.has(group.name)"
					@click="toggleExpanded(group.name)"
				>
					<N8nIcon
						:icon="expandedGroups.has(group.name) ? 'chevron-up' : 'chevron-down'"
						size="small"
					/>
				</button>
			</div>
			<div v-if="expandedGroups.has(group.name)" :class="$style.groupEvents">
				<N8nCheckbox
					v-for="event in group.events"
					:key="event"
					:model-value="isEventChecked(group, event)"
					:disabled="readOnly"
					:label="eventLabel(event)"
					@update:model-value="(value: boolean) => toggleEvent(group, event, value)"
				/>
			</div>
		</div>

		<N8nSwitch
			v-model="anonymizeAuditMessages"
			:disabled="readOnly"
			:label="i18n.baseText('settings.log-streaming.tab.events.anonymize')"
			data-test-id="destination-anonymize"
		/>
		<N8nText size="small" color="text-light">
			{{ i18n.baseText('settings.log-streaming.tab.events.anonymize.info') }}
		</N8nText>
	</div>
</template>

<style lang="scss" module>
.container {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--s);
}

.group {
	display: flex;
	flex-direction: column;
	border-bottom: var(--border);
	padding-bottom: var(--spacing--2xs);
}

.groupHeader {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.expandButton {
	border: none;
	background: transparent;
	cursor: pointer;
	color: var(--text-color--subtler);
	padding: var(--spacing--4xs);
}

.groupEvents {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--4xs);
	padding-left: var(--spacing--l);
	padding-top: var(--spacing--3xs);
}
</style>
