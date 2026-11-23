import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RuleRunner, type RunnableRule } from './rule-runner.js';

function fakeRule(id: string, globs: string[]): RunnableRule {
	return {
		id,
		name: id,
		description: id,
		severity: 'warning',
		fixable: false,
		getTargetGlobs: () => globs,
		analyze: () => [],
		configure: () => {},
	};
}

describe('RuleRunner filesAnalyzed', () => {
	let rootDir: string;

	beforeEach(() => {
		rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'janitor-runner-'));
		for (const file of ['pages/A.ts', 'pages/B.ts', 'pages/B.d.ts', 'tests/a.spec.ts']) {
			fs.mkdirSync(path.dirname(path.join(rootDir, file)), { recursive: true });
			fs.writeFileSync(path.join(rootDir, file), '');
		}
	});

	afterEach(() => {
		fs.rmSync(rootDir, { recursive: true, force: true });
	});

	it('counts the files each rule targets, honouring negated globs', () => {
		const runner = new RuleRunner();
		runner.registerRule(fakeRule('pages', ['pages/**/*.ts', '!**/*.d.ts']));
		runner.registerRule(fakeRule('tests', ['tests/**/*.spec.ts']));

		const report = runner.run({ rootDir });

		const byRule = Object.fromEntries(report.results.map((r) => [r.rule, r.filesAnalyzed]));
		expect(byRule).toEqual({ pages: 2, tests: 1 });
	});

	it('counts each file once in the summary when several rules target it', () => {
		const runner = new RuleRunner();
		runner.registerRule(fakeRule('pages', ['pages/**/*.ts']));
		runner.registerRule(fakeRule('everything', ['**/*.ts']));

		const report = runner.run({ rootDir });

		expect(report.summary.filesAnalyzed).toBe(4);
	});
});
