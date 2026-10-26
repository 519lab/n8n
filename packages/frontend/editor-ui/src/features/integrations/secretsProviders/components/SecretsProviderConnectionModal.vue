<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from '@n8n/i18n';
import { useToast } from '@n8n/composables/useToast';
import { createEventBus } from '@n8n/utils/event-bus';
import { useRBACStore } from '@n8n/stores/rbac.store';
import { useSettingsStore } from '@n8n/stores/settings.store';
import type { INodeParameters, INodeProperties, NodeParameterValueType } from 'n8n-workflow';
import type {
	SecretProviderConnection,
	SecretProviderTypeResponse,
	SecretsProviderType,
} from '@n8n/api-types';

import Modal from '@/app/components/Modal.vue';
import {
	N8nButton,
	N8nInput,
	N8nInputLabel,
	N8nMenuItem,
	N8nOption,
	N8nSelect,
	N8nText,
	type IMenuItem,
} from '@n8n/design-system';

import { useSecretsProviderConnection } from '../composables/useSecretsProviderConnection';
import type { ConnectionTestResult } from '../secretsProviders.types';
import SecretsProviderConnectionFields from './SecretsProviderConnectionFields.vue';
import SecretsProviderConnectionScope from './SecretsProviderConnectionScope.vue';
import SecretsProviderConnectionTestResult from './SecretsProviderConnectionTestResult.vue';

type ModalTab = 'connection' | 'sharing';

/** Connection name: starts with a letter, then letters/digits only. Mirrors the backend DTO. */
const CONNECTION_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9]*$/;

const TAB_ITEM_IDS: Record<ModalTab, string> = {
	connection: 'sidebar-item-connection',
	sharing: 'sidebar-item-sharing',
};

const props = defineProps<{
	modalName: string;
	data: {
		activeTab?: ModalTab;
		providerKey?: string;
		providerTypes: SecretProviderTypeResponse[];
		existingProviderNames: string[];
		projectId?: string;
		onClose?: () => Promise<void> | void;
	};
}>();

const i18n = useI18n();
const toast = useToast();
const rbacStore = useRBACStore();
const settingsStore = useSettingsStore();
const connection = useSecretsProviderConnection(props.data.projectId);

const modalBus = createEventBus();

/** Set once the connection exists, so later saves update it instead of creating a duplicate. */
const savedProviderKey = ref<string | undefined>(props.data.providerKey);
const isEditing = computed(() => savedProviderKey.value !== undefined);

const activeTab = ref<ModalTab>(props.data.activeTab ?? 'connection');
const connectionName = ref('');
const nameTouched = ref(false);
const providerType = ref<SecretsProviderType | ''>('');
const projectIds = ref<string[]>([]);
const settings = reactive<INodeParameters>({});
/** Whether `settings` differ from what the server holds; unchanged settings are not re-sent. */
const settingsChanged = ref(false);
const secretsCount = ref(0);
const isSaving = ref(false);
const testResult = ref<ConnectionTestResult>({ state: 'idle' });

/** Re-scoping is instance-level, so it is never offered from a project's own settings. */
const canShare = computed(
	() =>
		isEditing.value &&
		!props.data.projectId &&
		(settingsStore.moduleSettings['external-secrets']?.forProjects ?? false) &&
		rbacStore.hasScope('externalSecretsProvider:update'),
);

const currentTab = computed<ModalTab>(() =>
	activeTab.value === 'sharing' && canShare.value ? 'sharing' : 'connection',
);

const sidebarItems = computed<IMenuItem[]>(() => [
	{
		id: TAB_ITEM_IDS.connection,
		label: i18n.baseText('settings.secretsProviderConnections.modal.items.connection'),
		position: 'top',
	},
	...(canShare.value
		? [
				{
					id: TAB_ITEM_IDS.sharing,
					label: i18n.baseText('settings.secretsProviderConnections.modal.items.scope'),
					position: 'top',
				} satisfies IMenuItem,
			]
		: []),
]);

const selectedType = computed<SecretProviderTypeResponse | undefined>(() =>
	props.data.providerTypes.find((type) => type.type === providerType.value),
);

const properties = computed<INodeProperties[]>(() => selectedType.value?.properties ?? []);

const nameError = computed<string | null>(() => {
	if (isEditing.value) return null;
	const name = connectionName.value.trim();
	if (!name) {
		return nameTouched.value
			? i18n.baseText(
					'settings.secretsProviderConnections.modal.validation.connectionName.required',
				)
			: null;
	}
	if (!CONNECTION_NAME_REGEX.test(name)) {
		return i18n.baseText(
			'settings.secretsProviderConnections.modal.validation.connectionName.format',
		);
	}
	if (props.data.existingProviderNames.includes(name)) {
		return i18n.baseText('settings.secretsProviderConnections.modal.connectionName.unique');
	}
	return null;
});

const isBusy = computed(() => isSaving.value || connection.isTesting.value);

const canSave = computed(
	() =>
		(isEditing.value || CONNECTION_NAME_REGEX.test(connectionName.value.trim())) &&
		!nameError.value &&
		Boolean(providerType.value) &&
		!isBusy.value,
);

function seedSettings(stored: INodeParameters = {}) {
	for (const key of Object.keys(settings)) delete settings[key];
	for (const property of properties.value) {
		settings[property.name] = stored[property.name] ?? property.default ?? '';
	}
}

function setSetting(name: string, value: NodeParameterValueType) {
	settings[name] = value;
	settingsChanged.value = true;
}

function onProviderTypeChange(type: SecretsProviderType) {
	providerType.value = type;
	seedSettings();
	settingsChanged.value = true;
}

function selectTab(itemId: string) {
	activeTab.value = itemId === TAB_ITEM_IDS.sharing ? 'sharing' : 'connection';
}

function applySaved(saved: SecretProviderConnection) {
	savedProviderKey.value = saved.name;
	projectIds.value = saved.projects.map((project) => project.id);
	secretsCount.value = saved.secretsCount;
	settingsChanged.value = false;
}

async function loadConnection(providerKey: string) {
	try {
		const existing = await connection.getConnection(providerKey);
		connectionName.value = existing.name;
		providerType.value = existing.type;
		projectIds.value = existing.projects.map((project) => project.id);
		secretsCount.value = existing.secretsCount;
		seedSettings(existing.settings);
		settingsChanged.value = false;
	} catch (error) {
		toast.showError(error, i18n.baseText('settings.secretsProviderConnections.title'));
	}
}

async function runTest() {
	if (!savedProviderKey.value) return;
	testResult.value = { state: 'idle' };
	try {
		const result = await connection.testConnection(savedProviderKey.value);
		testResult.value = result.success
			? { state: 'success' }
			: { state: 'error', message: result.error };
	} catch (error) {
		testResult.value = {
			state: 'error',
			message: error instanceof Error ? error.message : undefined,
		};
	}
}

async function saveConnection(type: SecretsProviderType): Promise<SecretProviderConnection> {
	if (savedProviderKey.value) {
		return await connection.updateConnection(savedProviderKey.value, {
			type,
			// From a project's settings the backend keeps the scope, so don't send one.
			...(props.data.projectId ? {} : { projectIds: projectIds.value }),
			// Stored password fields come back masked; re-sending them unchanged would store the mask.
			...(settingsChanged.value ? { settings: { ...settings } } : {}),
		});
	}

	return await connection.createConnection({
		providerKey: connectionName.value.trim(),
		type,
		projectIds: projectIds.value,
		settings: { ...settings },
	});
}

/** Saving keeps the modal open, switches it to edit mode and tests the stored connection. */
async function onSave() {
	const type = providerType.value;
	if (!canSave.value || !type) return;
	isSaving.value = true;
	testResult.value = { state: 'idle' };
	try {
		applySaved(await saveConnection(type));
	} catch (error) {
		toast.showError(
			error,
			i18n.baseText('settings.secretsProviderConnections.modal.testConnection.error'),
		);
		return;
	} finally {
		isSaving.value = false;
	}
	await runTest();
}

/** Every close path (X, Esc, Cancel) refreshes the opener's list, without blocking the close. */
function onBeforeClose(): boolean {
	void Promise.resolve(props.data.onClose?.());
	return true;
}

function closeModal() {
	modalBus.emit('close');
}

onMounted(async () => {
	if (props.data.providerKey) await loadConnection(props.data.providerKey);
});
</script>

<template>
	<Modal
		:name="modalName"
		:event-bus="modalBus"
		:before-close="onBeforeClose"
		:title="
			connectionName || i18n.baseText('settings.secretsProviderConnections.buttons.addSecretsStore')
		"
		:center="true"
		width="800px"
	>
		<template #content>
			<div :class="$style.layout">
				<nav :class="$style.sidebar">
					<N8nMenuItem
						v-for="item in sidebarItems"
						:key="item.id"
						:item="item"
						:active="TAB_ITEM_IDS[currentTab] === item.id"
						@click="selectTab(item.id)"
					/>
				</nav>

				<div :class="$style.main">
					<SecretsProviderConnectionTestResult
						:result="testResult"
						:provider-key="savedProviderKey ?? connectionName"
						:provider-name="selectedType?.displayName ?? providerType"
						:secrets-count="secretsCount"
					/>

					<div v-if="currentTab === 'connection'" :class="$style.tab">
						<N8nInputLabel
							:label="i18n.baseText('settings.secretsProviderConnections.modal.connectionName')"
							:bold="false"
						>
							<N8nInput
								v-model="connectionName"
								:disabled="isEditing"
								:state="nameError ? 'error' : 'default'"
								data-test-id="provider-name"
								@blur="nameTouched = true"
							/>
							<N8nText v-if="nameError" color="danger" size="small">{{ nameError }}</N8nText>
							<N8nText v-else-if="!isEditing" color="text-light" size="small">
								{{ i18n.baseText('settings.secretsProviderConnections.modal.connectionName.hint') }}
							</N8nText>
						</N8nInputLabel>

						<N8nInputLabel
							:label="i18n.baseText('settings.secretsProviderConnections.modal.providerType')"
							:bold="false"
						>
							<N8nSelect
								:model-value="providerType"
								:disabled="isEditing"
								:placeholder="
									i18n.baseText(
										'settings.secretsProviderConnections.modal.providerType.placeholder',
									)
								"
								:teleported="false"
								data-test-id="provider-type-select"
								@update:model-value="onProviderTypeChange"
							>
								<N8nOption
									v-for="type in data.providerTypes"
									:key="type.type"
									:value="type.type"
									:label="type.displayName"
								/>
							</N8nSelect>
						</N8nInputLabel>

						<SecretsProviderConnectionFields
							:properties="properties"
							:values="settings"
							@update="setSetting"
						/>
					</div>

					<SecretsProviderConnectionScope v-else v-model:project-ids="projectIds" />
				</div>
			</div>
		</template>
		<template #footer>
			<div :class="$style.footer">
				<N8nButton
					variant="subtle"
					data-test-id="secrets-provider-connection-cancel-button"
					@click="closeModal"
				>
					{{ i18n.baseText('generic.cancel') }}
				</N8nButton>
				<N8nButton
					v-if="isEditing"
					variant="outline"
					:loading="connection.isTesting.value"
					:disabled="isBusy"
					data-test-id="secrets-provider-connection-test-button"
					@click="runTest"
				>
					{{ i18n.baseText('settings.externalSecrets.provider.buttons.test') }}
				</N8nButton>
				<N8nButton
					variant="solid"
					:loading="isSaving"
					:disabled="!canSave"
					data-test-id="secrets-provider-connection-save-button"
					@click="onSave"
				>
					{{
						isSaving
							? i18n.baseText('settings.secretsProviderConnections.modal.saving')
							: i18n.baseText('generic.save')
					}}
				</N8nButton>
			</div>
		</template>
	</Modal>
</template>

<style lang="scss" module>
.layout {
	display: flex;
	gap: var(--spacing--lg);
}

.sidebar {
	display: flex;
	flex-direction: column;
	flex-shrink: 0;
	width: var(--spacing--4xl);
}

.main {
	display: flex;
	flex-direction: column;
	flex-grow: 1;
	min-width: 0;
	gap: var(--spacing--sm);
}

.tab {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--sm);
}

.footer {
	display: flex;
	justify-content: flex-end;
	gap: var(--spacing--2xs);
}
</style>
