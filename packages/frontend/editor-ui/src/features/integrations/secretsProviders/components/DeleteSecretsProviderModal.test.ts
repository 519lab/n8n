import { nextTick } from 'vue';
import { createTestingPinia, type TestingPinia } from '@pinia/testing';
import userEvent from '@testing-library/user-event';
import { waitFor } from '@testing-library/vue';

import { createComponentRenderer } from '@/__tests__/render';
import { mockedStore } from '@/__tests__/utils';
import { useUIStore } from '@/app/stores/ui.store';
import { DELETE_SECRETS_PROVIDER_MODAL_KEY } from '@/app/constants';

import DeleteSecretsProviderModal from './DeleteSecretsProviderModal.vue';

const deleteConnection = vi.hoisted(() => vi.fn());

vi.mock('../composables/useSecretsProviderConnection', () => ({
	useSecretsProviderConnection: () => ({ deleteConnection }),
}));

const renderComponent = createComponentRenderer(DeleteSecretsProviderModal);

async function renderModal(data: Record<string, unknown> = {}) {
	const rendered = renderComponent({
		pinia,
		props: {
			modalName: DELETE_SECRETS_PROVIDER_MODAL_KEY,
			data: { providerKey: 'awsGlobal', name: 'awsGlobal', secretsCount: 1, ...data },
		},
	});
	// Element Plus renders the dialog body once the open state applies.
	await nextTick();
	return rendered;
}

let pinia: TestingPinia;

describe('DeleteSecretsProviderModal', () => {
	beforeEach(() => {
		pinia = createTestingPinia();
		mockedStore(useUIStore).modalsById = { [DELETE_SECRETS_PROVIDER_MODAL_KEY]: { open: true } };
		deleteConnection.mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('renders under the default modal test id', async () => {
		const { getByTestId } = await renderModal();

		expect(getByTestId(`${DELETE_SECRETS_PROVIDER_MODAL_KEY}-modal`)).toBeInTheDocument();
	});

	it('enables delete only once the exact name is typed', async () => {
		const onDeleted = vi.fn();
		const { getByTestId } = await renderModal({ onDeleted });
		const confirmButton = getByTestId('confirm-delete-button');

		await userEvent.type(getByTestId('delete-confirmation-input'), 'awsGlob');
		expect(confirmButton).toBeDisabled();

		await userEvent.type(getByTestId('delete-confirmation-input'), 'al');
		expect(confirmButton).toBeEnabled();

		await userEvent.click(confirmButton);

		await waitFor(() => expect(onDeleted).toHaveBeenCalled());
		expect(deleteConnection).toHaveBeenCalledWith('awsGlobal');
	});

	it('describes the secrets that will be removed', async () => {
		const { getByText } = await renderModal({ secretsCount: 1 });

		expect(getByText(/1 secret/)).toBeInTheDocument();
	});
});
