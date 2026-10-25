/** REST root for the legacy single-connection external-secrets API. */
export const EXTERNAL_SECRETS_API_ROOT = 'external-secrets';

/** REST root for the multi-connection secret-providers API. */
export const SECRET_PROVIDERS_API_ROOT = 'secret-providers';

/**
 * Placeholder every secret resolves to in the editor. Only secret names reach
 * the frontend, so expression previews show this mask instead of a value.
 */
export const EXTERNAL_SECRET_MASK = '*********';
