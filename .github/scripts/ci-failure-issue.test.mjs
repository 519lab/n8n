import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decideAction, issueTitle, run, LABEL } from './ci-failure-issue.mjs';

/**
 * Run these tests with:
 *
 * node --test ./.github/scripts/ci-failure-issue.test.mjs
 * */

/** Minimal octokit double that records calls. */
function fakeOctokit({ openIssues = [], labelExists = true, closedNow = [] } = {}) {
	const calls = [];
	const record = (name, result = {}) => async (params) => {
		calls.push({ name, params });
		return { data: result };
	};
	const octokit = {
		paginate: async (_fn, params) => {
			calls.push({ name: 'list', params });
			return openIssues;
		},
		rest: {
			issues: {
				listForRepo: () => {},
				create: record('create', { number: 42 }),
				createComment: record('comment'),
				update: record('update'),
				get: async (params) => {
					calls.push({ name: 'get', params });
					return { data: { state: closedNow.includes(params.issue_number) ? 'closed' : 'open' } };
				},
				getLabel: async (params) => {
					calls.push({ name: 'getLabel', params });
					if (!labelExists) throw Object.assign(new Error('Not Found'), { status: 404 });
					return { data: {} };
				},
				createLabel: record('createLabel'),
			},
		},
	};
	return { octokit, calls };
}

const base = {
	owner: 'acme',
	repo: 'n8n',
	workflow: 'Docker: Build and Push',
	branch: 'develop',
	runUrl: 'https://github.com/acme/n8n/actions/runs/1',
};
const title = issueTitle(base.workflow, base.branch);

describe('issueTitle', () => {
	it('names the workflow and branch', () => {
		assert.equal(title, 'CI failing: Docker: Build and Push on develop');
	});
});

describe('decideAction', () => {
	it('creates on a first failure and comments on a repeat failure', () => {
		assert.equal(decideAction('failure', undefined), 'create');
		assert.equal(decideAction('failure', 7), 'comment');
	});

	it('closes an open issue on success and does nothing otherwise', () => {
		assert.equal(decideAction('success', 7), 'close');
		assert.equal(decideAction('success', undefined), 'none');
	});
});

describe('run', () => {
	it('opens a labelled issue when none is open', async () => {
		const { octokit, calls } = fakeOctokit();
		assert.equal(await run({ octokit, ...base, status: 'failure' }), 'create');
		const create = calls.find((c) => c.name === 'create');
		assert.equal(create.params.title, title);
		assert.deepEqual(create.params.labels, [LABEL]);
		assert.match(create.params.body, /actions\/runs\/1/);
	});

	it('creates the label first when it does not exist yet', async () => {
		const { octokit, calls } = fakeOctokit({ labelExists: false });
		await run({ octokit, ...base, status: 'failure' });
		const names = calls.map((c) => c.name);
		assert.ok(names.indexOf('createLabel') < names.indexOf('create'));
	});

	it('comments instead of opening a duplicate', async () => {
		const { octokit, calls } = fakeOctokit({ openIssues: [{ number: 7, title }] });
		assert.equal(await run({ octokit, ...base, status: 'failure' }), 'comment');
		assert.equal(calls.find((c) => c.name === 'comment').params.issue_number, 7);
		assert.equal(calls.some((c) => c.name === 'create'), false);
	});

	it('comments and closes the open issue on success', async () => {
		const { octokit, calls } = fakeOctokit({ openIssues: [{ number: 7, title }] });
		assert.equal(await run({ octokit, ...base, status: 'success' }), 'close');
		const update = calls.find((c) => c.name === 'update');
		assert.equal(update.params.issue_number, 7);
		assert.equal(update.params.state, 'closed');
	});

	it('comments on the oldest duplicate and closes every duplicate on success', async () => {
		const dupes = { openIssues: [{ number: 9, title }, { number: 7, title }] };
		const failing = fakeOctokit(dupes);
		await run({ octokit: failing.octokit, ...base, status: 'failure' });
		assert.equal(failing.calls.find((c) => c.name === 'comment').params.issue_number, 7);

		const passing = fakeOctokit(dupes);
		await run({ octokit: passing.octokit, ...base, status: 'success' });
		const closed = passing.calls.filter((c) => c.name === 'update').map((c) => c.params.issue_number);
		assert.deepEqual(closed, [7, 9]);
	});

	it('skips a listed issue that is already closed (stale list)', async () => {
		const { octokit, calls } = fakeOctokit({ openIssues: [{ number: 7, title }], closedNow: [7] });
		assert.equal(await run({ octokit, ...base, status: 'failure' }), 'create');
		assert.equal(calls.some((c) => c.name === 'comment'), false);
	});

	it('ignores open issues for other workflows, branches and pull requests', async () => {
		const { octokit, calls } = fakeOctokit({
			openIssues: [
				{ number: 1, title: issueTitle('Other', 'develop') },
				{ number: 2, title: issueTitle(base.workflow, 'master') },
				{ number: 3, title, pull_request: {} },
			],
		});
		assert.equal(await run({ octokit, ...base, status: 'success' }), 'none');
		assert.equal(calls.some((c) => c.name === 'update'), false);
	});
});
