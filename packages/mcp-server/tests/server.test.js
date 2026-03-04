/**
 * server.test.js
 * Unit tests for the MCP server using Node's built-in test runner.
 * Run with: npm test (from packages/mcp-server)
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { saveFeedback, getLatestFeedback, clearFeedback, hasFeedback } from '../src/store.js';

const SAMPLE_BATCH = {
  pageUrl: 'http://localhost:3000',
  pageTitle: 'My Dev App',
  screenshotBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk',
  annotations: [
    {
      id: 1,
      selector: '#submit-btn',
      elementTag: 'button',
      elementText: 'Submit',
      x: 42.5,
      y: 67.2,
      comment: 'This button colour does not meet contrast requirements.',
    },
  ],
};

describe('store', () => {
  beforeEach(() => {
    clearFeedback();
  });

  test('getLatestFeedback returns null when store is empty', () => {
    assert.equal(getLatestFeedback(), null);
  });

  test('hasFeedback returns false when store is empty', () => {
    assert.equal(hasFeedback(), false);
  });

  test('saveFeedback stores a batch and returns it with id and receivedAt', () => {
    const result = saveFeedback(SAMPLE_BATCH);

    assert.ok(result.id, 'id should be set');
    assert.match(result.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, 'id should be a UUID v4');
    assert.ok(result.receivedAt, 'receivedAt should be set');
    assert.doesNotThrow(() => new Date(result.receivedAt), 'receivedAt should be a valid date');
    assert.equal(result.pageUrl, SAMPLE_BATCH.pageUrl);
    assert.deepEqual(result.annotations, SAMPLE_BATCH.annotations);
  });

  test('getLatestFeedback returns stored batch', () => {
    saveFeedback(SAMPLE_BATCH);
    const batch = getLatestFeedback();
    assert.ok(batch);
    assert.equal(batch.pageUrl, SAMPLE_BATCH.pageUrl);
  });

  test('hasFeedback returns true after saveFeedback', () => {
    saveFeedback(SAMPLE_BATCH);
    assert.equal(hasFeedback(), true);
  });

  test('saveFeedback replaces previous batch', () => {
    saveFeedback({ ...SAMPLE_BATCH, pageUrl: 'http://localhost:3000/old' });
    saveFeedback({ ...SAMPLE_BATCH, pageUrl: 'http://localhost:3000/new' });
    assert.equal(getLatestFeedback().pageUrl, 'http://localhost:3000/new');
  });

  test('clearFeedback resets to null', () => {
    saveFeedback(SAMPLE_BATCH);
    clearFeedback();
    assert.equal(getLatestFeedback(), null);
    assert.equal(hasFeedback(), false);
  });

  test('saveFeedback does not mutate the input object', () => {
    const input = { ...SAMPLE_BATCH };
    saveFeedback(input);
    assert.equal(input.id, undefined, 'input should not gain id property');
    assert.equal(input.receivedAt, undefined, 'input should not gain receivedAt property');
  });
});
