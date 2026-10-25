<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@n8n/i18n';
import { normalizeMetricScore } from '@n8n/api-types';

import { formatScore } from '../../utils/compareCases';
import type { CompareVersion } from '../../utils/compareCases';

defineOptions({ name: 'CompareMetricsMatrix' });

const props = defineProps<{
	versions: CompareVersion[];
}>();

const i18n = useI18n();

// Union of metric keys across all versions, preserving first-seen order.
const metricKeys = computed<string[]>(() => {
	const keys = new Set<string>();
	for (const version of props.versions) {
		for (const key of Object.keys(version.metrics ?? {})) keys.add(key);
	}
	return [...keys];
});

function cellValue(version: CompareVersion, key: string): string {
	const raw = version.metrics?.[key];
	if (raw === undefined || raw === null) return '—';
	const normalized = normalizeMetricScore(key, raw, version.metricScales?.[key]);
	// Operational metrics (tokens, time) aren't scores — show the raw value.
	if (normalized === null) return String(Math.round(raw * 100) / 100);
	return formatScore(normalized);
}
</script>

<template>
	<div :class="$style.wrapper">
		<table :class="$style.table" data-test-id="compare-collection-table">
			<thead>
				<tr>
					<th :class="$style.head">
						{{ i18n.baseText('evaluations.tests.detail.metrics.heading') }}
					</th>
					<th
						v-for="version in versions"
						:key="version.testRunId"
						:class="[$style.head, $style.numeric]"
					>
						{{ version.label }}
					</th>
				</tr>
			</thead>
			<tbody>
				<tr :class="$style.averageRow">
					<td :class="$style.cell">
						{{ i18n.baseText('evaluations.wizardSidepanel.step3.averageLabel') }}
					</td>
					<td
						v-for="version in versions"
						:key="`avg-${version.testRunId}`"
						:class="[$style.cell, $style.numeric]"
					>
						{{ formatScore(version.avgScore) }}
					</td>
				</tr>
				<tr v-for="key in metricKeys" :key="key">
					<td :class="$style.cell">{{ key }}</td>
					<td
						v-for="version in versions"
						:key="`${key}-${version.testRunId}`"
						:class="[$style.cell, $style.numeric]"
					>
						{{ cellValue(version, key) }}
					</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>

<style lang="scss" module>
.wrapper {
	width: 100%;
	overflow-x: auto;
}

.table {
	width: 100%;
	border-collapse: collapse;
	font-size: var(--font-size--2xs);
}

.head {
	text-align: left;
	padding: var(--spacing--2xs) var(--spacing--sm);
	border-bottom: var(--border-width) var(--border-style) var(--color--foreground);
	color: var(--color--text--tint-1);
	font-weight: var(--font-weight--bold);
	white-space: nowrap;
}

.cell {
	padding: var(--spacing--2xs) var(--spacing--sm);
	border-bottom: var(--border-width) var(--border-style) var(--color--foreground--tint-1);
	white-space: nowrap;
}

.numeric {
	text-align: center;
}

.averageRow {
	font-weight: var(--font-weight--bold);
	background: var(--color--background--light-3);
}
</style>
