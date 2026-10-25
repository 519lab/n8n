<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from '@n8n/i18n';
import { useToast } from '@n8n/composables/useToast';
import type { AiInsightsResponse } from '@n8n/api-types';
import {
	N8nButton,
	N8nCallout,
	N8nHeading,
	N8nLoading,
	N8nTabs,
	N8nText,
} from '@n8n/design-system';
import type { TabOptions } from '@n8n/design-system';

import { VIEWS } from '@/app/constants';
import { useEvaluationStore } from '../evaluation.store';
import type { EvaluationCollectionDetail } from '../evaluation.types';
import {
	buildCaseRows,
	buildVersions,
	caseCountsByVersion,
	hasDatasetMismatch,
	sortBySpread,
} from '../utils/compareCases';
import type { CasesByRunId } from '../utils/compareCases';
import CompareCaseOutputs from '../components/Compare/CompareCaseOutputs.vue';
import CompareCasesTable from '../components/Compare/CompareCasesTable.vue';
import CompareInsightsCard from '../components/Compare/CompareInsightsCard.vue';
import CompareMetricsMatrix from '../components/Compare/CompareMetricsMatrix.vue';
import CompareScoreChart from '../components/Compare/CompareScoreChart.vue';

defineOptions({ name: 'CompareCollectionView' });

const props = defineProps<{
	workflowId?: string;
	collectionId?: string;
}>();

type CompareTab = 'cases' | 'outputs' | 'metrics';

const router = useRouter();
const i18n = useI18n();
const toast = useToast();
const evaluationStore = useEvaluationStore();

const isLoading = ref(true);
const hasError = ref(false);
const isGenerating = ref(false);
const collection = ref<EvaluationCollectionDetail | null>(null);
const insights = ref<AiInsightsResponse | null>(null);
const casesByRunId = ref<CasesByRunId>({});
const activeTab = ref<CompareTab>('cases');
const selectedCaseKey = ref<string | null>(null);

const runs = computed(() => collection.value?.runs ?? []);
const versions = computed(() => buildVersions(runs.value, collection.value?.metricScales));
const caseRows = computed(() => sortBySpread(buildCaseRows(versions.value, casesByRunId.value)));

// Without an explicit pick, the outputs tab shows the most divergent case.
const selectedRow = computed(
	() =>
		caseRows.value.find((row) => row.key === selectedCaseKey.value) ?? caseRows.value[0] ?? null,
);

const caseCounts = computed(() =>
	caseCountsByVersion(versions.value, runs.value, casesByRunId.value),
);
const showDatasetMismatch = computed(() => hasDatasetMismatch(caseCounts.value));
const caseCountsText = computed(() =>
	caseCounts.value.map((entry) => `${entry.label}: ${entry.count}`).join(', '),
);

const tabOptions = computed<Array<TabOptions<CompareTab>>>(() => [
	{ value: 'cases', label: i18n.baseText('evaluations.compare.tabs.cases') },
	{ value: 'outputs', label: i18n.baseText('evaluations.compare.tabs.outputs') },
	{ value: 'metrics', label: i18n.baseText('evaluations.tests.detail.metrics.heading') },
]);

async function fetchCases(workflowId: string, detail: EvaluationCollectionDetail) {
	const perRun = await Promise.all(
		detail.runs.map(
			async (run) => await evaluationStore.fetchTestCaseExecutions(workflowId, run.testRunId),
		),
	);
	const byRunId: CasesByRunId = {};
	detail.runs.forEach((run, index) => {
		byRunId[run.testRunId] = perRun[index];
	});
	casesByRunId.value = byRunId;
}

async function load() {
	const { workflowId, collectionId } = props;
	if (!workflowId || !collectionId) {
		isLoading.value = false;
		return;
	}
	isLoading.value = true;
	hasError.value = false;
	try {
		const detail = await evaluationStore.fetchCollection(workflowId, collectionId);
		collection.value = detail;
		// Insights are optional; failing to read them must not block the comparison.
		const [cachedInsights] = await Promise.all([
			evaluationStore.fetchInsights(workflowId, collectionId).catch(() => null),
			fetchCases(workflowId, detail),
		]);
		insights.value = cachedInsights;
	} catch (error) {
		hasError.value = true;
		toast.showError(error, i18n.baseText('generic.error'));
	} finally {
		isLoading.value = false;
	}
}

async function generateInsights() {
	if (!props.workflowId || !props.collectionId) return;
	isGenerating.value = true;
	try {
		insights.value = await evaluationStore.generateInsights(props.workflowId, props.collectionId, {
			forceRegenerate: insights.value !== null,
		});
	} catch (error) {
		toast.showError(error, i18n.baseText('generic.error'));
	} finally {
		isGenerating.value = false;
	}
}

function openCase(key: string) {
	selectedCaseKey.value = key;
	activeTab.value = 'outputs';
}

function goBack() {
	void router.push({
		name: VIEWS.EVALUATION_EDIT,
		params: { workflowId: props.workflowId },
	});
}

onMounted(load);
</script>

<template>
	<div :class="$style.container" data-test-id="compare-collection-view">
		<div :class="$style.header" data-test-id="compare-header">
			<N8nButton
				variant="subtle"
				size="small"
				icon="arrow-left"
				data-test-id="compare-collection-back"
				@click="goBack"
			>
				{{ i18n.baseText('generic.back') }}
			</N8nButton>
			<N8nHeading tag="h2" size="large">
				{{ collection?.name ?? i18n.baseText('evaluations.wizardSidepanel.step.results.title') }}
			</N8nHeading>
			<N8nText v-if="collection?.description" color="text-base">
				{{ collection.description }}
			</N8nText>
		</div>

		<N8nLoading v-if="isLoading" :rows="6" />

		<N8nCallout v-else-if="hasError" theme="danger">
			{{ i18n.baseText('generic.error') }}
			<template #trailingContent>
				<N8nButton variant="subtle" size="small" @click="load">
					{{ i18n.baseText('generic.retry') }}
				</N8nButton>
			</template>
		</N8nCallout>

		<template v-else>
			<div :class="$style.hero">
				<CompareScoreChart :versions="versions" :class="$style.chart" />
				<div :class="$style.insights">
					<CompareInsightsCard v-if="insights" :insights="insights" />
					<div :class="$style.insightsActions">
						<N8nButton
							variant="outline"
							size="small"
							icon="wand-sparkles"
							:loading="isGenerating"
							data-test-id="compare-collection-regenerate"
							@click="generateInsights"
						>
							{{
								insights
									? i18n.baseText('evaluations.compare.insights.regenerate')
									: i18n.baseText('evaluations.compare.insights.generate')
							}}
						</N8nButton>
					</div>
				</div>
			</div>

			<div v-if="showDatasetMismatch" data-test-id="compare-dataset-mismatch">
				<N8nCallout theme="warning">
					{{
						i18n.baseText('evaluations.compare.datasetMismatch', {
							interpolate: { counts: caseCountsText },
						})
					}}
				</N8nCallout>
			</div>

			<div data-test-id="compare-tabs">
				<N8nTabs v-model="activeTab" :options="tabOptions" />
			</div>

			<CompareCasesTable
				v-if="activeTab === 'cases'"
				:versions="versions"
				:rows="caseRows"
				@select="openCase"
			/>
			<CompareCaseOutputs
				v-else-if="activeTab === 'outputs'"
				:versions="versions"
				:row="selectedRow"
			/>
			<CompareMetricsMatrix v-else :versions="versions" />
		</template>
	</div>
</template>

<style lang="scss" module>
.container {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--sm);
	padding: var(--spacing--lg);
	width: 100%;
	max-width: 1100px;
	margin: 0 auto;
}

.header {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--2xs);
	align-items: flex-start;
}

.hero {
	display: flex;
	flex-wrap: wrap;
	gap: var(--spacing--sm);
	align-items: flex-start;
}

.chart {
	flex: 1 1 280px;
}

.insights {
	display: flex;
	flex: 2 1 360px;
	flex-direction: column;
	gap: var(--spacing--2xs);
}

.insightsActions {
	display: flex;
	justify-content: flex-end;
}
</style>
