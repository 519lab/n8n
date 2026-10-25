<script setup lang="ts">
import { N8nCard, N8nIcon, N8nText } from '@n8n/design-system';
import type { AiInsightsResponse } from '@n8n/api-types';

defineOptions({ name: 'CompareInsightsCard' });

defineProps<{
	insights: AiInsightsResponse;
}>();

/** Percentage-point delta vs. the winner, e.g. `-12.5%`. */
function formatDelta(delta: number): string {
	const sign = delta > 0 ? '+' : '';
	return `${sign}${Math.round(delta * 10) / 10}%`;
}
</script>

<template>
	<N8nCard :class="$style.insights" data-test-id="compare-collection-insights">
		<div :class="$style.item">
			<N8nIcon icon="star-filled" :class="$style.winnerIcon" />
			<div>
				<N8nText :bold="true">
					{{ insights.insights.winner.versionLabel }} — {{ insights.insights.winner.headline }}
				</N8nText>
				<N8nText tag="p" size="small" color="text-base">
					{{ insights.insights.winner.body }}
				</N8nText>
			</div>
		</div>

		<div
			v-for="(regression, index) in insights.insights.regressions"
			:key="`regression-${index}`"
			:class="$style.item"
		>
			<N8nIcon icon="triangle-alert" :class="$style.regressionIcon" />
			<div>
				<N8nText :bold="true">
					{{ regression.versionLabel }} · {{ regression.metric }} ({{
						formatDelta(regression.delta)
					}}) — {{ regression.headline }}
				</N8nText>
				<N8nText tag="p" size="small" color="text-base">{{ regression.body }}</N8nText>
			</div>
		</div>

		<div :class="$style.item">
			<N8nIcon icon="wand-sparkles" :class="$style.suggestIcon" />
			<div>
				<N8nText :bold="true">{{ insights.insights.suggestedNext.headline }}</N8nText>
				<N8nText tag="p" size="small" color="text-base">
					{{ insights.insights.suggestedNext.body }}
				</N8nText>
				<N8nText tag="p" size="small" color="text-light">
					{{ insights.insights.suggestedNext.hypothesis }}
				</N8nText>
			</div>
		</div>
	</N8nCard>
</template>

<style lang="scss" module>
.insights {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--sm);
}

.item {
	display: flex;
	gap: var(--spacing--xs);
	align-items: flex-start;
}

.winnerIcon {
	color: var(--color--success);
}

.regressionIcon {
	color: var(--color--warning);
}

.suggestIcon {
	color: var(--color--primary);
}
</style>
