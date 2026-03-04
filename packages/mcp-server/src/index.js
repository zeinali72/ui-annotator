/**
 * index.js
 * MCP server entry point.
 * Starts the Express HTTP bridge (for the Chrome extension) and registers the
 * `get_ui_feedback` MCP tool (consumed by Claude Code).
 *
 * MCP tool:
 *   get_ui_feedback() → FeedbackBatch | { error: string }
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getLatestBatch } from './store.js';
import { startHttpBridge } from './httpBridge.js';

const HTTP_PORT = Number(process.env.UI_ANNOTATOR_PORT ?? 3333);

// Start the HTTP bridge so the Chrome extension can POST feedback
startHttpBridge(HTTP_PORT);

// Create the MCP server
const server = new McpServer({
  name: 'ui-annotator',
  version: '1.0.0',
});

server.tool(
  'get_ui_feedback',
  'Retrieve the latest UI feedback batch captured by the UI Annotator Chrome extension. ' +
  'Returns a screenshot (base64 PNG data URL) and structured annotations with comments.',
  {},
  async () => {
    const batch = getLatestBatch();

    if (!batch) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: 'No feedback available yet. Use the Chrome extension to capture an annotation.' }),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(batch),
        },
      ],
    };
  }
);

// Connect to Claude Code via stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);

console.error('[mcp] ui-annotator MCP server running on stdio');
