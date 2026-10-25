import { createTestingPinia } from '@pinia/testing';
import { screen, waitFor } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import {
	defaultMessageEventBusDestinationOptions,
	defaultMessageEventBusDestinationWebhookOptions,
	MessageEventBusDestinationTypeNames,
} from 'n8n-workflow';

import { createComponentRenderer } from '@/__tests__/render';
import { mockedStore } from '@/__tests__/utils';
import { LOG_STREAM_MODAL_KEY } from '@/app/constants';
import { useUIStore } from '@/app/stores/ui.store';

import { useLogStreamingStore } from '../logStreaming.store';
import type { MessageEventBusDestinationOptions } from '../logStreaming.types';
import EventDestinationSettingsModal from './EventDestinationSettingsModal.vue';

const showMessage = vi.fn();
const showError = vi.fn();
vi.mock('@n8n/composables/useToast', () => ({
	useToast: () => ({ showMessage, showError }),
}));

const confirmAndDelete = vi.fn();
vi.mock('../composables/useDestinationDelete', () => ({
	useDestinationDelete: () => ({ confirmAndDelete }),
}));

const existingWebhook: MessageEventBusDestinationOptions = {
	...defaultMessageEventBusDestinationWebhookOptions,
	id: 'dest-1',
	label: 'Existing webhook',
};

const renderModal = createComponentRenderer(EventDestinationSettingsModal, {
	global: {
		stubs: {
			// Render the slots directly, without the dialog's open-state and teleport machinery.
			Modal: {
				template:
					'<div role="dialog"><slot name="header" /><slot name="content" /><slot name="footer" /></div>',
			},
			DestinationTypeSelect: {
				template:
					'<button data-test-id="type-select-stub" @click="$emit(\'update:modelValue\', \'$$MessageEventBusDestinationWebhook\')" />',
			},
			DestinationParametersForm: {
				template:
					"<button data-test-id=\"parameters-form-stub\" @click=\"$emit('update', 'url', 'https://changed.example.com')\" />",
			},
		},
	},
});

function setup(destination: MessageEventBusDestinationOptions, isNew: boolean) {
	const pinia = createTestingPinia();
	const logStreamingStore = mockedStore(useLogStreamingStore);
	const uiStore = mockedStore(useUIStore);
	logStreamingStore.isManagedByEnv = false;
	renderModal({ pinia, props: { modalName: LOG_STREAM_MODAL_KEY, destination, isNew } });
	return { logStreamingStore, uiStore };
}

async function chooseWebhookType() {
	await userEvent.click(screen.getByTestId('type-select-stub'));
	await userEvent.click(screen.getByTestId('select-destination-button'));
}

describe('EventDestinationSettingsModal', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('new destination', () => {
		it('asks for a type before showing the settings', async () => {
			setup(defaultMessageEventBusDestinationOptions, true);

			expect(screen.getByTestId('select-destination-button')).toBeDisabled();
			expect(screen.queryByTestId('subtitle-showing-type')).not.toBeInTheDocument();

			await userEvent.click(screen.getByTestId('type-select-stub'));
			expect(screen.getByTestId('select-destination-button')).toBeEnabled();

			await userEvent.click(screen.getByTestId('select-destination-button'));
			expect(screen.getByTestId('subtitle-showing-type')).toHaveTextContent('Webhook');
			expect(screen.getByTestId('destination-save-button')).toBeInTheDocument();
			expect(screen.queryByTestId('destination-test-button')).not.toBeInTheDocument();
			expect(screen.queryByTestId('destination-delete-button')).not.toBeInTheDocument();
		});

		it('stays open after saving and offers to test the saved destination', async () => {
			const { logStreamingStore, uiStore } = setup(defaultMessageEventBusDestinationOptions, true);
			logStreamingStore.saveDestination.mockResolvedValue({
				...defaultMessageEventBusDestinationWebhookOptions,
				id: 'new-id',
			});

			await chooseWebhookType();
			const saveWrapper = screen.getByTestId('destination-save-button');
			const saveButton = saveWrapper.querySelector('button');
			expect(saveButton).not.toBeNull();
			if (saveButton) await userEvent.click(saveButton);

			expect(logStreamingStore.saveDestination).toHaveBeenCalledWith(
				expect.objectContaining({
					__type: MessageEventBusDestinationTypeNames.webhook,
					url: defaultMessageEventBusDestinationWebhookOptions.url,
				}),
			);
			expect(await screen.findByTestId('destination-test-button')).toBeInTheDocument();
			expect(screen.queryByTestId('destination-save-button')).not.toBeInTheDocument();
			expect(screen.getByTestId('destination-delete-button')).toBeInTheDocument();
			expect(uiStore.closeModal).not.toHaveBeenCalled();
		});
	});

	describe('existing destination', () => {
		it('only offers to save once something changed', async () => {
			setup(existingWebhook, false);

			expect(screen.getByTestId('subtitle-showing-type')).toBeInTheDocument();
			expect(screen.queryByTestId('destination-save-button')).not.toBeInTheDocument();

			await userEvent.click(screen.getByTestId('parameters-form-stub'));
			expect(screen.getByTestId('destination-save-button')).toBeInTheDocument();
		});

		it('reports a successful test event on the test button', async () => {
			const { logStreamingStore } = setup(existingWebhook, false);
			logStreamingStore.sendTestMessage.mockResolvedValue(true);

			await userEvent.click(screen.getByTestId('destination-test-button'));

			expect(logStreamingStore.sendTestMessage).toHaveBeenCalledWith('dest-1');
			await waitFor(() =>
				expect(screen.getByTestId('destination-test-button')).toHaveAttribute(
					'title',
					'Event sent and returned OK',
				),
			);
		});

		it('closes after the destination is deleted', async () => {
			const { uiStore } = setup(existingWebhook, false);
			confirmAndDelete.mockResolvedValue(true);

			await userEvent.click(screen.getByTestId('destination-delete-button'));

			expect(confirmAndDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'dest-1' }));
			await waitFor(() => expect(uiStore.closeModal).toHaveBeenCalledWith(LOG_STREAM_MODAL_KEY));
		});

		it('stays open when deletion is cancelled', async () => {
			const { uiStore } = setup(existingWebhook, false);
			confirmAndDelete.mockResolvedValue(false);

			await userEvent.click(screen.getByTestId('destination-delete-button'));

			await waitFor(() => expect(confirmAndDelete).toHaveBeenCalled());
			expect(uiStore.closeModal).not.toHaveBeenCalled();
		});
	});
});
