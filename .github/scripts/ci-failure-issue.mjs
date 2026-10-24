/**
 * Tracks a failing workflow as a GitHub issue instead of a chat alert.
 *
 * On failure, opens one `ci-failure` issue per workflow + branch, or comments on the
 * open one. On success, comments on and closes that issue. One issue per pair keeps a
 * nightly that fails for a week to a single thread.
 *
 * Usage (from util-ci-failure-issue-reusable.yml):
 *   CI_STATUS=failure|success CI_WORKFLOW=... CI_BRANCH=... CI_RUN_URL=... \
 *   node .github/scripts/ci-failure-issue.mjs
 */

import { ensureEnvVar, initGithub } from './github-helpers.mjs';

export const LABEL = 'ci-failure';

/**
 * @param {string} workflow
 * @param {string} branch
 */
export function issueTitle(workflow, branch) {
	return `CI failing: ${workflow} on ${branch}`;
}

/**
 * @param {'failure' | 'success'} status
 * @param {number | undefined} existingIssue
 * @returns {'create' | 'comment' | 'close' | 'none'}
 */
export function decideAction(status, existingIssue) {
	if (status === 'failure') return existingIssue ? 'comment' : 'create';
	return existingIssue ? 'close' : 'none';
}

/**
 * @param {{
 *   octokit: import('./github-helpers.mjs').GitHubInstance,
 *   owner: string,
 *   repo: string,
 *   status: 'failure' | 'success',
 *   workflow: string,
 *   branch: string,
 *   runUrl: string,
 * }} params
 * @returns {Promise<'create' | 'comment' | 'close' | 'none'>}
 */
export async function run({ octokit, owner, repo, status, workflow, branch, runUrl }) {
	const title = issueTitle(workflow, branch);
	const open = await octokit.paginate(octokit.rest.issues.listForRepo, {
		owner,
		repo,
		labels: LABEL,
		state: 'open',
		per_page: 100,
	});
	// The issue list lags writes by a few seconds in both directions, so re-read each
	// candidate (a direct get is consistent) and tolerate duplicates: comment on the
	// oldest open match, close every open match on success.
	const candidates = open
		.filter((issue) => issue.title === title && !issue.pull_request)
		.map((issue) => issue.number)
		.sort((a, b) => a - b);
	const matches = [];
	for (const issueNumber of candidates) {
		const { data } = await octokit.rest.issues.get({ owner, repo, issue_number: issueNumber });
		if (data.state === 'open') matches.push(issueNumber);
	}
	const existing = matches[0];
	const action = decideAction(status, existing);

	if (action === 'create') {
		await ensureLabel({ octokit, owner, repo });
		const { data } = await octokit.rest.issues.create({
			owner,
			repo,
			title,
			labels: [LABEL],
			body: `\`${workflow}\` failed on \`${branch}\`.\n\nFirst failing run: ${runUrl}\n\nThis issue closes automatically on the next successful run.`,
		});
		console.log(`Opened #${data.number}: ${title}`);
	} else if (action === 'comment' && existing) {
		await octokit.rest.issues.createComment({
			owner,
			repo,
			issue_number: existing,
			body: `Still failing: ${runUrl}`,
		});
		console.log(`Commented on #${existing}`);
	} else if (action === 'close') {
		for (const issueNumber of matches) {
			await octokit.rest.issues.createComment({
				owner,
				repo,
				issue_number: issueNumber,
				body: `Passing again: ${runUrl}`,
			});
			await octokit.rest.issues.update({
				owner,
				repo,
				issue_number: issueNumber,
				state: 'closed',
				state_reason: 'completed',
			});
			console.log(`Closed #${issueNumber}`);
		}
	} else {
		console.log(`No open "${title}" issue; nothing to do.`);
	}
	return action;
}

/**
 * @param {{ octokit: import('./github-helpers.mjs').GitHubInstance, owner: string, repo: string }} params
 */
async function ensureLabel({ octokit, owner, repo }) {
	try {
		await octokit.rest.issues.getLabel({ owner, repo, name: LABEL });
	} catch (error) {
		if (/** @type {{ status?: number }} */ (error).status !== 404) throw error;
		await octokit.rest.issues.createLabel({
			owner,
			repo,
			name: LABEL,
			color: 'b60205',
			description: 'A scheduled or develop CI workflow is failing',
		});
	}
}

async function main() {
	const status = ensureEnvVar('CI_STATUS');
	if (status !== 'failure' && status !== 'success') {
		throw new Error(`CI_STATUS must be "failure" or "success", got "${status}"`);
	}
	const { octokit, owner, repo } = initGithub();
	await run({
		octokit,
		owner,
		repo,
		status,
		workflow: ensureEnvVar('CI_WORKFLOW'),
		branch: ensureEnvVar('CI_BRANCH'),
		runUrl: ensureEnvVar('CI_RUN_URL'),
	});
}

if (import.meta.url === `file://${process.argv[1]}`) {
	await main();
}
