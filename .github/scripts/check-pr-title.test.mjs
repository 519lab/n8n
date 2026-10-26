import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePrTitle } from './check-pr-title.mjs';

/**
 * Run these tests by running
 *
 * node --test ./.github/scripts/check-pr-title.test.mjs
 * */

describe('validatePrTitle', () => {
	it('accepts valid titles', () => {
		for (const title of [
			'ci: Run CI on GitHub-hosted runners',
			'feat(editor): Add a dark mode toggle',
			'fix(core, editor): Keep the canvas in sync',
			'fix(Microsoft To Do Node): Handle empty lists',
			'feat(API)!: Remove the v0 endpoints',
			'refactor(ai-builder): Split the session store',
			'test: `waitForRunComplete` waits for the toolbar',
			'revert: feat(editor): Add a dark mode toggle',
		]) {
			assert.deepEqual(validatePrTitle(title), [], title);
		}
	});

	it('rejects a title without a type prefix', () => {
		assert.equal(validatePrTitle('Run CI on GitHub-hosted runners').length, 1);
	});

	it('rejects an unknown type', () => {
		assert.match(validatePrTitle('feature: Add X')[0], /Unknown type `feature`/);
	});

	it('rejects scopes outside the convention', () => {
		assert.match(validatePrTitle('ci(security): Pin actions')[0], /Unknown scope `security`/);
		assert.match(validatePrTitle('fix(core, ci): Do X')[0], /Unknown scope `ci`/);
	});

	it('rejects a lowercase summary', () => {
		assert.deepEqual(validatePrTitle('test: wait for the toolbar'), [
			'Summary must start with a capital letter.',
		]);
	});

	it('rejects a trailing period', () => {
		assert.deepEqual(validatePrTitle('docs: Explain the runners.'), [
			'Summary must not end with a period.',
		]);
	});

	it('rejects an empty summary', () => {
		assert.match(validatePrTitle('fix: ')[0], /Title must look like/);
		assert.match(validatePrTitle('fix:  ')[0], /Title must look like/);
	});

	it('validates a revert summary as the reverted title', () => {
		assert.match(validatePrTitle('revert: feat(editor): add X')[0], /capital letter/);
		assert.match(validatePrTitle('revert: Add X')[0], /Title must look like/);
	});

	it('reports every problem at once', () => {
		assert.equal(validatePrTitle('feature(security): lowercase.').length, 4);
	});
});
