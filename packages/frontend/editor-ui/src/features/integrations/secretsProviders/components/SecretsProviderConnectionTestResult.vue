<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from '@n8n/i18n';
import { N8nCallout, N8nText } from '@n8n/design-system';

import type { ConnectionTestResult } from '../secretsProviders.types';

/** Outcome of the automatic test that follows every save. Renders nothing while idle. */
const props = defineProps<{
	result: ConnectionTestResult;
	providerKey: string;
	providerName: string;
	secretsCount: number;
}>();

const i18n = useI18n();

const successMessage = computed(() =>
	i18n.baseText('settings.secretsProviderConnections.modal.testConnection.success.serviceEnabled', {
		interpolate: { count: String(props.secretsCount), providerName: props.providerName },
	}),
);

const referenceExample = computed(() => `{{ $secrets.${props.providerKey}.secret_name }}`);
</script>

<template>
	<N8nCallout
		v-if="result.state === 'success'"
		theme="success"
		data-test-id="connection-success-callout"
	>
		<N8nText size="small">{{ successMessage }}</N8nText>
		<N8nText size="small" tag="p">
			{{
				i18n.baseText('settings.secretsProviderConnections.modal.testConnection.success.reference')
			}}
			<code>{{ referenceExample }}</code>
		</N8nText>
	</N8nCallout>
	<N8nCallout
		v-else-if="result.state === 'error'"
		theme="danger"
		data-test-id="connection-error-banner"
	>
		<N8nText size="small" bold>
			{{ i18n.baseText('settings.secretsProviderConnections.modal.testConnection.error') }}
		</N8nText>
		<N8nText v-if="result.message" size="small" tag="p">{{ result.message }}</N8nText>
	</N8nCallout>
</template>
