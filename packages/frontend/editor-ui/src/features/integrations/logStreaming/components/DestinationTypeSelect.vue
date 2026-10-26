<script lang="ts" setup>
import { useI18n } from '@n8n/i18n';
import { N8nInputLabel, N8nOption, N8nSelect } from '@n8n/design-system';

import { DESTINATION_TYPE_LABEL_KEYS, DESTINATION_TYPES } from '../logStreaming.constants';
import type { MessageEventBusDestinationType } from '../logStreaming.types';
import { isDestinationType } from '../logStreaming.utils';

defineProps<{
	modelValue?: MessageEventBusDestinationType;
	disabled?: boolean;
}>();

const emit = defineEmits<{
	'update:modelValue': [type: MessageEventBusDestinationType];
}>();

const i18n = useI18n();

function onSelect(value: unknown) {
	if (isDestinationType(value)) emit('update:modelValue', value);
}
</script>

<template>
	<N8nInputLabel
		:label="i18n.baseText('settings.log-streaming.selecttype')"
		:tooltip-text="i18n.baseText('settings.log-streaming.selecttypehint')"
	>
		<N8nSelect
			:model-value="modelValue"
			:disabled="disabled"
			:placeholder="i18n.baseText('parameterInput.select')"
			data-test-id="select-destination-type"
			@update:model-value="onSelect"
		>
			<N8nOption
				v-for="type in DESTINATION_TYPES"
				:key="type"
				:value="type"
				:label="i18n.baseText(DESTINATION_TYPE_LABEL_KEYS[type])"
			/>
		</N8nSelect>
	</N8nInputLabel>
</template>
