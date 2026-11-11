import { createTestingPinia } from '@pinia/testing';
import { useSettingsStore } from '@n8n/stores/settings.store';
import { mockedStore } from '@/__tests__/utils';

import { useEvaluationsLicense } from './useEvaluationsLicense';

describe('useEvaluationsLicense', () => {
	beforeEach(() => {
		createTestingPinia();
	});

	it('stays unresolved without rejecting when the settings fetch fails, and retries later', async () => {
		const settingsStore = mockedStore(useSettingsStore);
		settingsStore.getSettings.mockRejectedValueOnce(new Error('network down'));
		const license = useEvaluationsLicense();

		await expect(license.ensureLicenseLoaded()).resolves.toBeUndefined();
		expect(license.isResolved.value).toBe(false);

		settingsStore.getSettings.mockResolvedValueOnce(undefined);
		await license.ensureLicenseLoaded();
		expect(license.isResolved.value).toBe(true);
	});
});
