/**
 * store.js
 * File-based store for the latest FeedbackBatch received from the Chrome extension.
 * Uses a temp file so multiple processes (HTTP bridge instance and MCP stdio instance)
 * share the same feedback data — solving the split-process problem where one instance
 * receives the POST and a different instance handles get_ui_feedback().
 *
 * @typedef {Object} Annotation
 * @property {number}      id                - Pin number shown on screenshot (1-based)
 * @property {string}      selector          - CSS selector of the target element
 * @property {string}      elementTag        - Tag name of the target element, e.g. "button"
 * @property {string}      elementText       - Trimmed innerText of the element (max 100 chars)
 * @property {number}      x                 - Pin x position as percentage of page width
 * @property {number}      y                 - Pin y position as percentage of page height
 * @property {string}      comment           - Developer comment for this pin
 * @property {string|null} elementScreenshot - JPEG base64 of just this element (no data: prefix), or null
 *
 * @typedef {Object} FeedbackBatch
 * @property {string}       id          - UUID v4 assigned on receipt
 * @property {string}       receivedAt  - ISO 8601 timestamp of receipt
 * @property {string}       pageUrl     - URL of the annotated page
 * @property {string}       pageTitle   - Document title of the annotated page
 * @property {Annotation[]} annotations - Ordered list of annotation pins
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const STORE_PATH = join(tmpdir(), 'ui-annotator-feedback.json');

/**
 * Save a new feedback batch, replacing any previous one.
 * Assigns a UUID and receivedAt timestamp server-side.
 * @param {Omit<FeedbackBatch, 'id' | 'receivedAt'>} batch
 * @returns {FeedbackBatch} The stored batch with id and receivedAt populated.
 */
export function saveFeedback(batch) {
  const stored = {
    ...batch,
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
  };
  writeFileSync(STORE_PATH, JSON.stringify(stored), 'utf8');
  return stored;
}

/**
 * Retrieve the latest feedback batch without consuming it.
 * @returns {FeedbackBatch | null}
 */
export function getLatestFeedback() {
  if (!existsSync(STORE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Clear the store.
 */
export function clearFeedback() {
  if (existsSync(STORE_PATH)) unlinkSync(STORE_PATH);
}

/**
 * Check whether a feedback batch is waiting to be consumed.
 * @returns {boolean}
 */
export function hasFeedback() {
  return existsSync(STORE_PATH);
}
