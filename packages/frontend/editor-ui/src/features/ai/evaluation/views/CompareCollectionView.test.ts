import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import userEvent from '@testing-library/user-event';
import { waitFor } from '@testing-library/vue';
import type { AiInsightsResponse, EvaluationCollectionDetail } from '@n8n/api-types';

import { createComponentRenderer } from '@/__tests__/render';
import type { TestCaseExecutionRecord } from '../evaluation.types';
import CompareCollectionView from './CompareCollectionView.vue';

const store = vi.hoisted(() => ({
	fetchCollection: vi.fn(),
	fetchInsights: vi.fn(),
	fetchTestCaseExecutions: vi.fn(),
	generateInsights: vi.fn(),
}));

vi.mock('../evaluation.store', () => ({ useEvaluationStore: () => store }));

vi.mock('vue-router', async (importOriginal) => ({
	...(await importOriginal<object>()),
	useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@n8n/composables/useToast', () => ({
	useToast: () => ({ showError: vi.fn() }),
}));

function testCase(
	testRunId: string,
	runIndex: number,
	score: number,
	question: string,
	output: string,
): TestCaseExecutionRecord {
	return {
		id: `${testRunId}-${runIndex}`,
		createdAt: '2026-01-01T00:00:00Z',
		updatedAt: '2026-01-01T00:00:00Z',
		testRunId,
		executionId: null,
		status: 'success',
		runAt: null,
		completedAt: null,
		errorCode: null,
		errorDetails: null,
		metrics: { helpfulness: score },
		inputs: { question },
		outputs: { output },
		runIndex,
	};
}

const CASES: Record<string, TestCaseExecutionRecord[]> = {
	'run-a': [
		testCase('run-a', 0, 0.8, 'What is 2+2?', '4'),
		testCase('run-a', 1, 0.5, 'Capital of France?', 'Paris'),
	],
	'run-b': [
		testCase('run-b', 0, 0.88, 'What is 2+2?', '2 + 2 equals 4.'),
		testCase('run-b', 1, 0.9, 'Capital of France?', 'The capital of France is Paris.'),
	],
};

const DETAIL: EvaluationCollectionDetail = {
	id: 'col-1',
	name: 'Tone tuning experiment',
	description: null,
	workflowId: 'wf-1',
	evaluationConfigId: 'cfg-1',
	createdById: null,
	createdAt: '2026-01-01T00:00:00Z',
	updatedAt: '2026-01-01T00:00:00Z',
	runCount: 2,
	runs: [
		{
			testRunId: 'run-a',
			workflowVersionId: 'v1',
			status: 'completed',
			runAt: null,
			completedAt: null,
			avgScore: 0.61,
			metrics: { helpfulness: 0.61 },
		},
		{
			testRunId: 'run-b',
			workflowVersionId: 'v2',
			status: 'completed',
			runAt: null,
			completedAt: null,
			avgScore: 0.89,
			metrics: { helpfulness: 0.89 },
		},
	],
};

const INSIGHTS: AiInsightsResponse = {
	generatedAt: '2026-01-01T00:07:00Z',
	modelUsed: 'test',
	status: 'ok',
	insights: {
		winner: { versionLabel: 'V2', headline: 'V2 wins', body: 'Higher helpfulness.' },
		regressions: [],
		suggestedNext: { headline: 'Try V3', body: 'Raise the temperature.', hypothesis: 'Maybe.' },
	},
};

const renderView = createComponentRenderer(CompareCollectionView, {
	props: { workflowId: 'wf-1', collectionId: 'col-1' },
});

function stubCases(cases: Record<string, TestCaseExecutionRecord[]>) {
	store.fetchTestCaseExecutions.mockImplementation(
		async (_workflowId: string, testRunId: string) => cases[testRunId] ?? [],
	);
}

describe('CompareCollectionView', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		store.fetchCollection.mockResolvedValue(DETAIL);
		store.fetchInsights.mockResolvedValue(INSIGHTS);
		stubCases(CASES);
	});

	it('renders the header, score chart, tabs and cases with the widest spread first', async () => {
		const { getByTestId, getAllByTestId } = renderView({ pinia: createTestingPinia() });

		await waitFor(() => expect(getByTestId('compare-cases-table')).toBeInTheDocument());

		expect(getByTestId('compare-header')).toHaveTextContent('Tone tuning experiment');
		expect(getByTestId('compare-score-chart')).toHaveTextContent('V1');
		expect(getByTestId('compare-tabs')).toBeInTheDocument();
		const rows = getAllByTestId('compare-cases-row');
		expect(rows).toHaveLength(2);
		expect(rows[0]).toHaveTextContent('Capital of France?');
		expect(rows[1]).toHaveTextContent('What is 2+2?');
	});

	it('drills into a case and shows each version output side by side', async () => {
		const { getByTestId, getAllByTestId, queryByTestId } = renderView({
			pinia: createTestingPinia(),
		});
		await waitFor(() => expect(getAllByTestId('compare-cases-row')).toHaveLength(2));

		await userEvent.click(getAllByTestId('compare-cases-row')[0]);

		const outputs = getByTestId('compare-outputs-tab');
		expect(outputs).toHaveTextContent('Paris');
		expect(outputs).toHaveTextContent('The capital of France is Paris.');
		expect(queryByTestId('compare-cases-table')).not.toBeInTheDocument();
	});

	it('shows the dataset-mismatch banner only when completed versions ran different case counts', async () => {
		stubCases({ 'run-a': CASES['run-a'], 'run-b': CASES['run-b'].slice(0, 1) });
		const { getByTestId } = renderView({ pinia: createTestingPinia() });

		await waitFor(() => expect(getByTestId('compare-dataset-mismatch')).toBeInTheDocument());
	});

	it('hides the dataset-mismatch banner when case counts match', async () => {
		const { getByTestId, queryByTestId } = renderView({ pinia: createTestingPinia() });

		await waitFor(() => expect(getByTestId('compare-cases-table')).toBeInTheDocument());
		expect(queryByTestId('compare-dataset-mismatch')).not.toBeInTheDocument();
	});

	it('renders cached insights returned by the insights endpoint', async () => {
		const { getByTestId } = renderView({ pinia: createTestingPinia() });

		await waitFor(() =>
			expect(getByTestId('compare-collection-insights')).toHaveTextContent('V2 wins'),
		);
	});

	it('still renders the comparison when reading insights fails', async () => {
		store.fetchInsights.mockRejectedValue(new Error('boom'));
		const { getByTestId, queryByTestId } = renderView({ pinia: createTestingPinia() });

		await waitFor(() => expect(getByTestId('compare-cases-table')).toBeInTheDocument());
		expect(queryByTestId('compare-collection-insights')).not.toBeInTheDocument();
	});
});
