import { createTestingPinia } from '@pinia/testing';
import userEvent from '@testing-library/user-event';

import { createComponentRenderer } from '@/__tests__/render';
import { mockedStore } from '@/__tests__/utils';
import { useProjectsStore } from '@/features/collaboration/projects/projects.store';
import type { ProjectListItem } from '@/features/collaboration/projects/projects.types';

import SecretsProviderConnectionScope from './SecretsProviderConnectionScope.vue';

const renderComponent = createComponentRenderer(SecretsProviderConnectionScope);

const PROJECTS = [
	{ id: 'personal-1', name: 'Me', type: 'personal' },
	{ id: 'team-1', name: 'SecretProject', type: 'team' },
] as ProjectListItem[];

async function pick(label: string, getAllByText: (text: string) => HTMLElement[]) {
	const option = getAllByText(label).find((element) =>
		element.closest('.el-select-dropdown__item'),
	);
	await userEvent.click(option as HTMLElement);
}

describe('SecretsProviderConnectionScope', () => {
	beforeEach(() => {
		createTestingPinia();
		mockedStore(useProjectsStore).availableProjects = PROJECTS;
	});

	it('loads projects and emits a single project id when one is picked', async () => {
		const { getByTestId, getAllByText, queryByText, emitted } = renderComponent({
			props: { projectIds: [] },
		});

		expect(mockedStore(useProjectsStore).getAvailableProjects).toHaveBeenCalled();

		await userEvent.click(getByTestId('secrets-provider-scope-select'));
		expect(queryByText('Me')).toBeNull();
		await pick('SecretProject', getAllByText);

		expect(emitted('update:projectIds')).toEqual([[['team-1']]]);
	});

	it('emits an empty list for Global', async () => {
		const { getByTestId, getAllByText, emitted } = renderComponent({
			props: { projectIds: ['team-1'] },
		});

		await userEvent.click(getByTestId('secrets-provider-scope-select'));
		await pick('Global', getAllByText);

		expect(emitted('update:projectIds')).toEqual([[[]]]);
	});
});
