<script setup lang="ts">
import { useI18n } from '@n8n/i18n';
import { N8nText } from '@n8n/design-system';

import { formatScore } from '../../utils/compareCases';
import type { CompareCaseRow, CompareVersion } from '../../utils/compareCases';

defineOptions({ name: 'CompareCasesTable' });

defineProps<{
	versions: CompareVersion[];
	rows: CompareCaseRow[];
}>();

const emit = defineEmits<{
	select: [key: string];
}>();

const i18n = useI18n();
</script>

<template>
	<div :class="$style.wrapper">
		<N8nText v-if="rows.length === 0" color="text-base" data-test-id="compare-cases-empty">
			{{ i18n.baseText('evaluations.compare.cases.empty') }}
		</N8nText>
		<table v-else :class="$style.table" data-test-id="compare-cases-table">
			<thead>
				<tr>
					<th :class="$style.head">
						{{ i18n.baseText('evaluations.tests.executions.input') }}
					</th>
					<th
						v-for="version in versions"
						:key="version.testRunId"
						:class="[$style.head, $style.numeric]"
					>
						{{ version.label }}
					</th>
					<th :class="[$style.head, $style.numeric]">
						{{ i18n.baseText('evaluations.compare.cases.spread') }}
					</th>
				</tr>
			</thead>
			<tbody>
				<tr
					v-for="row in rows"
					:key="row.key"
					:class="$style.row"
					tabindex="0"
					data-test-id="compare-cases-row"
					@click="emit('select', row.key)"
					@keydown.enter.prevent="emit('select', row.key)"
				>
					<td :class="[$style.cell, $style.input]">{{ row.input }}</td>
					<td
						v-for="result in row.results"
						:key="result.testRunId"
						:class="[$style.cell, $style.numeric]"
					>
						{{ formatScore(result.score) }}
					</td>
					<td :class="[$style.cell, $style.numeric]">{{ formatScore(row.spread) }}</td>
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

.row {
	cursor: pointer;

	&:hover,
	&:focus-visible {
		background: var(--color--background--light-3);
	}
}

.cell {
	padding: var(--spacing--2xs) var(--spacing--sm);
	border-bottom: var(--border-width) var(--border-style) var(--color--foreground--tint-1);
}

.input {
	max-width: 0;
	width: 100%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.numeric {
	text-align: center;
	white-space: nowrap;
}
</style>
