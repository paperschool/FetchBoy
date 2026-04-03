/** Default timeout for the entire script execution (ms) */
export const SCRIPT_TIMEOUT_MS = 30_000;

/** Default timeout per individual HTTP sub-request (ms) */
export const HTTP_SUB_REQUEST_TIMEOUT_MS = 10_000;

/** Supported HTTP methods for fb.http API */
export const FB_HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
