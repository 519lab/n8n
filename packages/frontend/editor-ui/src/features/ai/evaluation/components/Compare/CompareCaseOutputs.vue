<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@n8n/i18n';
import { N8nText } from '@n8n/design-system';

import { formatScore } from '../../utils/compareCases';
import type { CaseVersionResult, CompareCaseRow, CompareVersion } from '../../utils/compareCases';

defineOptions({ name: 'CompareCaseOutputs' });

const props = defineProps<{
	versions: CompareVersion[];
	row: CompareCaseRow | null;
}>();

const i18n = useI18n();

const columns = computed(() => {
	const row = props.row;
	if (!row) return [];
	return props.versions.map((version, index) => ({ version, result: row.results[index] }));
});

function outputText(result: CaseVersionResult): string {
	if (result.status === null) return i18n.baseText('evaluations.compare.outputs.notRun');
	if (result.status === 'error') return i18n.baseText('evaluations.tests.results.runFailed');
	return result.output || i18n.baseText('evaluations.compare.outputs.noOutput');
}
</script>

<template>
	<div :class="$style.container" data-test-id="compare-outputs-tab">
		<N8nText v-if="!row" color="text-base">
			{{ i18n.baseText('evaluations.compare.outputs.selectCase') }}
		</N8nText>
		<template v-else>
			<div :class="$style.input">
				<N8nText size="small" color="text-light" :bold="true">
					{{ i18n.baseText('evaluations.tests.executions.input') }}
				</N8nText>
				<N8nText tag="p" data-test-id="compare-outputs-input">{{ row.input }}</N8nText>
			</div>
			<div :class="$style.grid">
				<div
					v-for="column in columns"
					:key="column.version.testRunId"
					:class="$style.card"
					data-test-id="compare-outputs-version"
				>
					<div :class="$style.cardHeader">
						<N8nText size="small" :bold="true">{{ column.version.label }}</N8nText>
						<N8nText size="small" color="text-light">
							{{ formatScore(column.result.score) }}
						</N8nText>
					</div>
					<N8nText tag="p" size="small" :class="$style.output">
						{{ outputText(column.result) }}
					</N8nText>
				</div>
			</div>
		</template>
	</div>
</template>

<style lang="scss" module>
.container {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--sm);
}

.input {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--4xs);
}

.grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
	gap: var(--spacing--sm);
}

.card {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--2xs);
	padding: var(--spacing--sm);
	border: var(--border);
	border-radius: var(--radius--lg);
	background: var(--color--background--light-3);
}

.cardHeader {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.output {
	white-space: pre-wrap;
	overflow-wrap: anywhere;
}
</style>
