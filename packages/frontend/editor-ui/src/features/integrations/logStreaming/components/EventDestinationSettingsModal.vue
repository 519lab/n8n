<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useI18n } from '@n8n/i18n';
import { useToast } from '@n8n/composables/useToast';
import type { EventBus } from '@n8n/utils/event-bus';
import type { NodeParameterValueType } from 'n8n-workflow';
import {
	N8nButton,
	N8nHeading,
	N8nInlineTextEdit,
	N8nNotice,
	N8nTabs,
	N8nText,
} from '@n8n/design-system';

import Modal from '@/app/components/Modal.vue';
import { useUIStore } from '@/app/stores/ui.store';

import { useDestinationDelete } from '../composables/useDestinationDelete';
import { useLogStreamingStore } from '../logStreaming.store';
import type {
	MessageEventBusDestinationOptions,
	MessageEventBusDestinationType,
} from '../logStreaming.types';
import {
	applyParameterUpdate,
	defaultDestinationFor,
	destinationTypeLabelKey,
	isDestinationType,
	isDraftEqual,
	toDestination,
	toDraft,
} from '../logStreaming.utils';
import DestinationEventsForm from './DestinationEventsForm.vue';
import DestinationParametersForm from './DestinationParametersForm.vue';
import DestinationTypeSelect from './DestinationTypeSelect.vue';

type Step = 'type' | 'settings';
type Tab = 'settings' | 'events';
type TestResult = 'idle' | 'success' | 'failure';

const props = defineProps<{
	modalName: string;
	destination: MessageEventBusDestinationOptions;
	isNew: boolean;
	eventBus?: EventBus;
}>();

const i18n = useI18n();
const toast = useToast();
const uiStore = useUIStore();
const logStreamingStore = useLogStreamingStore();
const { confirmAndDelete } = useDestinationDelete();

// A new destination starts by picking its type. After its first save the modal
// stays open, now editing an existing destination, so it can be tested right away.
const step = ref<Step>(props.isNew ? 'type' : 'settings');
const isUnsaved = ref(props.isNew);
const selectedType = ref<MessageEventBusDestinationType>();
const draft = ref(toDraft(props.destination));
const snapshot = ref(toDraft(props.destination));
const activeTab = ref<Tab>('settings');
const testResult = ref<TestResult>('idle');
const saving = ref(false);
const testing = ref(false);
const deleting = ref(false);

const isManagedByEnv = computed(() => logStreamingStore.isManagedByEnv);
const destinationType = computed(() => {
	const type = draft.value.shared.__type;
	return isDestinationType(type) ? type : undefined;
});
const typeLabel = computed(() => i18n.baseText(destinationTypeLabelKey(draft.value.shared.__type)));
const isDirty = computed(() => !isDraftEqual(draft.value, snapshot.value));
const showSaveButton = computed(() => isUnsaved.value || isDirty.value);
const canSave = computed(
	() => !isManagedByEnv.value && !saving.value && !!draft.value.shared.label,
);
const canTest = computed(() => !isUnsaved.value && !!draft.value.shared.id);
const width = computed(() => (step.value === 'type' ? '460px' : '768px'));

const tabOptions = computed(
	(): Array<{ value: Tab; label: string }> => [
		{ value: 'settings', label: i18n.baseText('settings.log-streaming.tab.settings') },
		{ value: 'events', label: i18n.baseText('settings.log-streaming.tab.events') },
	],
);

const testButtonTitle = computed(() => {
	if (testResult.value === 'success') {
		return i18n.baseText('settings.log-streaming.testEvent.success');
	}
	if (testResult.value === 'failure') {
		return i18n.baseText('settings.log-streaming.testEvent.failure');
	}
	return undefined;
});

const subscribedEvents = computed({
	get: () => draft.value.shared.subscribedEvents ?? [],
	set: (events: string[]) => {
		draft.value.shared.subscribedEvents = events;
	},
});

const anonymizeAuditMessages = computed({
	get: () => draft.value.shared.anonymizeAuditMessages ?? false,
	set: (value: boolean) => {
		draft.value.shared.anonymizeAuditMessages = value;
	},
});

function onContinue() {
	if (!selectedType.value) return;
	draft.value = toDraft(defaultDestinationFor(selectedType.value));
	snapshot.value = toDraft(defaultDestinationFor(selectedType.value));
	step.value = 'settings';
}

function onRename(label: string) {
	draft.value.shared.label = label;
}

function onParameterUpdate(path: string, value: NodeParameterValueType) {
	draft.value.parameters = applyParameterUpdate(draft.value.parameters, path, value);
}

function close() {
	uiStore.closeModal(props.modalName);
}

async function onSave() {
	saving.value = true;
	try {
		const saved = await logStreamingStore.saveDestination(toDestination(draft.value));
		draft.value = toDraft(saved);
		snapshot.value = toDraft(saved);
		isUnsaved.value = false;
		testResult.value = 'idle';
		toast.showMessage({
			title: i18n.baseText('settings.log-streaming.destinationSaved'),
			type: 'success',
		});
	} catch (error) {
		toast.showError(error, i18n.baseText('error'));
	} finally {
		saving.value = false;
	}
}

async function onSendTest() {
	const { id } = draft.value.shared;
	if (!id) return;
	testing.value = true;
	try {
		const ok = await logStreamingStore.sendTestMessage(id);
		testResult.value = ok ? 'success' : 'failure';
	} catch {
		testResult.value = 'failure';
	} finally {
		testing.value = false;
	}
	if (testResult.value === 'failure') {
		toast.showMessage({
			title: i18n.baseText('settings.log-streaming.testEvent.failure'),
			type: 'warning',
		});
	}
}

async function onDelete() {
	deleting.value = true;
	try {
		const deleted = await confirmAndDelete(toDestination(draft.value));
		if (deleted) close();
	} finally {
		deleting.value = false;
	}
}
</script>

<template>
	<Modal
		:name="props.modalName"
		:event-bus="props.eventBus"
		:width="width"
		data-test-id="destination-modal"
	>
		<template #header>
			<N8nHeading v-if="step === 'type'" tag="h1" size="xlarge">
				{{ i18n.baseText('settings.log-streaming.add') }}
			</N8nHeading>
			<div v-else :class="$style.header" data-test-id="subtitle-showing-type">
				<div :class="$style.name">
					<N8nInlineTextEdit
						:model-value="draft.shared.label ?? ''"
						:read-only="isManagedByEnv"
						:max-width="300"
						:placeholder="i18n.baseText('settings.log-streaming.destinationName.placeholder')"
						@update:model-value="onRename"
					/>
				</div>
				<N8nText size="small" color="text-light">{{ typeLabel }}</N8nText>
			</div>
		</template>

		<template #content>
			<div :class="$style.content">
				<N8nNotice v-if="isManagedByEnv" theme="warning" data-test-id="destination-managed-by-env">
					{{ i18n.baseText('settings.log-streaming.managedByEnv') }}
				</N8nNotice>

				<DestinationTypeSelect
					v-if="step === 'type'"
					v-model="selectedType"
					:disabled="isManagedByEnv"
				/>

				<template v-else>
					<N8nTabs v-model="activeTab" :options="tabOptions" />
					<template v-if="activeTab === 'settings'">
						<DestinationParametersForm
							v-if="destinationType"
							:type="destinationType"
							:parameters="draft.parameters"
							:read-only="isManagedByEnv"
							@update="onParameterUpdate"
						/>
					</template>
					<DestinationEventsForm
						v-else
						v-model:subscribed-events="subscribedEvents"
						v-model:anonymize-audit-messages="anonymizeAuditMessages"
						:read-only="isManagedByEnv"
					/>
				</template>
			</div>
		</template>

		<template #footer>
			<div v-if="step === 'type'" :class="$style.footer">
				<N8nButton
					:class="$style.primary"
					:disabled="!selectedType"
					:label="i18n.baseText('settings.log-streaming.continue')"
					data-test-id="select-destination-button"
					@click="onContinue"
				/>
			</div>
			<div v-else :class="$style.footer">
				<N8nButton
					v-if="!isUnsaved"
					variant="ghost"
					:disabled="isManagedByEnv || deleting"
					:label="i18n.baseText('settings.log-streaming.delete')"
					data-test-id="destination-delete-button"
					@click="onDelete"
				/>
				<div :class="$style.primary">
					<N8nButton
						v-if="canTest"
						variant="outline"
						:loading="testing"
						:disabled="testing"
						:title="testButtonTitle"
						:label="i18n.baseText('settings.log-streaming.sendTestEvent')"
						data-test-id="destination-test-button"
						@click="onSendTest"
					/>
					<div v-if="showSaveButton" data-test-id="destination-save-button">
						<N8nButton
							:loading="saving"
							:disabled="!canSave"
							:label="
								saving
									? i18n.baseText('settings.log-streaming.saving')
									: i18n.baseText('generic.save')
							"
							@click="onSave"
						/>
					</div>
				</div>
			</div>
		</template>
	</Modal>
</template>

<style lang="scss" module>
.header {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: var(--spacing--4xs);
	width: 100%;
}

.name {
	font-size: var(--font-size--xl);
	font-weight: var(--font-weight--bold);
	color: var(--text-color);
}

.content {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--s);
}

.footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--spacing--s);
}

.primary {
	display: flex;
	align-items: center;
	gap: var(--spacing--xs);
	margin-left: auto;
}
</style>
