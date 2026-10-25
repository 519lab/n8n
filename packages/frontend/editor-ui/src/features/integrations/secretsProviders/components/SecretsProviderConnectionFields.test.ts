import { createTestingPinia } from '@pinia/testing';
import userEvent from '@testing-library/user-event';
import { defineComponent } from 'vue';
import type { INodeProperties } from 'n8n-workflow';

import { createComponentRenderer } from '@/__tests__/render';

import SecretsProviderConnectionFields from './SecretsProviderConnectionFields.vue';

/** Renders the `parameter-input-<name>` wrapper the E2E page object fills, without the NDV machinery. */
const ParameterInputExpandedStub = defineComponent({
	props: { parameter: { type: Object, required: true }, value: { default: undefined } },
	emits: ['update'],
	template: `<div :data-test-id="'parameter-input-' + parameter.name">
		<input @input="$emit('update', { name: parameter.name, value: $event.target.value })" />
	</div>`,
});

const PROPERTIES: INodeProperties[] = [
	{ name: 'region', displayName: 'Region', type: 'string', default: '' },
	{
		name: 'authMethod',
		displayName: 'Authentication Method',
		type: 'options',
		default: 'iamUser',
		options: [
			{ name: 'IAM User', value: 'iamUser' },
			{ name: 'Auto Detect', value: 'autoDetect' },
		],
	},
	{
		name: 'accessKeyId',
		displayName: 'Access Key ID',
		type: 'string',
		default: '',
		displayOptions: { show: { authMethod: ['iamUser'] } },
	},
	{ name: 'internal', displayName: 'Internal', type: 'hidden', default: '' },
];

const renderComponent = createComponentRenderer(SecretsProviderConnectionFields, {
	global: { stubs: { ParameterInputExpanded: ParameterInputExpandedStub } },
});

describe('SecretsProviderConnectionFields', () => {
	beforeEach(() => {
		createTestingPinia();
	});

	it('hides hidden properties and those whose displayOptions do not match', () => {
		const { queryByTestId } = renderComponent({
			props: { properties: PROPERTIES, values: { authMethod: 'iamUser' } },
		});

		expect(queryByTestId('parameter-input-region')).toBeInTheDocument();
		expect(queryByTestId('parameter-input-accessKeyId')).toBeInTheDocument();
		expect(queryByTestId('parameter-input-internal')).toBeNull();
	});

	it('drops fields shown only for another auth method', () => {
		const { queryByTestId } = renderComponent({
			props: { properties: PROPERTIES, values: { authMethod: 'autoDetect' } },
		});

		expect(queryByTestId('parameter-input-accessKeyId')).toBeNull();
	});

	it('re-emits field updates as name and value', async () => {
		const { getByTestId, emitted } = renderComponent({
			props: { properties: PROPERTIES, values: { authMethod: 'iamUser' } },
		});

		const input = getByTestId('parameter-input-region').querySelector('input') as HTMLInputElement;
		await userEvent.type(input, 'x');

		expect(emitted('update')).toEqual([['region', 'x']]);
	});
});
