<script lang="ts" setup>
import { computed } from 'vue';
import {
	NodeHelpers,
	type INodeParameters,
	type INodeProperties,
	type NodeParameterValueType,
} from 'n8n-workflow';

import type { IUpdateInformation } from '@/Interface';
import ParameterInputExpanded from '@/features/ndv/parameters/components/ParameterInputExpanded.vue';

/**
 * Renders a provider type's settings form from its `INodeProperties`, the same
 * way credential fields render, so option-typed and password fields get their
 * proper inputs and `displayOptions` hide fields that don't apply.
 */
const props = defineProps<{
	properties: INodeProperties[];
	values: INodeParameters;
}>();

const emit = defineEmits<{
	update: [name: string, value: NodeParameterValueType];
}>();

const visibleProperties = computed(() =>
	props.properties.filter(
		(property) =>
			property.type !== 'hidden' &&
			(property.displayOptions === undefined ||
				NodeHelpers.displayParameter(props.values, property, null, null)),
	),
);

function onUpdate(update: IUpdateInformation) {
	emit('update', update.name, update.value);
}
</script>

<template>
	<div :class="$style.fields">
		<ParameterInputExpanded
			v-for="property in visibleProperties"
			:key="property.name"
			:parameter="property"
			:value="values[property.name]"
			:node-values="values"
			:label="{ size: 'medium' }"
			event-source="secrets-provider-connection"
			@update="onUpdate"
		/>
	</div>
</template>

<style lang="scss" module>
.fields {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--sm);
}
</style>
