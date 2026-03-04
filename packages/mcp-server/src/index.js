/**
 * index.js
 * MCP server entry point for ui-annotator.
 *
 * Starts the Express HTTP bridge (Chrome extension → store), then registers
 * the `get_ui_feedback` MCP tool and connects to Claude Code via stdio.
 *
 * MCP tool contract (FROZEN — do not change signature):
 *   get_ui_feedback() → FeedbackBatch (image + JSON text) | text error message
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { getLatestFeedback, clearFeedback } from './store.js';
import { startBridge } from './httpBridge.js';

// ── Read version from package.json ────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf8')
);

// ── HTTP bridge ───────────────────────────────────────────────────────────────
const HTTP_PORT = Number(process.env.PORT_BRIDGE ?? 3847);
startBridge(HTTP_PORT);

// ── MCP server ────────────────────────────────────────────────────────────────
const server = new McpServer({
  name: 'ui-annotator',
  version,
});

server.tool(
  'get_ui_feedback',
  'Retrieve the latest UI feedback batch submitted by the developer via the UI Annotator ' +
  'Chrome extension. Returns an annotated screenshot and structured annotations with CSS ' +
  'selectors and comments. Call this tool when the user says they have submitted feedback ' +
  'or asks you to look at their UI.',
  { type: 'object', properties: {}, required: [] },
  async () => {
    const batch = getLatestFeedback();

    if (!batch) {
      return {
        content: [
          {
            type: 'text',
            text: 'No feedback has been submitted yet. Ask the user to open their dev site in Chrome, click the UI Annotator extension, add annotation pins, and click Send to Claude.',
          },
        ],
      };
    }

    const { screenshotBase64, ...batchMeta } = batch;

    // Consume the batch — each submission is read exactly once
    clearFeedback();

    return {
      content: [
        {
          type: 'image',
          data: screenshotBase64,
          mimeType: 'image/png',
        },
        {
          type: 'text',
          text: JSON.stringify({ screenshotBase64, ...batchMeta }, null, 2),
        },
      ],
    };
  }
);

// ── Connect to Claude Code via stdio ──────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);

console.error('UI Annotator MCP server ready');
