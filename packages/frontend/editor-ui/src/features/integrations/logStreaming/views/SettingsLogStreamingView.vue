<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from '@n8n/i18n';
import { useToast } from '@n8n/composables/useToast';
import { N8nButton, N8nEmptyState, N8nHeading, N8nNotice, N8nText } from '@n8n/design-system';
import { defaultMessageEventBusDestinationOptions, deepCopy } from 'n8n-workflow';

import { useDocumentTitle } from '@/app/composables/useDocumentTitle';
import { usePageRedirectionHelper } from '@/app/composables/usePageRedirectionHelper';
import { LOG_STREAM_MODAL_KEY } from '@/app/constants';
import { useUIStore } from '@/app/stores/ui.store';

import EventDestinationCard from '../components/EventDestinationCard.vue';
import { useDestinationDelete } from '../composables/useDestinationDelete';
import { useLogStreamingStore } from '../logStreaming.store';
import type { MessageEventBusDestinationOptions } from '../logStreaming.types';

const i18n = useI18n();
const toast = useToast();
const documentTitle = useDocumentTitle();
const pageRedirectionHelper = usePageRedirectionHelper();
const uiStore = useUIStore();
const logStreamingStore = useLogStreamingStore();
const { confirmAndDelete } = useDestinationDelete();

// Nothing is rendered for the licensed view until the first fetch settles, so
// the empty state never flashes before existing destinations appear.
const loaded = ref(false);

const isEnabled = computed(() => logStreamingStore.isEnterpriseLogStreamingEnabled);
const isManagedByEnv = computed(() => logStreamingStore.isManagedByEnv);
const destinations = computed(() => logStreamingStore.destinations);
const hasDestinations = computed(() => logStreamingStore.hasDestinations);

function goToUpgrade() {
	void pageRedirectionHelper.goToUpgrade('log-streaming', 'upgrade-log-streaming');
}

function openModal(destination: MessageEventBusDestinationOptions, isNew: boolean) {
	uiStore.openModalWithData({
		name: LOG_STREAM_MODAL_KEY,
		data: { destination: deepCopy(destination), isNew },
	});
}

function addDestination() {
	// the modal starts at type selection and replaces these defaults with the chosen type's
	openModal(defaultMessageEventBusDestinationOptions, true);
}

function openDestination(destination: MessageEventBusDestinationOptions) {
	openModal(destination, false);
}

async function toggleDestination(destination: MessageEventBusDestinationOptions, enabled: boolean) {
	try {
		await logStreamingStore.saveDestination({ ...destination, enabled });
	} catch (error) {
		toast.showError(error, i18n.baseText('error'));
	}
}

async function deleteDestination(destination: MessageEventBusDestinationOptions) {
	await confirmAndDelete(destination);
}

async function loadDestinations() {
	try {
		await logStreamingStore.fetchDestinations();
	} catch (error) {
		toast.showError(error, i18n.baseText('error'));
	} finally {
		loaded.value = true;
	}
}

onMounted(async () => {
	documentTitle.set(i18n.baseText('settings.log-streaming.heading'));
	if (!isEnabled.value) return;
	await loadDestinations();
});
</script>

<template>
	<div :class="$style.container" data-test-id="log-streaming-settings">
		<N8nHeading tag="h1" size="2xlarge">
			{{ i18n.baseText('settings.log-streaming.heading') }}
		</N8nHeading>

		<N8nEmptyState
			v-if="!isEnabled"
			:description="i18n.baseText('settings.log-streaming.actionBox.description')"
			:button-text="i18n.baseText('settings.log-streaming.actionBox.button')"
			data-test-id="action-box-unlicensed"
			@click:button="goToUpgrade"
		>
			<template #heading>
				<span>{{ i18n.baseText('settings.log-streaming.actionBox.title') }}</span>
			</template>
		</N8nEmptyState>

		<div v-else-if="loaded" :class="$style.content">
			<N8nText :class="$style.info" tag="div" size="medium" color="text-base">
				<span v-n8n-html="i18n.baseText('settings.log-streaming.infoText')" />
			</N8nText>

			<N8nNotice v-if="isManagedByEnv" theme="warning" data-test-id="log-streaming-managed-by-env">
				{{ i18n.baseText('settings.log-streaming.managedByEnv') }}
			</N8nNotice>

			<!-- Exactly one add button is rendered in each state: here, or in the list header. -->
			<N8nEmptyState
				v-if="!hasDestinations"
				:heading="i18n.baseText('settings.log-streaming.addFirstTitle')"
				:description="i18n.baseText('settings.log-streaming.addFirst')"
				:button-text="i18n.baseText('settings.log-streaming.add')"
				:button-disabled="isManagedByEnv"
				data-test-id="action-box-licensed"
				@click:button="addDestination"
			/>

			<div v-else :class="$style.destinations">
				<div :class="$style.destinationsHeader">
					<N8nHeading tag="h2" size="large">
						{{ i18n.baseText('settings.log-streaming.destinations') }}
					</N8nHeading>
					<N8nButton
						:disabled="isManagedByEnv"
						:label="i18n.baseText('settings.log-streaming.add')"
						data-test-id="log-streaming-add-destination"
						@click="addDestination"
					/>
				</div>

				<EventDestinationCard
					v-for="destination in destinations"
					:key="destination.id"
					:destination="destination"
					:read-only="isManagedByEnv"
					@open="openDestination(destination)"
					@delete="deleteDestination(destination)"
					@toggle="(enabled: boolean) => toggleDestination(destination, enabled)"
				/>
			</div>
		</div>
	</div>
</template>

<style lang="scss" module>
.container {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--l);
	padding-bottom: var(--spacing--2xl);
}

.content {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--m);
}

.info {
	line-height: var(--line-height--xl);
}

.destinations {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--xs);
}

.destinationsHeader {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--spacing--s);
	margin-bottom: var(--spacing--xs);
}
</style>
