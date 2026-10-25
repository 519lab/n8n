import { createTestingPinia } from '@pinia/testing';
import { screen, waitFor } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { MessageEventBusDestinationTypeNames } from 'n8n-workflow';

import { createComponentRenderer } from '@/__tests__/render';
import { mockedStore } from '@/__tests__/utils';
import { LOG_STREAM_MODAL_KEY } from '@/app/constants';
import { useUIStore } from '@/app/stores/ui.store';

import { useLogStreamingStore } from '../logStreaming.store';
import SettingsLogStreamingView from './SettingsLogStreamingView.vue';

vi.mock('@/app/composables/useDocumentTitle', () => ({
	useDocumentTitle: () => ({ set: vi.fn() }),
}));

const goToUpgrade = vi.fn();
vi.mock('@/app/composables/usePageRedirectionHelper', () => ({
	usePageRedirectionHelper: () => ({ goToUpgrade }),
}));

const webhook = {
	__type: MessageEventBusDestinationTypeNames.webhook,
	id: 'dest-1',
	label: 'My webhook',
	enabled: true,
	url: 'https://example.com',
};

const renderView = createComponentRenderer(SettingsLogStreamingView);

function setup({ licensed = true, destinations = [webhook] } = {}) {
	const pinia = createTestingPinia();
	const logStreamingStore = mockedStore(useLogStreamingStore);
	const uiStore = mockedStore(useUIStore);
	logStreamingStore.isEnterpriseLogStreamingEnabled = licensed;
	logStreamingStore.isManagedByEnv = false;
	logStreamingStore.destinations = destinations;
	logStreamingStore.hasDestinations = destinations.length > 0;
	logStreamingStore.fetchDestinations.mockResolvedValue(destinations);
	logStreamingStore.saveDestination.mockResolvedValue(webhook);
	return { logStreamingStore, uiStore, ...renderView({ pinia }) };
}

describe('SettingsLogStreamingView', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('shows only the unlicensed action box when the feature is disabled', () => {
		const { logStreamingStore } = setup({ licensed: false });

		const box = screen.getByTestId('action-box-unlicensed');
		expect(box.querySelectorAll('button')).toHaveLength(1);
		expect(screen.queryByTestId('action-box-licensed')).not.toBeInTheDocument();
		expect(logStreamingStore.fetchDestinations).not.toHaveBeenCalled();
	});

	it('shows the licensed action box with one add button when there are no destinations', async () => {
		const { uiStore } = setup({ destinations: [] });

		const box = await screen.findByTestId('action-box-licensed');
		const buttons = box.querySelectorAll('button');
		expect(buttons).toHaveLength(1);
		expect(screen.getAllByRole('button', { name: 'Add new destination' })).toHaveLength(1);

		await userEvent.click(buttons[0]);
		expect(uiStore.openModalWithData).toHaveBeenCalledWith(
			expect.objectContaining({
				name: LOG_STREAM_MODAL_KEY,
				data: expect.objectContaining({ isNew: true }),
			}),
		);
	});

	it('lists destinations as cards with a single add button', async () => {
		setup();

		expect(await screen.findAllByTestId('destination-card')).toHaveLength(1);
		expect(screen.queryByTestId('action-box-licensed')).not.toBeInTheDocument();
		expect(screen.getAllByRole('button', { name: 'Add new destination' })).toHaveLength(1);
		expect(screen.getByText('My webhook')).toBeInTheDocument();
	});

	it('opens an existing destination when its card is clicked', async () => {
		const { uiStore } = setup();

		await userEvent.click(await screen.findByTestId('destination-card'));

		expect(uiStore.openModalWithData).toHaveBeenCalledWith({
			name: LOG_STREAM_MODAL_KEY,
			data: { destination: webhook, isNew: false },
		});
	});

	it('saves the enabled state from the card switch without opening the destination', async () => {
		const { logStreamingStore, uiStore } = setup();

		await userEvent.click(await screen.findByTestId('workflow-activate-switch'));

		await waitFor(() =>
			expect(logStreamingStore.saveDestination).toHaveBeenCalledWith({
				...webhook,
				enabled: false,
			}),
		);
		expect(uiStore.openModalWithData).not.toHaveBeenCalled();
	});
});
