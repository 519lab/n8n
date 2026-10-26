import { averageNormalizedScore } from '@n8n/api-types';
import type { EvaluationCollectionRunSummary, MetricScale } from '@n8n/api-types';

import type { TestCaseExecutionRecord, TestCaseExecutionStatus } from '../evaluation.types';

/** One compared workflow version (a run in the collection), in run order. */
export interface CompareVersion {
	testRunId: string;
	label: string;
	avgScore: number | null;
	metrics: Record<string, number> | null;
	metricScales?: Record<string, MetricScale>;
}

/** A version's result for one test case; `status: null` means the run has no such case. */
export interface CaseVersionResult {
	testRunId: string;
	score: number | null;
	output: string;
	status: TestCaseExecutionStatus | null;
}

/** One dataset case joined across every compared version. */
export interface CompareCaseRow {
	key: string;
	index: number;
	input: string;
	/** Aligned with the versions array. */
	results: CaseVersionResult[];
	/** Max minus min normalized score across the versions that scored this case. */
	spread: number;
}

export interface VersionCaseCount {
	label: string;
	count: number;
}

export type CasesByRunId = Record<string, TestCaseExecutionRecord[]>;

/**
 * `V1`, `V2`, … in run order — the same labels the backend insights service
 * assigns, so insight cards, the chart and the table columns line up.
 */
export function versionLabel(index: number): string {
	return `V${index + 1}`;
}

export function buildVersions(
	runs: EvaluationCollectionRunSummary[],
	collectionScales?: Record<string, MetricScale>,
): CompareVersion[] {
	return runs.map((run, index) => ({
		testRunId: run.testRunId,
		label: versionLabel(index),
		avgScore: run.avgScore,
		metrics: run.metrics,
		metricScales: run.metricScales ?? collectionScales,
	}));
}

export function formatScore(score: number | null | undefined): string {
	if (score === null || score === undefined) return '—';
	return `${Math.round(score * 100)}%`;
}

function isPrimitive(value: unknown): value is string | number | boolean {
	return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

/**
 * Human-readable rendering of a case's inputs/outputs record: a lone scalar
 * value is shown as-is, several scalars as `key: value` pairs, anything nested
 * as compact JSON.
 */
export function formatRecord(
	record: Record<string, unknown> | null | undefined,
	separator = ' · ',
): string {
	if (!record) return '';
	const entries = Object.entries(record);
	if (entries.length === 0) return '';
	if (entries.every(([, value]) => isPrimitive(value))) {
		if (entries.length === 1) return String(entries[0][1]);
		return entries.map(([key, value]) => `${key}: ${String(value)}`).join(separator);
	}
	try {
		return JSON.stringify(record);
	} catch {
		return '';
	}
}

function caseScore(testCase: TestCaseExecutionRecord, scales?: Record<string, MetricScale>) {
	return averageNormalizedScore(testCase.metrics, scales);
}

/** Cases of one run keyed by dataset position (`runIndex`, else array order). */
function indexCases(cases: TestCaseExecutionRecord[]): Map<number, TestCaseExecutionRecord> {
	const byIndex = new Map<number, TestCaseExecutionRecord>();
	cases.forEach((testCase, position) => {
		byIndex.set(testCase.runIndex ?? position, testCase);
	});
	return byIndex;
}

/** Join every version's case executions on dataset position, ordered by position. */
export function buildCaseRows(
	versions: CompareVersion[],
	casesByRunId: CasesByRunId,
): CompareCaseRow[] {
	const indexedByRun = versions.map((version) => indexCases(casesByRunId[version.testRunId] ?? []));

	const allIndexes = new Set<number>();
	for (const indexed of indexedByRun) {
		for (const index of indexed.keys()) allIndexes.add(index);
	}

	return [...allIndexes]
		.sort((a, b) => a - b)
		.map<CompareCaseRow>((index) => {
			const results = versions.map<CaseVersionResult>((version, versionIndex) => {
				const testCase = indexedByRun[versionIndex].get(index);
				if (!testCase) {
					return { testRunId: version.testRunId, score: null, output: '', status: null };
				}
				return {
					testRunId: version.testRunId,
					score: caseScore(testCase, version.metricScales),
					output: formatRecord(testCase.outputs, '\n'),
					status: testCase.status,
				};
			});

			const input =
				indexedByRun
					.map((indexed) => formatRecord(indexed.get(index)?.inputs))
					.find((text) => text.length > 0) ?? '';

			const scores = results
				.map((result) => result.score)
				.filter((score): score is number => score !== null);
			const spread = scores.length > 1 ? Math.max(...scores) - Math.min(...scores) : 0;

			return { key: `case-${index}`, index, input, results, spread };
		});
}

/** Cases where the versions disagree most come first; ties keep dataset order. */
export function sortBySpread(rows: CompareCaseRow[]): CompareCaseRow[] {
	return [...rows].sort((a, b) => b.spread - a.spread || a.index - b.index);
}

/** Case counts of the completed versions — still-running runs are naturally short. */
export function caseCountsByVersion(
	versions: CompareVersion[],
	runs: EvaluationCollectionRunSummary[],
	casesByRunId: CasesByRunId,
): VersionCaseCount[] {
	const completedRunIds = new Set(
		runs.filter((run) => run.status === 'completed').map((run) => run.testRunId),
	);
	return versions
		.filter((version) => completedRunIds.has(version.testRunId))
		.map((version) => ({
			label: version.label,
			count: casesByRunId[version.testRunId]?.length ?? 0,
		}));
}

export function hasDatasetMismatch(counts: VersionCaseCount[]): boolean {
	return new Set(counts.map((entry) => entry.count)).size > 1;
}
