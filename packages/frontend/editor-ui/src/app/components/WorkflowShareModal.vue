<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from '@n8n/i18n';
import { useToast } from '@n8n/composables/useToast';
import { createEventBus } from '@n8n/utils/event-bus';
import { getResourcePermissions } from '@n8n/permissions';
import { N8nButton, N8nHeading, N8nInfoTip, N8nText } from '@n8n/design-system';

import Modal from '@/app/components/Modal.vue';
import ProjectSharing from '@/features/collaboration/projects/components/ProjectSharing.vue';
import {
	ProjectTypes,
	type ProjectSharingData,
} from '@/features/collaboration/projects/projects.types';
import { useRemoteProjectSearch } from '@/features/collaboration/projects/projects.utils';
import { useWorkflowsListStore } from '@/app/stores/workflowsList.store';
import { useWorkflowSharingStore } from '@/app/stores/workflowsSharing.store';
import { useProjectsStore } from '@/features/collaboration/projects/projects.store';
import type { IWorkflowDb } from '@/Interface';

const props = defineProps<{
	data: { id: string };
	modalName: string;
	isActive?: boolean;
}>();

const i18n = useI18n();
const toast = useToast();

const modalBus = createEventBus();
const searchFn = useRemoteProjectSearch();

const workflowsListStore = useWorkflowsListStore();
const workflowSharingStore = useWorkflowSharingStore();
const projectsStore = useProjectsStore();

const loading = ref(true);
const saving = ref(false);
const workflow = ref<IWorkflowDb | null>(null);
const sharedWith = ref<ProjectSharingData[]>([]);
const teamMemberCount = ref(0);

const homeProject = computed(() => workflow.value?.homeProject);

const workflowPermissions = computed(() => getResourcePermissions(workflow.value?.scopes).workflow);

const isHomeProjectPersonal = computed(() => homeProject.value?.type === ProjectTypes.Personal);
const isHomeProjectTeam = computed(() => homeProject.value?.type === ProjectTypes.Team);

// Team-project workflows are shared through project membership, not per workflow.
const isReadOnly = computed(() => !workflowPermissions.value.share || isHomeProjectTeam.value);

// Personal-space sharing is an instance policy, surfaced as the personal owner's
// `workflow:share` scope; only the space's owner gets the notice explaining it.
const isPersonalSharingRestricted = computed(
	() =>
		isHomeProjectPersonal.value &&
		!workflowPermissions.value.share &&
		homeProject.value?.id === projectsStore.personalProject?.id,
);

const isDirty = computed(() => {
	const original = (workflow.value?.sharedWithProjects ?? []).map((project) => project.id).sort();
	const current = sharedWith.value.map((project) => project.id).sort();
	return original.length !== current.length || original.some((id, i) => id !== current[i]);
});

const modalTitle = computed(() => {
	if (isReadOnly.value && homeProject.value) {
		return i18n.baseText('workflows.shareModal.title.static', {
			interpolate: { projectName: homeProject.value.name ?? '' },
		});
	}
	return i18n.baseText('workflows.shareModal.title', {
		interpolate: { name: workflow.value?.name ?? '' },
	});
});

const ownerName = computed(() =>
	workflowSharingStore.getWorkflowOwnerName(
		props.data.id,
		i18n.baseText('workflows.shareModal.info.sharee.fallback'),
	),
);

onMounted(async () => {
	try {
		// Fetch rather than trust the list cache: a workflow opened in the editor can be
		// cached as a stub without its name, home project or scopes.
		workflow.value = await workflowsListStore.fetchWorkflow(props.data.id);
		// Keep the fresh record available for owner-name lookups.
		workflowsListStore.addWorkflow(workflow.value);
		sharedWith.value = [...(workflow.value.sharedWithProjects ?? [])];
		if (isHomeProjectTeam.value && homeProject.value) {
			try {
				const project = await projectsStore.fetchProject(homeProject.value.id);
				teamMemberCount.value = project.relations.length;
			} catch {
				// The member count is informational only.
			}
		}
	} catch (error) {
		toast.showError(error, i18n.baseText('workflows.shareModal.onSave.error.title'));
	} finally {
		loading.value = false;
	}
});

async function onSave() {
	if (saving.value) {
		return;
	}
	saving.value = true;
	try {
		await workflowSharingStore.saveWorkflowSharedWith({
			workflowId: props.data.id,
			sharedWithProjects: sharedWith.value,
		});
		if (workflow.value) {
			workflow.value.sharedWithProjects = [...sharedWith.value];
		}
		toast.showMessage({
			title: i18n.baseText('workflows.shareModal.onSave.success.title'),
			type: 'success',
		});
		modalBus.emit('close');
	} catch (error) {
		toast.showError(error, i18n.baseText('workflows.shareModal.onSave.error.title'));
	} finally {
		saving.value = false;
	}
}
</script>

<template>
	<Modal width="460px" :name="modalName" :event-bus="modalBus" :center="true">
		<template #header>
			<N8nHeading tag="h2" size="xlarge">{{ modalTitle }}</N8nHeading>
		</template>
		<template #content>
			<div v-loading="loading" :class="$style.content">
				<template v-if="workflow">
					<N8nInfoTip
						v-if="isPersonalSharingRestricted"
						:bold="false"
						data-test-id="workflow-share-personal-restricted"
					>
						{{ i18n.baseText('workflows.shareModal.info.personalSpaceRestricted') }}
					</N8nInfoTip>
					<N8nInfoTip
						v-else-if="isHomeProjectTeam"
						:bold="false"
						data-test-id="workflow-share-team-info"
					>
						{{
							i18n.baseText('workflows.shareModal.info.members', {
								interpolate: {
									projectName: homeProject?.name ?? '',
									members: i18n.baseText('workflows.shareModal.info.members.number', {
										interpolate: { number: String(teamMemberCount) },
										adjustToNumber: teamMemberCount,
									}),
								},
							})
						}}
					</N8nInfoTip>
					<template v-else>
						<ProjectSharing
							v-model="sharedWith"
							:home-project="homeProject"
							:search-fn="searchFn"
							:readonly="isReadOnly"
							:static="isReadOnly"
							:placeholder="i18n.baseText('workflows.shareModal.select.placeholder')"
							:empty-options-text="i18n.baseText('projects.sharing.noMatchingProjects')"
						/>
						<N8nText v-if="isReadOnly" size="small" color="text-light">
							{{
								i18n.baseText('workflows.shareModal.info.sharee', {
									interpolate: { workflowOwnerName: ownerName },
								})
							}}
						</N8nText>
					</template>
				</template>
			</div>
		</template>
		<template #footer>
			<div v-if="workflow && !isReadOnly" :class="$style.footer">
				<N8nText v-if="isDirty" size="small" color="text-light" :class="$style.changesHint">
					{{ i18n.baseText('workflows.shareModal.changesHint') }}
				</N8nText>
				<N8nButton
					:loading="saving"
					:disabled="!isDirty || loading"
					:label="i18n.baseText('workflows.shareModal.save')"
					data-test-id="workflow-sharing-modal-save-button"
					@click="onSave"
				/>
			</div>
		</template>
	</Modal>
</template>

<style lang="scss" module>
.content {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--sm);
	min-height: 100px;
}

.footer {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: var(--spacing--sm);
}

.changesHint {
	margin-right: auto;
}
</style>
