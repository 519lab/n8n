<script lang="ts" setup>
import { computed, onMounted } from 'vue';
import { useI18n } from '@n8n/i18n';
import { N8nInputLabel, N8nOption, N8nSelect, N8nText } from '@n8n/design-system';

import { useProjectsStore } from '@/features/collaboration/projects/projects.store';

/** Select value for "available to every project". Project ids are never this string. */
const GLOBAL_SCOPE = 'global';

/**
 * Single choice between "Global" and one team project. An empty `projectIds`
 * means global; an untouched multi-project scope is shown by its first project
 * and kept as-is until the user picks something else.
 */
const props = defineProps<{
	projectIds: string[];
}>();

const emit = defineEmits<{
	'update:projectIds': [projectIds: string[]];
}>();

const i18n = useI18n();
const projectsStore = useProjectsStore();

const options = computed(() => [
	{
		value: GLOBAL_SCOPE,
		label: i18n.baseText('settings.secretsProviderConnections.modal.scope.global'),
	},
	...projectsStore.availableProjects
		.filter((project) => project.type !== 'personal')
		.map((project) => ({ value: project.id, label: project.name ?? project.id })),
]);

const selected = computed(() => props.projectIds[0] ?? GLOBAL_SCOPE);

function onChange(value: string) {
	emit('update:projectIds', value === GLOBAL_SCOPE ? [] : [value]);
}

onMounted(async () => {
	try {
		await projectsStore.getAvailableProjects();
	} catch {
		// Without the project list only "Global" is offered.
	}
});
</script>

<template>
	<div :class="$style.scope">
		<N8nText color="text-light" size="small">
			{{ i18n.baseText('settings.secretsProviderConnections.modal.scope.info') }}
		</N8nText>
		<N8nInputLabel
			:label="i18n.baseText('settings.secretsProviderConnections.modal.scope.label')"
			:bold="false"
		>
			<N8nSelect
				:model-value="selected"
				filterable
				:placeholder="
					i18n.baseText('settings.secretsProviderConnections.modal.scope.placeholder.project')
				"
				:no-match-text="
					i18n.baseText('settings.secretsProviderConnections.modal.scope.emptyOptionsText')
				"
				:teleported="false"
				data-test-id="secrets-provider-scope-select"
				@update:model-value="onChange"
			>
				<N8nOption
					v-for="option in options"
					:key="option.value"
					:value="option.value"
					:label="option.label"
				/>
			</N8nSelect>
		</N8nInputLabel>
	</div>
</template>

<style lang="scss" module>
.scope {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--sm);
}
</style>
