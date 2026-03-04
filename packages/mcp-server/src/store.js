/**
 * store.js
 * In-memory store for the latest feedback batch received from the Chrome extension.
 * Only the most recent batch is retained; older batches are replaced on each POST.
 *
 * @typedef {Object} Annotation
 * @property {number} id        - Pin number (1-based)
 * @property {string} comment   - Developer comment for this pin
 * @property {number} x         - Horizontal position as a percentage of page width
 * @property {number} y         - Vertical position as a percentage of page height
 * @property {string} selector  - CSS selector of the target element (best-effort)
 *
 * @typedef {Object} FeedbackBatch
 * @property {string}       screenshotDataUrl - Base64 PNG data URL with pins overlaid
 * @property {Annotation[]} annotations       - Ordered list of annotation pins
 * @property {string}       pageUrl           - URL of the page that was annotated
 * @property {string}       receivedAt        - ISO 8601 timestamp of when the batch arrived
 */

/** @type {FeedbackBatch | null} */
let latestBatch = null;

/**
 * Store a new feedback batch, replacing any previous one.
 * @param {FeedbackBatch} batch
 */
export function storeBatch(batch) {
  latestBatch = { ...batch, receivedAt: new Date().toISOString() };
}

/**
 * Retrieve the latest feedback batch.
 * @returns {FeedbackBatch | null}
 */
export function getLatestBatch() {
  return latestBatch;
}

/**
 * Clear the store (useful for testing).
 */
export function clearStore() {
  latestBatch = null;
}
