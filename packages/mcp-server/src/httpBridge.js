/**
 * httpBridge.js
 * Express HTTP server that acts as the bridge between the Chrome extension
 * and the MCP server. The extension POSTs feedback here; the MCP tool reads
 * from the shared in-memory store.
 *
 * Endpoints:
 *   POST /feedback   — receive a FeedbackBatch from the extension
 *   GET  /health     — liveness check (returns 200 OK)
 */

import express from 'express';
import { storeBatch } from './store.js';

const DEFAULT_PORT = 3333;

/**
 * Create and start the Express HTTP bridge.
 * @param {number} [port]
 * @returns {import('http').Server}
 */
export function startHttpBridge(port = DEFAULT_PORT) {
  const app = express();

  app.use(express.json({ limit: '20mb' }));

  // Allow requests from any localhost origin (the extension and dev sites)
  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    next();
  });

  app.options('*', (_req, res) => res.sendStatus(204));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/feedback', (req, res) => {
    const { screenshotDataUrl, annotations, pageUrl } = req.body;

    if (!screenshotDataUrl || !Array.isArray(annotations)) {
      return res.status(400).json({ error: 'Invalid payload: screenshotDataUrl and annotations are required.' });
    }

    storeBatch({ screenshotDataUrl, annotations, pageUrl: pageUrl ?? '' });
    console.log(`[http-bridge] Received feedback batch — ${annotations.length} pin(s) from ${pageUrl}`);
    res.json({ ok: true });
  });

  const server = app.listen(port, '127.0.0.1', () => {
    console.log(`[http-bridge] Listening on http://127.0.0.1:${port}`);
  });

  return server;
}
