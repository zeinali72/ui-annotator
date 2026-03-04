# ui-annotator

A local developer tool that lets you drop numbered annotation pins on your running dev site, capture an annotated screenshot, and send everything to Claude Code via MCP — closing the loop between visual UI feedback and AI-assisted code changes.

[screenshot coming soon]

---

## Prerequisites

- **Node.js 18+**
- **Chrome** (or any Chromium-based browser)
- **Claude Code** with MCP support

---

## Quick start

```bash
# 1. Install all dependencies
npm install

# 2. Start the MCP server
npm start

# 3. Load the extension in Chrome (one-time setup — see below)
```

---

## Loading the Chrome extension

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `packages/chrome-extension/` folder
5. The **UI Annotator for Claude Code** icon will appear in your toolbar

> After any source file change, click the ↺ reload button on `chrome://extensions`.

---

## Connecting to Claude Code

Add the following to your Claude Code MCP configuration.

**Project-level** (`.claude/mcp_servers.json` in this repo):

```json
{
  "mcpServers": {
    "ui-annotator": {
      "command": "node",
      "args": ["packages/mcp-server/src/index.js"],
      "cwd": "/absolute/path/to/ui-annotator"
    }
  }
}
```

Replace `/absolute/path/to/ui-annotator` with the actual path on your machine, then restart Claude Code. Verify with `/mcp` — you should see `ui-annotator` listed with the `get_ui_feedback` tool.

---

## How it works

1. Start `npm start` to run the MCP server (HTTP bridge on port 3847 + MCP stdio)
2. Open your dev site on `localhost` in Chrome
3. Click the **UI Annotator** toolbar icon → popup opens, confirms server is running
4. Click **Annotate Current Page** → annotation overlay activates
5. Click any element to drop a numbered pin and type a comment
6. Click **Send to Claude** in the floating toolbar
7. Switch to your terminal and ask Claude: *"Check my UI feedback"*
8. Claude calls `get_ui_feedback()` and receives the screenshot + structured annotations

---

## Project structure

```
ui-annotator/
├── packages/
│   ├── mcp-server/          # Node.js MCP server + Express HTTP bridge
│   │   └── src/
│   │       ├── index.js     # MCP entry, get_ui_feedback tool
│   │       ├── httpBridge.js # POST /feedback receiver (port 3847)
│   │       └── store.js     # In-memory FeedbackBatch store
│   └── chrome-extension/    # Manifest V3 extension (no build step)
│       ├── src/
│       │   ├── content.js   # Annotation engine (pins, capture, send)
│       │   ├── background.js # Service worker, script injection
│       │   └── popup/       # Popup UI
│       └── lib/
│           └── html2canvas.min.js
└── CLAUDE.md                # Full developer + agent documentation
```

---

## Running tests

```bash
npm test
```

Tests use Node's built-in test runner; no additional setup required.

---

## License

MIT
