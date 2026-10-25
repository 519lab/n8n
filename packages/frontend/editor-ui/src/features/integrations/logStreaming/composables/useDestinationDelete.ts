import { useI18n } from '@n8n/i18n';
import { useToast } from '@n8n/composables/useToast';
import { useMessage } from '@n8n/design-system';

import { useLogStreamingStore } from '../logStreaming.store';
import type { MessageEventBusDestinationOptions } from '../logStreaming.types';

/** Confirm-then-delete flow shared by the destination card menu and the settings modal. */
export function useDestinationDelete() {
	const i18n = useI18n();
	const toast = useToast();
	const message = useMessage();
	const logStreamingStore = useLogStreamingStore();

	/** Resolves to whether the destination was deleted. */
	async function confirmAndDelete(
		destination: MessageEventBusDestinationOptions,
	): Promise<boolean> {
		const { id } = destination;
		if (!id) return false;

		const confirmed = await message.confirm(
			i18n.baseText('settings.log-streaming.destinationDelete.message', {
				interpolate: { destinationName: destination.label ?? '' },
			}),
			i18n.baseText('settings.log-streaming.destinationDelete.headline'),
			{
				type: 'warning',
				confirmButtonText: i18n.baseText(
					'settings.log-streaming.destinationDelete.confirmButtonText',
				),
				cancelButtonText: i18n.baseText('generic.cancel'),
			},
		);
		if (confirmed !== 'confirm') return false;

		try {
			await logStreamingStore.deleteDestination(id);
			return true;
		} catch (error) {
			toast.showError(error, i18n.baseText('error'));
			return false;
		}
	}

	return { confirmAndDelete };
}
