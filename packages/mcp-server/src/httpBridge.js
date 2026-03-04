/**
 * httpBridge.js
 * Express HTTP server bridging the Chrome extension and the MCP server.
 *
 * Endpoints:
 *   POST   /feedback  — receive a FeedbackBatch from the extension
 *   GET    /health    — liveness check
 *   DELETE /feedback  — clear the current feedback batch
 */

import express from 'express';
import cors from 'cors';
import { saveFeedback, clearFeedback, hasFeedback } from './store.js';

const DEFAULT_PORT = 3847;

/**
 * Request logger middleware.
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const ts = new Date().toISOString();
    console.error(`[${ts}] ${req.method} ${req.path} → ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
}

/**
 * Build the Express app (routes only, no listen).
 * Exported separately so tests can mount it without starting a real server.
 * @returns {import('express').Application}
 */
export function buildApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '25mb' }));
  app.use(requestLogger);

  // ── GET /health ────────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', hasFeedback: hasFeedback() });
  });

  // ── POST /feedback ─────────────────────────────────────────────────────────
  app.post('/feedback', (req, res) => {
    const { pageUrl, screenshotBase64, annotations } = req.body ?? {};

    if (!pageUrl || typeof pageUrl !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid field: pageUrl (string required).' });
    }
    if (!screenshotBase64 || typeof screenshotBase64 !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid field: screenshotBase64 (base64 string required).' });
    }
    if (!Array.isArray(annotations)) {
      return res.status(400).json({ error: 'Missing or invalid field: annotations (array required).' });
    }

    const batch = saveFeedback({
      pageUrl,
      pageTitle: typeof req.body.pageTitle === 'string' ? req.body.pageTitle : '',
      screenshotBase64,
      annotations,
    });

    console.error(`[http-bridge] Stored feedback batch ${batch.id} — ${annotations.length} annotation(s) from ${pageUrl}`);
    res.json({ success: true, id: batch.id });
  });

  // ── DELETE /feedback ───────────────────────────────────────────────────────
  app.delete('/feedback', (_req, res) => {
    clearFeedback();
    res.json({ success: true });
  });

  return app;
}

/**
 * Start the HTTP bridge on the given port.
 * Returns both the Express app and the raw http.Server so callers can close it.
 * @param {number} [port]
 * @returns {{ app: import('express').Application, server: import('http').Server }}
 */
export function startBridge(port = DEFAULT_PORT) {
  const app = buildApp();
  const server = app.listen(port, '127.0.0.1', () => {
    console.error(`UI Annotator HTTP bridge listening on port ${port}`);
  });
  return { app, server };
}

// Keep the old name as an alias so any external callers are not broken.
export const startHttpBridge = (port = DEFAULT_PORT) => startBridge(port).server;
