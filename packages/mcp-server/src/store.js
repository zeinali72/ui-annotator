/**
 * store.js
 * In-memory store for the latest FeedbackBatch received from the Chrome extension.
 * Only the most recent batch is retained; each batch is consumed once by get_ui_feedback.
 *
 * @typedef {Object} Annotation
 * @property {number} id          - Pin number shown on screenshot (1-based)
 * @property {string} selector    - CSS selector of the target element
 * @property {string} elementTag  - Tag name of the target element, e.g. "button"
 * @property {string} elementText - Trimmed innerText of the element (max 100 chars)
 * @property {number} x           - Pin x position as percentage of page width
 * @property {number} y           - Pin y position as percentage of page height
 * @property {string} comment     - Developer comment for this pin
 *
 * @typedef {Object} FeedbackBatch
 * @property {string}       id                - UUID v4 assigned on receipt
 * @property {string}       receivedAt        - ISO 8601 timestamp of receipt
 * @property {string}       pageUrl           - URL of the annotated page
 * @property {string}       pageTitle         - Document title of the annotated page
 * @property {string}       screenshotBase64  - Raw PNG base64 string (no data: prefix)
 * @property {Annotation[]} annotations       - Ordered list of annotation pins
 */

/** @type {FeedbackBatch | null} */
let latestBatch = null;

/**
 * Save a new feedback batch, replacing any previous one.
 * Assigns a UUID and receivedAt timestamp server-side.
 * @param {Omit<FeedbackBatch, 'id' | 'receivedAt'>} batch
 * @returns {FeedbackBatch} The stored batch with id and receivedAt populated.
 */
export function saveFeedback(batch) {
  latestBatch = {
    ...batch,
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
  };
  return latestBatch;
}

/**
 * Retrieve the latest feedback batch without consuming it.
 * @returns {FeedbackBatch | null}
 */
export function getLatestFeedback() {
  return latestBatch;
}

/**
 * Clear the store.
 */
export function clearFeedback() {
  latestBatch = null;
}

/**
 * Check whether a feedback batch is waiting to be consumed.
 * @returns {boolean}
 */
export function hasFeedback() {
  return latestBatch !== null;
}
