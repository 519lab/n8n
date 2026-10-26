import { describe, expect, it } from 'vitest';
import type { EvaluationCollectionRunSummary } from '@n8n/api-types';

import type { TestCaseExecutionRecord } from '../evaluation.types';
import {
	buildCaseRows,
	buildVersions,
	caseCountsByVersion,
	formatRecord,
	formatScore,
	hasDatasetMismatch,
	sortBySpread,
	versionLabel,
} from './compareCases';

function run(
	testRunId: string,
	overrides: Partial<EvaluationCollectionRunSummary> = {},
): EvaluationCollectionRunSummary {
	return {
		testRunId,
		workflowVersionId: null,
		status: 'completed',
		runAt: null,
		completedAt: null,
		avgScore: 0.5,
		metrics: null,
		...overrides,
	};
}

function testCase(
	testRunId: string,
	runIndex: number | null,
	score: number,
	question: string,
	output: string,
): TestCaseExecutionRecord {
	return {
		id: `${testRunId}-${runIndex ?? 'x'}`,
		createdAt: '2026-01-01T00:00:00Z',
		updatedAt: '2026-01-01T00:00:00Z',
		testRunId,
		executionId: null,
		status: 'success',
		runAt: null,
		completedAt: null,
		errorCode: null,
		errorDetails: null,
		metrics: { accuracy: score },
		inputs: { question },
		outputs: { output },
		runIndex,
	};
}

const RUNS = [run('run-a', { avgScore: 0.61 }), run('run-b', { avgScore: 0.89 })];

const CASES = {
	'run-a': [
		testCase('run-a', 0, 0.5, 'Capital of France?', 'Paris'),
		testCase('run-a', 1, 0.8, 'What is 2+2?', '4'),
	],
	'run-b': [
		testCase('run-b', 0, 0.9, 'Capital of France?', 'The capital of France is Paris.'),
		testCase('run-b', 1, 0.88, 'What is 2+2?', '2 + 2 equals 4.'),
	],
};

describe('compareCases', () => {
	describe('versionLabel / buildVersions', () => {
		it('labels versions V1, V2, … in run order', () => {
			expect(versionLabel(0)).toBe('V1');
			expect(buildVersions(RUNS).map((version) => version.label)).toEqual(['V1', 'V2']);
		});

		it('falls back to the collection-wide metric scales', () => {
			const [version] = buildVersions([run('run-a')], { accuracy: 'unit' });
			expect(version.metricScales).toEqual({ accuracy: 'unit' });
		});
	});

	describe('formatScore', () => {
		it('renders a percentage, or a dash when missing', () => {
			expect(formatScore(0.614)).toBe('61%');
			expect(formatScore(null)).toBe('—');
		});
	});

	describe('formatRecord', () => {
		it('shows a lone scalar value as-is', () => {
			expect(formatRecord({ question: 'Capital of France?' })).toBe('Capital of France?');
		});

		it('joins several scalars as key/value pairs', () => {
			expect(formatRecord({ a: 1, b: 'two' }, '\n')).toBe('a: 1\nb: two');
		});

		it('falls back to JSON for nested values', () => {
			expect(formatRecord({ nested: { x: 1 } })).toBe('{"nested":{"x":1}}');
		});

		it('returns an empty string for null or empty records', () => {
			expect(formatRecord(null)).toBe('');
			expect(formatRecord({})).toBe('');
		});
	});

	describe('buildCaseRows', () => {
		it('joins cases across versions on their dataset position', () => {
			const rows = buildCaseRows(buildVersions(RUNS), CASES);

			expect(rows).toHaveLength(2);
			expect(rows[0].input).toBe('Capital of France?');
			expect(rows[0].results.map((result) => result.output)).toEqual([
				'Paris',
				'The capital of France is Paris.',
			]);
			expect(rows[0].spread).toBeCloseTo(0.4);
		});

		it('falls back to array position when runIndex is missing', () => {
			const rows = buildCaseRows(buildVersions([run('run-a')]), {
				'run-a': [testCase('run-a', null, 0.5, 'first', 'one')],
			});
			expect(rows[0].index).toBe(0);
			expect(rows[0].input).toBe('first');
		});

		it('marks a case a version did not run as absent', () => {
			const rows = buildCaseRows(buildVersions(RUNS), {
				'run-a': CASES['run-a'],
				'run-b': CASES['run-b'].slice(0, 1),
			});

			const missing = rows[1].results[1];
			expect(missing.status).toBeNull();
			expect(missing.score).toBeNull();
			expect(rows[1].spread).toBe(0);
		});
	});

	describe('sortBySpread', () => {
		it('puts the case with the biggest score spread first', () => {
			const rows = sortBySpread(buildCaseRows(buildVersions(RUNS), CASES));
			expect(rows.map((row) => row.input)).toEqual(['Capital of France?', 'What is 2+2?']);
		});

		it('keeps dataset order on ties', () => {
			const rows = sortBySpread(
				buildCaseRows(buildVersions([run('run-a')]), { 'run-a': CASES['run-a'] }),
			);
			expect(rows.map((row) => row.index)).toEqual([0, 1]);
		});
	});

	describe('caseCountsByVersion / hasDatasetMismatch', () => {
		it('reports no mismatch when completed versions ran the same cases', () => {
			const counts = caseCountsByVersion(buildVersions(RUNS), RUNS, CASES);
			expect(counts).toEqual([
				{ label: 'V1', count: 2 },
				{ label: 'V2', count: 2 },
			]);
			expect(hasDatasetMismatch(counts)).toBe(false);
		});

		it('flags a mismatch when completed versions ran different case counts', () => {
			const cases = { 'run-a': CASES['run-a'], 'run-b': CASES['run-b'].slice(0, 1) };
			expect(hasDatasetMismatch(caseCountsByVersion(buildVersions(RUNS), RUNS, cases))).toBe(true);
		});

		it('ignores versions that are still running', () => {
			const runs = [RUNS[0], run('run-b', { status: 'running' })];
			const cases = { 'run-a': CASES['run-a'], 'run-b': CASES['run-b'].slice(0, 1) };
			expect(hasDatasetMismatch(caseCountsByVersion(buildVersions(runs), runs, cases))).toBe(false);
		});
	});
});
