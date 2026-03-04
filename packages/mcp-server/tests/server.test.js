/**
 * server.test.js
 * Unit and integration tests for the MCP server using Node's built-in test runner.
 * Run with: npm test (from packages/mcp-server)
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { storeBatch, getLatestBatch, clearStore } from '../src/store.js';

describe('store', () => {
  beforeEach(() => {
    clearStore();
  });

  test('getLatestBatch returns null when empty', () => {
    assert.equal(getLatestBatch(), null);
  });

  test('storeBatch persists a batch and getLatestBatch returns it', () => {
    const batch = {
      screenshotDataUrl: 'data:image/png;base64,abc123',
      annotations: [{ id: 1, comment: 'Fix this button', x: 50, y: 30, selector: '#submit-btn' }],
      pageUrl: 'http://localhost:3000',
    };

    storeBatch(batch);
    const result = getLatestBatch();

    assert.equal(result.screenshotDataUrl, batch.screenshotDataUrl);
    assert.deepEqual(result.annotations, batch.annotations);
    assert.equal(result.pageUrl, batch.pageUrl);
    assert.ok(result.receivedAt, 'receivedAt should be set');
  });

  test('storeBatch replaces previous batch', () => {
    storeBatch({ screenshotDataUrl: 'data:image/png;base64,old', annotations: [], pageUrl: '' });
    storeBatch({ screenshotDataUrl: 'data:image/png;base64,new', annotations: [], pageUrl: '' });

    const result = getLatestBatch();
    assert.equal(result.screenshotDataUrl, 'data:image/png;base64,new');
  });

  test('clearStore resets to null', () => {
    storeBatch({ screenshotDataUrl: 'data:image/png;base64,x', annotations: [], pageUrl: '' });
    clearStore();
    assert.equal(getLatestBatch(), null);
  });
});

// TODO: Add integration tests for the HTTP bridge endpoints using fetch()
