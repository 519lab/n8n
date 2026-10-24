<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useI18n } from '@n8n/i18n';
import { useToast } from '@n8n/composables/useToast';
import { createEventBus } from '@n8n/utils/event-bus';

import Modal from '@/app/components/Modal.vue';
import { useUIStore } from '@/app/stores/ui.store';
import { DELETE_SECRETS_PROVIDER_MODAL_KEY } from '@/app/constants';
import { N8nButton, N8nInput, N8nInputLabel, N8nText } from '@n8n/design-system';

import { useSecretsProviderConnection } from '../composables/useSecretsProviderConnection';

const props = defineProps<{
	modalName: string;
	data: {
		providerKey: string;
		name: string;
		/** How many secrets the vault currently exposes; credentials using them stop resolving. */
		secretsCount?: number;
		projectId?: string;
		onDeleted?: () => Promise<void> | void;
		onClose?: () => void;
	};
}>();

const i18n = useI18n();
const toast = useToast();
const uiStore = useUIStore();
const connection = useSecretsProviderConnection(props.data.projectId);

const modalBus = createEventBus();
const confirmText = ref('');
const isDeleting = ref(false);

const secretsCount = computed(() => props.data.secretsCount ?? 0);
const canDelete = computed(() => confirmText.value === props.data.name && !isDeleting.value);

const title = computed(() =>
	i18n.baseText('settings.secretsProviderConnections.delete.title', {
		interpolate: { name: props.data.name },
	}),
);

const description = computed(() => {
	if (secretsCount.value === 0) {
		return i18n.baseText('settings.secretsProviderConnections.delete.description.noImpact');
	}
	const secrets =
		secretsCount.value === 1
			? i18n.baseText('settings.secretsProviderConnections.oneSecret')
			: i18n.baseText('settings.secretsProviderConnections.secrets', {
					interpolate: { count: String(secretsCount.value) },
				});
	return i18n.baseText('settings.secretsProviderConnections.delete.description', {
		interpolate: { secretsCount: secrets },
	});
});

function onBeforeClose(): boolean {
	props.data.onClose?.();
	return true;
}

function closeModal() {
	modalBus.emit('close');
}

async function onDelete() {
	if (!canDelete.value) return;
	isDeleting.value = true;
	try {
		await connection.deleteConnection(props.data.providerKey);
		toast.showMessage({
			title: i18n.baseText('settings.secretsProviderConnections.delete.success', {
				interpolate: { name: props.data.name },
			}),
			type: 'success',
		});
		await props.data.onDeleted?.();
		uiStore.closeModal(DELETE_SECRETS_PROVIDER_MODAL_KEY);
	} catch (error) {
		toast.showError(error, i18n.baseText('settings.secretsProviderConnections.delete.error'));
	} finally {
		isDeleting.value = false;
	}
}
</script>

<template>
	<!-- No explicit data-test-id: Modal derives `${name}-modal`, which the E2E page object targets. -->
	<Modal
		:name="modalName"
		:event-bus="modalBus"
		:before-close="onBeforeClose"
		:title="title"
		:center="true"
		width="480px"
	>
		<template #content>
			<div :class="$style.content">
				<N8nText>{{ description }}</N8nText>

				<N8nInputLabel
					:label="
						i18n.baseText('settings.secretsProviderConnections.delete.confirmationLabel', {
							interpolate: { name: data.name },
						})
					"
					:bold="false"
				>
					<N8nInput v-model="confirmText" data-test-id="delete-confirmation-input" />
				</N8nInputLabel>
			</div>
		</template>
		<template #footer>
			<div :class="$style.footer">
				<N8nButton
					variant="subtle"
					data-test-id="delete-secrets-provider-cancel-button"
					@click="closeModal"
				>
					{{ i18n.baseText('generic.cancel') }}
				</N8nButton>
				<N8nButton
					variant="destructive"
					:loading="isDeleting"
					:disabled="!canDelete"
					data-test-id="confirm-delete-button"
					@click="onDelete"
				>
					{{ i18n.baseText('generic.delete') }}
				</N8nButton>
			</div>
		</template>
	</Modal>
</template>

<style lang="scss" module>
.content {
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
