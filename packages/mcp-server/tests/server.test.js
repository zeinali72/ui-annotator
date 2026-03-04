/**
 * server.test.js
 * Full test suite for the MCP server — HTTP bridge and store.
 * Run with: npm test (from packages/mcp-server)
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { startBridge } from '../src/httpBridge.js';
import { saveFeedback, getLatestFeedback, clearFeedback, hasFeedback } from '../src/store.js';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const TEST_PORT = 3848;
const BASE_URL  = `http://127.0.0.1:${TEST_PORT}`;

const VALID_PAYLOAD = {
  pageUrl:   'http://localhost:3000/dashboard',
  pageTitle: 'My Dev App',
  annotations: [
    {
      id:                1,
      selector:          '#submit-btn',
      elementTag:        'button',
      elementText:       'Submit',
      x:                 42.5,
      y:                 67.2,
      comment:           'Button colour fails WCAG contrast ratio.',
      elementScreenshot: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk',
    },
  ],
};

// ─── HTTP Bridge ──────────────────────────────────────────────────────────────

describe('HTTP Bridge', () => {
  let server;

  before(() => {
    ({ server } = startBridge(TEST_PORT));
  });

  after(() => {
    server.close();
    clearFeedback();
  });

  beforeEach(() => {
    clearFeedback();
  });

  // ── GET /health ─────────────────────────────────────────────────────────────

  test('GET /health returns ok with no feedback', async () => {
    const res  = await fetch(`${BASE_URL}/health`);
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.status, 'ok');
    assert.strictEqual(body.hasFeedback, false);
  });

  // ── POST /feedback ──────────────────────────────────────────────────────────

  test('POST /feedback stores a valid batch', async () => {
    const res  = await fetch(`${BASE_URL}/feedback`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(VALID_PAYLOAD),
    });
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.success, true);
    assert.ok(body.id, 'response should include a batch id');
    assert.match(
      body.id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      'id should be UUID v4'
    );
  });

  test('GET /health shows hasFeedback true after POST', async () => {
    // Establish state in this test — do not rely on sibling test order
    await fetch(`${BASE_URL}/feedback`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(VALID_PAYLOAD),
    });

    const res  = await fetch(`${BASE_URL}/health`);
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.hasFeedback, true);
  });

  // ── Validation errors ───────────────────────────────────────────────────────

  test('POST /feedback rejects missing pageUrl', async () => {
    const { pageUrl: _, ...noUrl } = VALID_PAYLOAD;
    const res  = await fetch(`${BASE_URL}/feedback`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(noUrl),
    });
    const body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.ok(body.error, 'error field should be present');
  });

  test('POST /feedback accepts payload without screenshotBase64', async () => {
    const res  = await fetch(`${BASE_URL}/feedback`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(VALID_PAYLOAD),
    });
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.ok(body.id, 'id field should be present');
  });

  test('POST /feedback rejects non-array annotations', async () => {
    const res  = await fetch(`${BASE_URL}/feedback`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...VALID_PAYLOAD, annotations: 'not-an-array' }),
    });
    const body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.ok(body.error, 'error field should be present');
  });

  // ── DELETE /feedback ────────────────────────────────────────────────────────

  test('DELETE /feedback clears the store', async () => {
    // First populate the store
    await fetch(`${BASE_URL}/feedback`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(VALID_PAYLOAD),
    });

    const del  = await fetch(`${BASE_URL}/feedback`, { method: 'DELETE' });
    const delBody = await del.json();
    assert.strictEqual(del.status, 200);
    assert.strictEqual(delBody.success, true);

    const health  = await fetch(`${BASE_URL}/health`);
    const healthBody = await health.json();
    assert.strictEqual(healthBody.hasFeedback, false);
  });

  // ── Unique ids ──────────────────────────────────────────────────────────────

  test('POST /feedback generates unique ids for successive posts', async () => {
    const post = () => fetch(`${BASE_URL}/feedback`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(VALID_PAYLOAD),
    }).then(r => r.json());

    const [a, b] = await Promise.all([post(), post()]);

    assert.ok(a.id, 'first id should exist');
    assert.ok(b.id, 'second id should exist');
    assert.notStrictEqual(a.id, b.id, 'ids should differ across posts');
  });
});

// ─── Feedback Store ───────────────────────────────────────────────────────────

describe('Feedback Store', () => {
  beforeEach(() => {
    clearFeedback();
  });

  test('getLatestFeedback returns null initially', () => {
    assert.strictEqual(getLatestFeedback(), null);
  });

  test('saveFeedback then getLatestFeedback returns the batch', () => {
    const input = {
      pageUrl:          'http://localhost:3000',
      pageTitle:        'Test Page',
      screenshotBase64: 'abc123',
      annotations:      [],
    };

    const saved = saveFeedback(input);

    assert.ok(saved.id,          'saved batch should have an id');
    assert.ok(saved.receivedAt,  'saved batch should have receivedAt');
    assert.strictEqual(saved.pageUrl, input.pageUrl);

    const retrieved = getLatestFeedback();
    assert.ok(retrieved);
    assert.strictEqual(retrieved.id, saved.id);
    assert.strictEqual(retrieved.pageUrl, input.pageUrl);
  });

  test('clearFeedback resets to null', () => {
    saveFeedback({ pageUrl: 'http://localhost:3000', pageTitle: '', screenshotBase64: 'x', annotations: [] });
    clearFeedback();
    assert.strictEqual(getLatestFeedback(), null);
  });

  test('hasFeedback reflects store state correctly', () => {
    assert.strictEqual(hasFeedback(), false);
    saveFeedback({ pageUrl: 'http://localhost:3000', pageTitle: '', screenshotBase64: 'x', annotations: [] });
    assert.strictEqual(hasFeedback(), true);
    clearFeedback();
    assert.strictEqual(hasFeedback(), false);
  });
});
