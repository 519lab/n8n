import { createTestingPinia } from '@pinia/testing';
import { waitFor } from '@testing-library/vue';
import { mockedStore } from '@/__tests__/utils';
import { createComponentRenderer } from '@/__tests__/render';
import WorkflowShareModal from '@/app/components/WorkflowShareModal.vue';
import { useWorkflowsListStore } from '@/app/stores/workflowsList.store';
import { useProjectsStore } from '@/features/collaboration/projects/projects.store';
import type { IWorkflowDb } from '@/Interface';

const ModalStub = {
	template: '<div><slot name="header" /><slot name="content" /><slot name="footer" /></div>',
};
const ProjectSharingStub = { template: '<div data-test-id="project-sharing-select" />' };

const renderComponent = createComponentRenderer(WorkflowShareModal, {
	props: { data: { id: 'wf-1' }, modalName: 'workflowShare' },
	global: { stubs: { Modal: ModalStub, ProjectSharing: ProjectSharingStub } },
});

const workflowIn = (
	homeProject: { id: string; type: 'personal' | 'team'; name: string },
	scopes: string[],
) =>
	({
		id: 'wf-1',
		name: 'Flow',
		homeProject,
		sharedWithProjects: [],
		scopes,
	}) as unknown as IWorkflowDb;

describe('WorkflowShareModal', () => {
	let workflowsListStore: ReturnType<typeof mockedStore<typeof useWorkflowsListStore>>;
	let projectsStore: ReturnType<typeof mockedStore<typeof useProjectsStore>>;

	beforeEach(() => {
		createTestingPinia();
		workflowsListStore = mockedStore(useWorkflowsListStore);
		projectsStore = mockedStore(useProjectsStore);
		projectsStore.personalProject = { id: 'personal-1' } as never;
		projectsStore.fetchProject.mockResolvedValue({ relations: [{}, {}] } as never);
	});

	it('lets a user with the share scope share a personal-space workflow', async () => {
		workflowsListStore.getWorkflowById.mockReturnValue(
			workflowIn({ id: 'personal-1', type: 'personal', name: 'Me' }, ['workflow:share']),
		);

		const { findByTestId, queryByTestId } = renderComponent();

		expect(await findByTestId('project-sharing-select')).toBeInTheDocument();
		expect(queryByTestId('workflow-sharing-modal-save-button')).toBeInTheDocument();
		expect(queryByTestId('workflow-share-personal-restricted')).not.toBeInTheDocument();
	});

	it('explains the restriction to the owner when personal sharing is turned off', async () => {
		workflowsListStore.getWorkflowById.mockReturnValue(
			workflowIn({ id: 'personal-1', type: 'personal', name: 'Me' }, ['workflow:read']),
		);

		const { findByTestId, queryByTestId } = renderComponent();

		expect(await findByTestId('workflow-share-personal-restricted')).toBeInTheDocument();
		expect(queryByTestId('project-sharing-select')).not.toBeInTheDocument();
	});

	it('shares a team-project workflow through membership, without a selector', async () => {
		workflowsListStore.getWorkflowById.mockReturnValue(
			workflowIn({ id: 'team-1', type: 'team', name: 'Ops' }, ['workflow:share']),
		);

		const { findByTestId, queryByTestId } = renderComponent();

		const info = await findByTestId('workflow-share-team-info');
		await waitFor(() => expect(projectsStore.fetchProject).toHaveBeenCalledWith('team-1'));
		expect(info).toBeInTheDocument();
		expect(queryByTestId('project-sharing-select')).not.toBeInTheDocument();
		expect(queryByTestId('workflow-sharing-modal-save-button')).not.toBeInTheDocument();
	});
});
