import { createPinia, setActivePinia } from 'pinia';
import { useSettingsStore } from '@n8n/stores/settings.store';
import type { FrontendModuleSettings } from '@n8n/api-types';

import * as externalSecretsApi from './externalSecrets.api';
import { EXTERNAL_SECRET_MASK } from './externalSecrets.constants';
import { useExternalSecretsStore } from './externalSecrets.store';

vi.mock('./externalSecrets.api', () => ({
	getGlobalSecretsForProject: vi.fn(),
	getProjectSecrets: vi.fn(),
	getExternalSecretNames: vi.fn(),
}));

const PROJECT_SCOPED: FrontendModuleSettings = {
	'external-secrets': {
		multipleConnections: false,
		forProjects: true,
		roleBasedAccess: true,
		systemRolesEnabled: true,
	},
};

describe('externalSecrets store $secrets source', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
	});

	test('masks every secret name in the legacy instance-wide view', () => {
		const store = useExternalSecretsStore();
		store.state.secrets = { vault: ['apiKey', 'token'] };

		expect(store.secretsAsObject).toEqual({
			vault: { apiKey: EXTERNAL_SECRET_MASK, token: EXTERNAL_SECRET_MASK },
		});
	});

	test('merges global and project secrets when project-scoped connections are on', async () => {
		useSettingsStore().moduleSettings = PROJECT_SCOPED;
		vi.mocked(externalSecretsApi.getGlobalSecretsForProject).mockResolvedValue({
			awsGlobal: ['apikey'],
		});
		vi.mocked(externalSecretsApi.getProjectSecrets).mockResolvedValue({
			awsProject: ['projectsecret'],
		});

		const store = useExternalSecretsStore();
		store.state.secrets = { legacyOnly: ['ignored'] };
		await store.fetchSecretsForProject('project-1');

		expect(externalSecretsApi.getGlobalSecretsForProject).toHaveBeenCalledWith(
			expect.anything(),
			'project-1',
		);
		expect(store.secretsAsObject).toEqual({
			awsGlobal: { apikey: EXTERNAL_SECRET_MASK },
			awsProject: { projectsecret: EXTERNAL_SECRET_MASK },
		});
	});

	test('ignores project-scoped results while project-scoped connections are off', () => {
		const store = useExternalSecretsStore();
		store.state.globalSecrets = { awsGlobal: ['apikey'] };

		expect(store.secretsAsObject).toEqual({});
		expect(store.globalSecretsAsObject).toEqual({ awsGlobal: { apikey: EXTERNAL_SECRET_MASK } });
	});
});
