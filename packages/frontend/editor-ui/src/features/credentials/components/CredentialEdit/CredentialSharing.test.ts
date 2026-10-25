import { createTestingPinia } from '@pinia/testing';
import { createEventBus } from '@n8n/utils/event-bus';
import { mockedStore } from '@/__tests__/utils';
import { createComponentRenderer } from '@/__tests__/render';
import { useProjectsStore } from '@/features/collaboration/projects/projects.store';
import type { ICredentialsResponse } from '@/features/credentials/credentials.types';
import CredentialSharing from './CredentialSharing.vue';

const ProjectSharingStub = { template: '<div data-test-id="project-sharing-select" />' };

const renderComponent = createComponentRenderer(CredentialSharing, {
	global: { stubs: { ProjectSharing: ProjectSharingStub } },
});

const credentialIn = (homeProject: { id: string; type: 'personal' | 'team'; name: string }) =>
	({
		id: 'cred-1',
		name: 'Cred',
		homeProject,
		sharedWithProjects: [],
	}) as unknown as ICredentialsResponse;

const render = (homeProjectId: string, canShare: boolean) =>
	renderComponent({
		props: {
			credential: credentialIn({ id: homeProjectId, type: 'personal', name: 'Me' }),
			credentialData: {},
			credentialId: 'cred-1',
			credentialPermissions: { share: canShare },
			isSharedGlobally: false,
			modalBus: createEventBus(),
		},
	});

describe('CredentialSharing', () => {
	beforeEach(() => {
		createTestingPinia();
		mockedStore(useProjectsStore).personalProject = { id: 'personal-1' } as never;
	});

	it('lets a user with the share scope share a personal-space credential', () => {
		const { getByTestId, queryByText } = render('personal-1', true);

		expect(getByTestId('project-sharing-select')).toBeInTheDocument();
		expect(
			queryByText('credentialEdit.credentialSharing.info.personalSpaceRestricted', {
				exact: false,
			}),
		).not.toBeInTheDocument();
	});

	it('explains the restriction to the owner when personal sharing is turned off', () => {
		const { queryByTestId, getByTestId } = render('personal-1', false);

		expect(queryByTestId('project-sharing-select')).not.toBeInTheDocument();
		expect(getByTestId('credential-sharing')).toHaveTextContent(
			/sharing is disabled in personal spaces/i,
		);
	});

	it('shows the read-only list to sharees of someone else’s personal credential', () => {
		const { getByTestId } = render('someone-else', false);

		expect(getByTestId('project-sharing-select')).toBeInTheDocument();
	});
});
