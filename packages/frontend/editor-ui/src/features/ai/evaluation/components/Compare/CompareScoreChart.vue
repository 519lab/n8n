<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@n8n/i18n';
import { N8nText } from '@n8n/design-system';

import { formatScore } from '../../utils/compareCases';
import type { CompareVersion } from '../../utils/compareCases';

defineOptions({ name: 'CompareScoreChart' });

const props = defineProps<{
	versions: CompareVersion[];
}>();

const i18n = useI18n();

const bestScore = computed(() => {
	const scores = props.versions
		.map((version) => version.avgScore)
		.filter((score): score is number => score !== null);
	return scores.length ? Math.max(...scores) : null;
});

function barWidth(score: number | null): string {
	if (score === null) return '0%';
	return `${Math.min(100, Math.max(0, score * 100))}%`;
}
</script>

<template>
	<div :class="$style.chart" data-test-id="compare-score-chart">
		<N8nText size="small" color="text-light" :bold="true">
			{{ i18n.baseText('evaluations.wizardSidepanel.step3.averageLabel') }}
		</N8nText>
		<div
			v-for="version in versions"
			:key="version.testRunId"
			:class="$style.row"
			data-test-id="compare-score-chart-bar"
		>
			<N8nText size="small" :bold="true" :class="$style.label">{{ version.label }}</N8nText>
			<div :class="$style.track">
				<div
					:class="[
						$style.bar,
						{ [$style.best]: version.avgScore !== null && version.avgScore === bestScore },
					]"
					:style="{ width: barWidth(version.avgScore) }"
				/>
			</div>
			<N8nText size="small" :class="$style.value">{{ formatScore(version.avgScore) }}</N8nText>
		</div>
	</div>
</template>

<style lang="scss" module>
.chart {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--2xs);
	min-width: 0;
	padding: var(--spacing--sm);
	border: var(--border);
	border-radius: var(--radius--lg);
	background: var(--color--background--light-3);
}

.row {
	display: flex;
	align-items: center;
	gap: var(--spacing--xs);
}

.label {
	flex: 0 0 var(--spacing--xl);
}

.track {
	flex: 1;
	height: var(--spacing--xs);
	border-radius: var(--radius);
	background: var(--color--foreground--tint-1);
	overflow: hidden;
}

.bar {
	height: 100%;
	border-radius: var(--radius);
	background: var(--color--primary);
}

.best {
	background: var(--color--success);
}

.value {
	flex: 0 0 var(--spacing--2xl);
	text-align: right;
}
</style>
