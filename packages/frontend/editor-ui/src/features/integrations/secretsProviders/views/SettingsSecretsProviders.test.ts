import { createTestingPinia } from '@pinia/testing';
import userEvent from '@testing-library/user-event';
import { waitFor, within } from '@testing-library/vue';
import type { SecretProviderConnectionListItem } from '@n8n/api-types';

import { createComponentRenderer } from '@/__tests__/render';
import { mockedStore } from '@/__tests__/utils';
import { useUIStore } from '@/app/stores/ui.store';
import {
	DELETE_SECRETS_PROVIDER_MODAL_KEY,
	SECRETS_PROVIDER_CONNECTION_MODAL_KEY,
} from '@/app/constants';

import { useExternalSecretsStore } from '../../externalSecrets/externalSecrets.store';
import * as secretsProvidersApi from '../secretsProviders.api';
import SettingsSecretsProviders from './SettingsSecretsProviders.vue';

vi.mock('@/app/composables/usePageRedirectionHelper', () => ({
	usePageRedirectionHelper: () => ({ goToUpgrade: vi.fn() }),
}));

vi.mock('../secretsProviders.api', () => ({
	getConnections: vi.fn(),
	getProviderTypes: vi.fn(),
}));

const connection = (
	name: string,
	projects: SecretProviderConnectionListItem['projects'],
): SecretProviderConnectionListItem => ({
	id: name,
	name,
	type: 'awsSecretsManager',
	state: 'connected',
	isEnabled: true,
	projects,
	secretsCount: 1,
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z',
});

const renderComponent = createComponentRenderer(SettingsSecretsProviders);

describe('SettingsSecretsProviders', () => {
	beforeEach(() => {
		createTestingPinia();
		mockedStore(useExternalSecretsStore).isEnterpriseExternalSecretsEnabled = true;
		vi.mocked(secretsProvidersApi.getProviderTypes).mockResolvedValue([
			{
				type: 'awsSecretsManager',
				displayName: 'AWS Secrets Manager',
				icon: 'aws',
				properties: [],
			},
		]);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('shows the loading skeleton inside the licensed area, then the empty state', async () => {
		let resolveConnections: (value: SecretProviderConnectionListItem[]) => void = () => {};
		vi.mocked(secretsProvidersApi.getConnections).mockReturnValue(
			new Promise((resolve) => {
				resolveConnections = resolve;
			}),
		);

		const { getByTestId, queryByTestId } = renderComponent();

		const licensed = getByTestId('secrets-provider-connections-content-licensed');
		expect(within(licensed).getByTestId('secrets-providers-loading')).toBeInTheDocument();
		expect(queryByTestId('secrets-provider-connections-empty-state')).not.toBeInTheDocument();

		resolveConnections([]);

		await waitFor(() => expect(queryByTestId('secrets-providers-loading')).not.toBeInTheDocument());
		expect(
			within(licensed).getByTestId('secrets-provider-connections-empty-state'),
		).toBeInTheDocument();
	});

	it('opens the connection modal from the empty-state button', async () => {
		vi.mocked(secretsProvidersApi.getConnections).mockResolvedValue([]);

		const { findByTestId } = renderComponent();
		const emptyState = await findByTestId('secrets-provider-connections-empty-state');
		await userEvent.click(within(emptyState).getByRole('button'));

		expect(mockedStore(useUIStore).openModalWithData).toHaveBeenCalledWith(
			expect.objectContaining({
				name: SECRETS_PROVIDER_CONNECTION_MODAL_KEY,
				data: expect.objectContaining({ activeTab: 'connection', providerKey: undefined }),
			}),
		);
	});

	it('badges each card by scope', async () => {
		vi.mocked(secretsProvidersApi.getConnections).mockResolvedValue([
			connection('awsGlobal', []),
			connection('awsProject', [{ id: 'p1', name: 'SecretProject' }]),
		]);

		const { findAllByTestId } = renderComponent();
		const cards = await findAllByTestId('secrets-provider-connection-card');

		expect(within(cards[0]).getByTestId('secrets-provider-name')).toHaveTextContent('awsGlobal');
		expect(within(cards[0]).getByTestId('secrets-provider-global-badge')).toBeInTheDocument();
		expect(within(cards[0]).queryByTestId('secrets-provider-project-badge')).toBeNull();

		expect(within(cards[1]).getByTestId('secrets-provider-project-badge')).toHaveTextContent(
			'SecretProject',
		);
		expect(within(cards[1]).getByTestId('secrets-provider-action-toggle')).toBeInTheDocument();
	});

	it('offers Edit, Share and Delete, and Delete opens the delete modal', async () => {
		vi.mocked(secretsProvidersApi.getConnections).mockResolvedValue([connection('awsGlobal', [])]);

		const { findByTestId } = renderComponent();
		const toggle = await findByTestId('secrets-provider-action-toggle');
		const toggleButton = within(toggle).getByRole('button');
		await userEvent.click(toggleButton);

		const dropdown = document.getElementById(
			toggleButton.getAttribute('aria-controls') ?? '',
		) as HTMLElement;
		expect(within(dropdown).getByText('Edit')).toBeInTheDocument();
		expect(within(dropdown).getByText('Share')).toBeInTheDocument();

		await userEvent.click(within(dropdown).getByText('Delete'));

		expect(mockedStore(useUIStore).openModalWithData).toHaveBeenCalledWith(
			expect.objectContaining({
				name: DELETE_SECRETS_PROVIDER_MODAL_KEY,
				data: expect.objectContaining({ providerKey: 'awsGlobal', secretsCount: 1 }),
			}),
		);
	});

	it('shows the upgrade state and fetches nothing when unlicensed', async () => {
		mockedStore(useExternalSecretsStore).isEnterpriseExternalSecretsEnabled = false;

		const { getByTestId, queryByTestId } = renderComponent();

		expect(getByTestId('secrets-provider-connections-content-unlicensed')).toBeInTheDocument();
		expect(queryByTestId('secrets-provider-connections-content-licensed')).toBeNull();
		expect(secretsProvidersApi.getConnections).not.toHaveBeenCalled();
	});
});
