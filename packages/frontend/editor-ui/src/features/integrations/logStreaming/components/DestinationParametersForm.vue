<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from '@n8n/i18n';
import type { INodeParameters, NodeParameterValueType } from 'n8n-workflow';

import type { IUpdateInformation } from '@/Interface';
import { provideWorkflowDocumentStore } from '@/app/stores/workflowDocument.store';
import ParameterInputExpanded from '@/features/ndv/parameters/components/ParameterInputExpanded.vue';

import { getDestinationParameters, isParameterVisible } from '../logStreaming.parameters';
import type { MessageEventBusDestinationType } from '../logStreaming.types';

const props = defineProps<{
	type: MessageEventBusDestinationType;
	parameters: INodeParameters;
	readOnly?: boolean;
}>();

const emit = defineEmits<{
	update: [path: string, value: NodeParameterValueType];
}>();

const i18n = useI18n();

// The shared parameter inputs expect a workflow document in scope; this form
// renders outside the workflow editor, so re-provide the resolved one.
provideWorkflowDocumentStore();

const visibleParameters = computed(() =>
	getDestinationParameters(props.type, (key) => i18n.baseText(key)).filter((parameter) =>
		isParameterVisible(parameter, props.parameters),
	),
);

function onUpdate(update: IUpdateInformation) {
	emit('update', update.name, update.value);
}
</script>

<template>
	<!-- A disabled fieldset makes every native control inside it read-only. -->
	<fieldset :class="$style.form" :disabled="readOnly" @keydown.stop>
		<form
			v-for="parameter in visibleParameters"
			:key="parameter.property.name"
			autocomplete="off"
			@submit.prevent
		>
			<ParameterInputExpanded
				:parameter="parameter.property"
				:value="parameters[parameter.property.name]"
				:node-values="parameters"
				:label="{ size: 'medium' }"
				event-source="log-streaming"
				@update="onUpdate"
			/>
		</form>
	</fieldset>
</template>

<style lang="scss" module>
.form {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--s);
	min-width: 0;
	margin: 0;
	padding: 0;
	border: none;
}
</style>
