<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from '@n8n/i18n';
import { N8nActionToggle, N8nCard, N8nSwitch, N8nText } from '@n8n/design-system';

import type { MessageEventBusDestinationOptions } from '../logStreaming.types';
import { destinationTypeLabelKey } from '../logStreaming.utils';

const props = defineProps<{
	destination: MessageEventBusDestinationOptions;
	readOnly?: boolean;
}>();

const emit = defineEmits<{
	open: [];
	delete: [];
	toggle: [enabled: boolean];
}>();

const i18n = useI18n();

const typeLabel = computed(() => i18n.baseText(destinationTypeLabelKey(props.destination.__type)));

// Menu order is part of the UI contract: open first, delete second.
const actions = computed(() => [
	{ value: 'open', label: i18n.baseText('generic.open') },
	{ value: 'delete', label: i18n.baseText('generic.delete'), disabled: props.readOnly },
]);

function onAction(action: string) {
	if (action === 'open') emit('open');
	else if (action === 'delete') emit('delete');
}

function onToggle(enabled: boolean) {
	emit('toggle', enabled);
}
</script>

<template>
	<N8nCard :class="$style.card" hoverable data-test-id="destination-card" @click="emit('open')">
		<div :class="$style.info">
			<N8nText bold>{{ destination.label }}</N8nText>
			<N8nText size="small" color="text-light">{{ typeLabel }}</N8nText>
		</div>
		<template #append>
			<div :class="$style.actions">
				<!-- Toggling saves in place; it must not also open the card. -->
				<div :class="$style.toggle" @click.stop>
					<N8nSwitch
						:model-value="destination.enabled ?? false"
						:disabled="readOnly"
						:label="i18n.baseText('workflowActivator.active')"
						data-test-id="workflow-activate-switch"
						@update:model-value="onToggle"
					/>
				</div>
				<N8nActionToggle :actions="actions" placement="bottom-end" @action="onAction" />
			</div>
		</template>
	</N8nCard>
</template>

<style lang="scss" module>
.card {
	cursor: pointer;
}

.info {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--4xs);
}

.actions {
	display: flex;
	align-items: center;
	gap: var(--spacing--s);
}

.toggle {
	display: flex;
	align-items: center;
}
</style>
