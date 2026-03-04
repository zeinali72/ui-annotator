# CLAUDE.md — ui-annotator

> **AGENT NOTES (read first)**
> - Always read this file before making any changes.
> - After completing any feature, update the relevant section of this file.
> - Never change the MCP tool signature: `get_ui_feedback()` must always return a `FeedbackBatch` (or `{ error: string }`).
> - Keep `version` fields in `packages/mcp-server/package.json` and `packages/chrome-extension/package.json` in sync on every release.

---

## Current status

| Item | Status |
|---|---|
| Version | 0.1.0 |
| MCP server | ✅ Implemented and tested |
| Chrome extension | ✅ Implemented (manual testing required) |
| Integration tests | ✅ 12/12 passing |
| Last updated | 2026-03-04 |

---

## Project purpose

**ui-annotator** is a local developer tool that lets a developer open their running dev site in Chrome, drop numbered annotation pins on any UI element, write a short comment per pin, capture a screenshot with the pins overlaid, and send the whole bundle to a local MCP server. Claude Code can then call the `get_ui_feedback` MCP tool to read the latest feedback batch and act on it — creating a tight visual-feedback loop between a developer and an AI coding assistant without leaving the terminal.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Developer's Browser (Chrome)                                    │
│                                                                  │
│  ┌──────────────────────────────────┐                            │
│  │  Local Dev Site (localhost:xxxx) │                            │
│  │  ┌────────────────────────────┐  │                            │
│  │  │  content.js (injected)     │  │  ← pins rendered here      │
│  │  │  html2canvas (vendored)    │  │                            │
│  │  └────────────────────────────┘  │                            │
│  └──────────────────────────────────┘                            │
│                                                                  │
│  ┌──────────────────┐   message   ┌────────────────────────┐    │
│  │  popup.js        │ ──────────► │  background.js         │    │
│  │  (popup UI)      │             │  (service worker)      │    │
│  └──────────────────┘             └───────────┬────────────┘    │
└──────────────────────────────────────────────-│------------------┘
                                                │ POST /feedback
                                                │ (JSON + base64 PNG)
                                                ▼
                              ┌─────────────────────────────────┐
                              │  MCP Server (Node.js)           │
                              │                                 │
                              │  httpBridge.js (Express :3333)  │
                              │       │                         │
                              │       ▼                         │
                              │  store.js (in-memory)           │
                              │       │                         │
                              │       ▼                         │
                              │  index.js (MCP via stdio)       │
                              └──────────────┬──────────────────┘
                                             │ stdio (MCP protocol)
                                             ▼
                              ┌─────────────────────────────────┐
                              │  Claude Code                    │
                              │  calls: get_ui_feedback()       │
                              └─────────────────────────────────┘
```

---

## Source file responsibilities

### MCP Server (`packages/mcp-server/src/`)

| File | Responsibility |
|---|---|
| `index.js` | Entry point. Starts the HTTP bridge, creates the `McpServer` instance, registers the `get_ui_feedback` tool, and connects to Claude Code via `StdioServerTransport`. |
| `httpBridge.js` | Exports `buildApp()` (routes) and `startBridge(port)` (listen + returns `{ app, server }`). Handles `POST /feedback`, `GET /health`, `DELETE /feedback`. Calls `saveFeedback()` on valid POSTs. |
| `store.js` | In-memory singleton. Exports `saveFeedback()`, `getLatestFeedback()`, `clearFeedback()`, `hasFeedback()`. Assigns UUID v4 and `receivedAt` timestamp on save. |

### Chrome Extension (`packages/chrome-extension/`)

| File | Responsibility |
|---|---|
| `manifest.json` | MV3 manifest. Declares permissions, content script injection rules, popup, service worker, and icons. |
| `src/content.js` | Injected into the dev site. Manages the pin overlay, listens for click events to place numbered pins, prompts for comments, and handles `CAPTURE` messages by running `html2canvas` and returning the screenshot + annotation data. |
| `src/background.js` | Service worker. Handles `SEND_FEEDBACK` messages from the popup by POSTing the payload to `http://127.0.0.1:3333/feedback`. |
| `src/popup/popup.html` | Popup markup: header, status bar, control buttons, and pin list. |
| `src/popup/popup.css` | Scoped styles for the popup (no external dependencies). |
| `src/popup/popup.js` | Popup logic. Sends messages to `content.js` and `background.js`, refreshes the pin list, manages button state, and displays status feedback. |
| `lib/html2canvas.min.js` | Vendored copy of html2canvas. Must be replaced with the real build (see Installation). |
| `icons/icon128.png` | 128×128 extension icon. Replace the placeholder with a real PNG. |

### Tests (`packages/mcp-server/tests/`)

| File | Responsibility |
|---|---|
| `server.test.js` | Unit tests for `store.js` using Node's built-in test runner. |

---

## Installation and dev workflow

### Prerequisites
- Node.js ≥ 18
- Chrome (or any Chromium-based browser)

### 1. Install dependencies

```bash
# From repo root
npm install
```

### 2. Vendor html2canvas

Download the minified build and replace the placeholder:

```bash
# Option A — via npm
npx --yes html2canvas@latest  # then copy node_modules/html2canvas/dist/html2canvas.min.js
cp node_modules/html2canvas/dist/html2canvas.min.js \
   packages/chrome-extension/lib/html2canvas.min.js

# Option B — direct download
curl -L https://html2canvas.hertzen.com/dist/html2canvas.min.js \
  -o packages/chrome-extension/lib/html2canvas.min.js
```

### 3. Start the MCP server (standalone, for testing)

```bash
cd packages/mcp-server
npm start
# → [http-bridge] Listening on http://127.0.0.1:3333
```

### 4. Run tests

```bash
npm test
# or
cd packages/mcp-server && npm test
```

---

## Loading the extension in Chrome

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the `packages/chrome-extension/` directory (the folder containing `manifest.json`).
5. The **UI Annotator** extension will appear in your toolbar.

> **Tip:** After editing any extension source file, click the reload icon (↺) next to the extension on `chrome://extensions` to pick up changes.

---

## Connecting the MCP server to Claude Code

The ready-to-use config is in `mcp-config.json` at the repo root.
Repo path on this machine: `/home/farzan/ui-annotator`

### Option A — Per-project (recommended)

Copy `mcp-config.json` into your project's Claude Code config directory:

```bash
mkdir -p .claude
cp /home/farzan/ui-annotator/mcp-config.json .claude/mcp_servers.json
```

Or use the Claude Code CLI to register it in one command:

```bash
claude mcp add ui-annotator node /home/farzan/ui-annotator/packages/mcp-server/src/index.js
```

### Option B — Global (available in all Claude Code sessions)

Add the `"ui-annotator"` entry from `mcp-config.json` to:

```
~/.config/claude/mcp_servers.json
```

```json
{
  "mcpServers": {
    "ui-annotator": {
      "command": "node",
      "args": ["/home/farzan/ui-annotator/packages/mcp-server/src/index.js"],
      "env": {}
    }
  }
}
```

### Verifying the connection

After adding the config, restart Claude Code, then run:

```
/mcp
```

You should see `ui-annotator` listed as connected with the `get_ui_feedback` tool available.

### Starting the server

Claude Code will not auto-start the server. Run this before each session:

```bash
cd /home/farzan/ui-annotator && npm start
```

---

## End-to-end feedback flow

1. Developer opens their local dev site in Chrome (e.g., `http://localhost:3000`).
2. Developer clicks the **UI Annotator** icon in the Chrome toolbar to open the popup.
3. Developer clicks **Enable Pin Mode** — the popup sends `ENABLE_PIN_MODE` to `content.js`, which activates the click-to-pin overlay.
4. Developer clicks on a UI element — `content.js` places a numbered pin at the click position, prompts for a comment, and stores `{ id, comment, x, y, selector }`.
5. Developer repeats step 4 for each issue they want to annotate.
6. Developer clicks **Capture & Send** in the popup.
7. `popup.js` sends `CAPTURE` to `content.js`.
8. `content.js` calls `html2canvas(document.body)` to render the page (with pins visible) to a canvas, then returns `{ screenshotDataUrl, annotations, pageUrl }` to the popup.
9. `content.js` POSTs the JSON payload directly to `http://localhost:3847/feedback`.
10. `httpBridge.js` validates the payload and calls `saveFeedback()`, replacing any previous batch in the store.
11. The annotation toolbar shows a green toast **"✓ Sent to Claude! You can now ask Claude Code to review your UI."** for 3 seconds, then annotation mode deactivates.
12. Developer switches to their terminal and asks Claude Code to review the UI feedback.
13. Claude Code calls the `get_ui_feedback()` MCP tool.
14. `index.js` calls `getLatestFeedback()`, returns the screenshot as an `image` content item and the full batch JSON as a `text` content item, then calls `clearFeedback()` to consume the batch.
15. Claude Code receives the annotated screenshot and structured annotations and can now describe, explain, or fix the issues.

---

## Coding conventions

- **Vanilla JS only** — no TypeScript, no bundler, no framework. The extension loads files directly from `src/`.
- **ESLint-free** — rely on code review and careful reading rather than linting tooling (keeps setup minimal).
- **ES Modules** — use `import`/`export` in the MCP server (`"type": "module"` in its `package.json`). The extension uses plain scripts (no `type="module"` in content scripts due to MV3 limitations).
- **Async/await** everywhere; avoid raw `.then()` chains except where required (e.g., keeping a message channel open).
- **JSDoc comments** on every exported function and every non-obvious internal function. Use `@typedef` blocks for shared types (`FeedbackBatch`, `Annotation`).
- **No global state** outside of `store.js` and the `pins` array in `content.js`.
- **Error handling** — always `try/catch` async popup/background code; surface errors to the status bar, not just the console.
- **Port configuration** — the HTTP bridge port defaults to `3847` and can be overridden via the `PORT_BRIDGE` environment variable.

---

## Test strategy

- **MCP Server** — Node built-in test runner (`node --test`). Tests live in `packages/mcp-server/tests/`. Coverage: HTTP bridge integration tests (8 cases — health, POST, validation, DELETE, unique IDs) + store unit tests (4 cases). 12/12 passing.
- **Chrome Extension** — Manual checklist (automated browser testing is out of scope for the initial version):
  - [ ] Pin mode enables/disables correctly
  - [ ] Pins appear at the correct position after clicking
  - [ ] Comment prompt captures text correctly
  - [ ] Clear removes all pins
  - [ ] Capture produces a recognisable screenshot with pins overlaid
  - [ ] Feedback POST reaches the MCP server (verify via `/health` endpoint and server logs)
  - [ ] `get_ui_feedback` returns the expected structure in Claude Code

---

## Known limitations

- **Cross-origin iframes** — `html2canvas` cannot capture content inside cross-origin iframes; those areas will appear blank in the screenshot.
- **Localhost only** — the extension's `host_permissions` and content script matches are restricted to `http://localhost/*` and `http://127.0.0.1/*`. Remote dev servers are not supported without modifying the manifest.
- **Manual server start** — the MCP server must be started manually (`npm start`) before each Claude Code session. Claude Code does not auto-start it.
- **No persistent storage** — feedback is held in memory. If the server restarts before Claude reads the batch, the data is lost.
- **One batch at a time** — a new submission immediately overwrites the previous one. There is no queue or history.
- **html2canvas fidelity** — complex CSS (`clip-path`, custom fonts, SVG filters) and cross-origin assets may not render faithfully.
- **Pin scroll drift** — pins are placed at viewport-relative coordinates at click time; if the page is scrolled significantly between pin placement and capture, positions may appear slightly off.

---

## Future work

- **Auto-start via Claude Code hooks** — use a `pre-tool-use` hook to start the MCP server automatically when `get_ui_feedback` is first called.
- **Remote dev server support** — make allowed origins configurable via an env var so the extension can work against staging or remote tunnels.
- **Multi-batch queue** — replace the single-slot store with a FIFO queue so multiple capture sessions can be queued and consumed in order.
- **VS Code extension** — build an alternative to the Chrome extension that works inside VS Code's embedded browser preview.
- **Highlight affected DOM elements** — after Claude reads feedback, have it return CSS selectors back to the extension so the relevant elements can be highlighted in the page.
- **Next.js app-directory sidebar** — generate a page tree from the `app/` directory and display it in the popup for quick navigation.
