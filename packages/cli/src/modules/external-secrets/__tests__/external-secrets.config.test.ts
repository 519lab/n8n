import { Container } from '@n8n/di';

import { ExternalSecretsConfig } from '../external-secrets.config';

/**
 * Pins the env names. The project-scoped flag's name is fixed by the Playwright
 * `external-secrets` capability; the multiple-connections flag follows the same
 * `N8N_ENV_FEAT_` form so both opt-ins read alike.
 */
describe('ExternalSecretsConfig', () => {
	beforeEach(() => {
		Container.reset();
	});

	afterEach(() => {
		delete process.env.N8N_EXTERNAL_SECRETS_UPDATE_INTERVAL;
		delete process.env.N8N_ENV_FEAT_EXTERNAL_SECRETS_FOR_PROJECTS;
		delete process.env.N8N_ENV_FEAT_EXTERNAL_SECRETS_MULTIPLE_CONNECTIONS;
		delete process.env.N8N_EXTERNAL_SECRETS_FOR_PROJECTS;
		delete process.env.N8N_EXTERNAL_SECRETS_MULTIPLE_CONNECTIONS;
	});

	it('defaults to a 300s poll and both connection modes off', () => {
		const config = Container.get(ExternalSecretsConfig);

		expect(config.updateInterval).toBe(300);
		expect(config.externalSecretsForProjects).toBe(false);
		expect(config.externalSecretsMultipleConnections).toBe(false);
	});

	it('reads each field from its environment variable', () => {
		process.env.N8N_EXTERNAL_SECRETS_UPDATE_INTERVAL = '60';
		process.env.N8N_ENV_FEAT_EXTERNAL_SECRETS_FOR_PROJECTS = 'true';
		process.env.N8N_ENV_FEAT_EXTERNAL_SECRETS_MULTIPLE_CONNECTIONS = 'true';

		const config = Container.get(ExternalSecretsConfig);

		expect(config.updateInterval).toBe(60);
		expect(config.externalSecretsForProjects).toBe(true);
		expect(config.externalSecretsMultipleConnections).toBe(true);
	});

	it('no longer reads the unprefixed names', () => {
		process.env.N8N_EXTERNAL_SECRETS_FOR_PROJECTS = 'true';
		process.env.N8N_EXTERNAL_SECRETS_MULTIPLE_CONNECTIONS = 'true';

		const config = Container.get(ExternalSecretsConfig);

		expect(config.externalSecretsForProjects).toBe(false);
		expect(config.externalSecretsMultipleConnections).toBe(false);
	});
});
