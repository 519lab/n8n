import { nextTick } from 'vue';
import { createTestingPinia, type TestingPinia } from '@pinia/testing';
import userEvent from '@testing-library/user-event';
import { waitFor } from '@testing-library/vue';
import { defineComponent } from 'vue';
import type { SecretProviderConnection, SecretProviderTypeResponse } from '@n8n/api-types';
import { useRBACStore } from '@n8n/stores/rbac.store';
import { useSettingsStore } from '@n8n/stores/settings.store';

import { createComponentRenderer } from '@/__tests__/render';
import { useUIStore } from '@/app/stores/ui.store';
import { mockedStore } from '@/__tests__/utils';
import { SECRETS_PROVIDER_CONNECTION_MODAL_KEY } from '@/app/constants';

import SecretsProviderConnectionModal from './SecretsProviderConnectionModal.vue';

const api = vi.hoisted(() => ({
	getConnection: vi.fn(),
	createConnection: vi.fn(),
	updateConnection: vi.fn(),
	deleteConnection: vi.fn(),
	testConnection: vi.fn(),
}));

vi.mock('../composables/useSecretsProviderConnection', async () => {
	const { ref } = await import('vue');
	return {
		useSecretsProviderConnection: () => ({
			...api,
			isTesting: ref(false),
			isLoading: ref(false),
			connectionState: ref('idle'),
			connectionError: ref(undefined),
		}),
	};
});

/** Stands in for the ParameterInputExpanded-based form; one click edits `region`. */
const FieldsStub = defineComponent({
	props: { properties: { type: Array, required: true }, values: { type: Object, required: true } },
	emits: ['update'],
	template:
		"<button data-test-id=\"fields-stub\" @click=\"$emit('update', 'region', 'eu-west-1')\">fields</button>",
});

const AWS_TYPE: SecretProviderTypeResponse = {
	type: 'awsSecretsManager',
	displayName: 'AWS Secrets Manager',
	icon: 'aws',
	properties: [{ name: 'region', displayName: 'Region', type: 'string', default: '' }],
};

const saved = (overrides: Partial<SecretProviderConnection> = {}): SecretProviderConnection => ({
	id: '1',
	name: 'awsGlobal',
	type: 'awsSecretsManager',
	state: 'connected',
	isEnabled: true,
	projects: [],
	settings: {},
	secretsCount: 2,
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z',
	...overrides,
});

const renderComponent = createComponentRenderer(SecretsProviderConnectionModal, {
	global: { stubs: { SecretsProviderConnectionFields: FieldsStub } },
});

async function renderModal(data: Record<string, unknown> = {}) {
	const rendered = renderComponent({
		pinia,
		props: {
			modalName: SECRETS_PROVIDER_CONNECTION_MODAL_KEY,
			data: { providerTypes: [AWS_TYPE], existingProviderNames: [], ...data },
		},
	});
	// Element Plus renders the dialog body once the open state applies.
	await nextTick();
	return rendered;
}

async function fillCreateForm(
	getByTestId: (id: string) => HTMLElement,
	getAllByText: (text: string) => HTMLElement[],
) {
	await userEvent.type(getByTestId('provider-name'), 'awsGlobal');
	await userEvent.click(getByTestId('provider-type-select'));
	const option = getAllByText('AWS Secrets Manager').find((element) =>
		element.closest('.el-select-dropdown__item'),
	);
	await userEvent.click(option as HTMLElement);
}

let pinia: TestingPinia;

describe('SecretsProviderConnectionModal', () => {
	beforeEach(() => {
		pinia = createTestingPinia();
		mockedStore(useUIStore).modalsById = {
			[SECRETS_PROVIDER_CONNECTION_MODAL_KEY]: { open: true },
		};
		mockedStore(useSettingsStore).moduleSettings = {
			'external-secrets': {
				multipleConnections: false,
				forProjects: true,
				roleBasedAccess: true,
				systemRolesEnabled: true,
			},
		};
		mockedStore(useRBACStore).hasScope.mockReturnValue(true);
		api.createConnection.mockResolvedValue(saved());
		api.updateConnection.mockResolvedValue(saved());
		api.testConnection.mockResolvedValue({ success: true, testState: 'connected' });
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('creates, stays open in edit mode and shows the test success callout', async () => {
		const { getByTestId, getAllByText, findByTestId, queryByTestId } = await renderModal();

		expect(queryByTestId('sidebar-item-sharing')).toBeNull();
		await fillCreateForm(getByTestId, getAllByText);
		await userEvent.click(getByTestId('secrets-provider-connection-save-button'));

		expect(await findByTestId('connection-success-callout')).toBeInTheDocument();
		expect(api.createConnection).toHaveBeenCalledWith({
			providerKey: 'awsGlobal',
			type: 'awsSecretsManager',
			projectIds: [],
			settings: { region: '' },
		});
		expect(api.testConnection).toHaveBeenCalledWith('awsGlobal');
		expect(getByTestId('provider-name')).toBeDisabled();
		expect(getByTestId('sidebar-item-sharing')).toBeInTheDocument();
	});

	it('updates on the second save and only re-sends settings that changed', async () => {
		const { getByTestId, getAllByText, findByTestId } = await renderModal();

		await fillCreateForm(getByTestId, getAllByText);
		await userEvent.click(getByTestId('secrets-provider-connection-save-button'));
		await findByTestId('connection-success-callout');

		await userEvent.click(getByTestId('secrets-provider-connection-save-button'));
		await waitFor(() =>
			expect(api.updateConnection).toHaveBeenLastCalledWith('awsGlobal', {
				type: 'awsSecretsManager',
				projectIds: [],
			}),
		);

		await userEvent.click(getByTestId('fields-stub'));
		await userEvent.click(getByTestId('secrets-provider-connection-save-button'));
		await waitFor(() =>
			expect(api.updateConnection).toHaveBeenLastCalledWith('awsGlobal', {
				type: 'awsSecretsManager',
				projectIds: [],
				settings: { region: 'eu-west-1' },
			}),
		);
		expect(api.createConnection).toHaveBeenCalledTimes(1);
	});

	it('shows the error banner with the reason when the test fails', async () => {
		api.testConnection.mockResolvedValue({
			success: false,
			testState: 'error',
			error: 'Invalid region',
		});
		const { getByTestId, getAllByText, findByTestId, queryByTestId } = await renderModal();

		await fillCreateForm(getByTestId, getAllByText);
		await userEvent.click(getByTestId('secrets-provider-connection-save-button'));

		expect(await findByTestId('connection-error-banner')).toHaveTextContent('Invalid region');
		expect(queryByTestId('connection-success-callout')).toBeNull();
	});

	it('calls onClose when cancelled', async () => {
		const onClose = vi.fn();
		const { getByTestId } = await renderModal({ onClose });

		await userEvent.click(getByTestId('secrets-provider-connection-cancel-button'));

		await waitFor(() => expect(onClose).toHaveBeenCalled());
	});

	it('opens an existing connection on the sharing tab', async () => {
		api.getConnection.mockResolvedValue(saved({ projects: [{ id: 'p1', name: 'SecretProject' }] }));
		const { findByTestId, queryByTestId } = await renderModal({
			providerKey: 'awsGlobal',
			activeTab: 'sharing',
		});

		expect(await findByTestId('secrets-provider-scope-select')).toBeInTheDocument();
		expect(queryByTestId('provider-name')).toBeNull();
		expect(api.getConnection).toHaveBeenCalledWith('awsGlobal');
	});

	it('never offers sharing from a project context', async () => {
		api.getConnection.mockResolvedValue(saved());
		const { findByTestId, queryByTestId } = await renderModal({
			providerKey: 'awsGlobal',
			activeTab: 'sharing',
			projectId: 'p1',
		});

		expect(await findByTestId('provider-name')).toBeInTheDocument();
		expect(queryByTestId('sidebar-item-sharing')).toBeNull();
	});
});
