# UI Annotator for Claude Code

> **Drop numbered pins on your running dev site, capture an annotated screenshot, and let Claude Code read and fix your UI issues — without leaving the terminal.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18%2B-brightgreen)](https://nodejs.org/)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-purple)](https://modelcontextprotocol.io/)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-yellow)](packages/chrome-extension/)
[![Tests](https://img.shields.io/badge/Tests-12%2F12%20passing-brightgreen)](#running-tests)

![UI Annotator Demo](docs/demo.gif)
<!-- Replace with a real GIF/screenshot once available -->

---

## What is UI Annotator?

**UI Annotator** is a local developer tool that bridges visual UI feedback and AI-assisted code changes. It consists of two parts:

- **A Chrome extension** — activates an annotation overlay on any `localhost` tab, lets you click to place numbered pins, type comments, and capture an annotated screenshot.
- **An MCP server** — receives the screenshot and annotations from the extension and exposes a `get_ui_feedback()` tool that Claude Code can call directly.

The result: you point at a bug, describe it, press a button, and Claude Code sees exactly what you see — no copy-pasting, no context loss.

---

## Why developers love it

- **Zero friction** — no cloud services, no auth, no uploads. Everything runs locally.
- **Works with any stack** — React, Vue, Next.js, plain HTML, anything served on localhost.
- **Structured feedback** — Claude receives a screenshot *and* structured JSON (`selector`, `coordinates`, `comment`) for each pin, so it can target the exact element.
- **MCP-native** — plugs directly into Claude Code via the [Model Context Protocol](https://modelcontextprotocol.io/). No custom glue code needed.
- **No build step** — the Chrome extension is vanilla JS loaded directly from source.

---

## Demo

1. Open your local dev site in Chrome.
2. Click the **UI Annotator** icon → annotation overlay activates.
3. Click any element, type a comment, repeat for every issue.
4. Click **Send to Claude** in the floating toolbar.
5. In your terminal: *"Check my UI feedback"*
6. Claude calls `get_ui_feedback()`, sees the annotated screenshot, and fixes the code.

```
Developer → pins UI bug → captures screenshot → sends to MCP server
                                                        ↓
Claude Code ← calls get_ui_feedback() ← reads screenshot + annotations
                                                        ↓
                              Claude describes and fixes the issue
```

---

## Prerequisites

- **Node.js 18+**
- **Chrome** (or any Chromium-based browser)
- **Claude Code** with MCP support (`claude mcp` command available)

---

## Installation

### 1. Clone and install

```bash
git clone https://github.com/your-username/ui-annotator.git
cd ui-annotator
npm install
```

### 2. Vendor html2canvas (one-time)

```bash
curl -L https://html2canvas.hertzen.com/dist/html2canvas.min.js \
  -o packages/chrome-extension/lib/html2canvas.min.js
```

### 3. Connect to Claude Code

```bash
claude mcp add ui-annotator node /absolute/path/to/ui-annotator/packages/mcp-server/src/index.js
```

Then restart Claude Code and verify:

```
/mcp
# → ui-annotator  ✓  get_ui_feedback
```

> Claude Code auto-starts the MCP server — no need to run `npm start` manually.

### 4. Load the Chrome extension

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `packages/chrome-extension/` folder

The **UI Annotator** icon appears in your toolbar. Done.

---

## Usage

1. Navigate to your dev site on `localhost` in Chrome.
2. Click the **UI Annotator** toolbar icon.
3. Click **Enable Pin Mode** and click on any element to annotate it.
4. Click **Capture & Send** when you're done.
5. Ask Claude Code: *"Review my UI feedback"* or *"Check my UI annotations"*.

Claude calls `get_ui_feedback()` and receives:
- A full-page screenshot with pins overlaid
- Structured annotations: `{ id, comment, x, y, selector }` per pin

---

## How it works (architecture)

```
Chrome Extension
  └─ content.js        ← renders pins, captures screenshot via html2canvas
  └─ background.js     ← POSTs payload to MCP server

MCP Server (Node.js, port 3847)
  └─ httpBridge.js     ← Express: POST /feedback, GET /health
  └─ store.js          ← holds latest FeedbackBatch in memory
  └─ index.js          ← registers get_ui_feedback() MCP tool via stdio

Claude Code
  └─ calls get_ui_feedback() → receives screenshot + annotations
```

For a full architecture diagram and developer notes, see [CLAUDE.md](CLAUDE.md).

---

## Project structure

```
ui-annotator/
├── packages/
│   ├── mcp-server/              # Node.js MCP server + Express HTTP bridge
│   │   ├── src/
│   │   │   ├── index.js         # MCP entry, get_ui_feedback tool
│   │   │   ├── httpBridge.js    # POST /feedback receiver (port 3847)
│   │   │   └── store.js         # In-memory FeedbackBatch store
│   │   └── tests/
│   │       └── server.test.js   # 12 integration + unit tests
│   └── chrome-extension/        # Manifest V3 extension (no build step)
│       ├── src/
│       │   ├── content.js       # Annotation overlay and capture engine
│       │   ├── background.js    # Service worker, POST to MCP server
│       │   └── popup/           # Popup UI (HTML/CSS/JS)
│       └── lib/
│           └── html2canvas.min.js
├── mcp-config.json              # Ready-to-use MCP config snippet
└── CLAUDE.md                    # Full developer + agent documentation
```

---

## Running tests

```bash
npm test
# 12/12 passing — HTTP bridge integration + store unit tests
```

Tests use Node's built-in test runner. No extra setup required.

---

## Configuration

| Environment variable | Default | Description |
|---|---|---|
| `PORT_BRIDGE` | `3847` | Port the HTTP bridge listens on |

---

## Known limitations

- **Localhost only** — the extension only runs on `http://localhost/*` and `http://127.0.0.1/*`. Edit `manifest.json` to support remote dev servers.
- **Cross-origin iframes** — html2canvas cannot capture content inside cross-origin iframes.
- **One batch at a time** — a new capture overwrites the previous one. No queue yet.
- **Pin scroll drift** — pins placed before scrolling may appear slightly offset in the screenshot.

---

## Roadmap

- [ ] Remote dev server support (configurable allowed origins)
- [ ] Multi-batch queue (FIFO)
- [ ] Auto-highlight DOM elements after Claude reads feedback
- [ ] VS Code extension variant
- [ ] Pre-built extension in the Chrome Web Store

---

## Contributing

Contributions are welcome! The codebase is intentionally minimal — vanilla JS, no bundler, no framework.

1. Fork and clone the repo
2. `npm install`
3. Make your change
4. `npm test` — all 12 tests must pass
5. Open a pull request

Please read [CLAUDE.md](CLAUDE.md) before contributing — it contains the full architecture, coding conventions, and rules the AI agent follows.

---

## Related projects

- [Model Context Protocol](https://modelcontextprotocol.io/) — the open standard this tool is built on
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — the AI coding assistant this tool integrates with
- [html2canvas](https://html2canvas.hertzen.com/) — the screenshot library used in the extension

---

## License

MIT © 2025

---

## SEO & GitHub growth guide

> This section is for the repository owner. Delete it before publishing or move it to a private doc.

### Getting Google visibility

The README above is already structured for SEO, but here is what else you should do:

**Keywords to target naturally:**
- "Claude Code MCP tool"
- "UI feedback for AI coding assistant"
- "annotate localhost Chrome extension"
- "MCP server Chrome extension"
- "visual feedback loop Claude Code"

**Actions:**
1. Set the GitHub repo **description** (the one-liner under the repo name) to:
   > Chrome extension + MCP server that lets you annotate your localhost UI and send it directly to Claude Code.
2. Add **Topics** on GitHub (gear icon on repo page): `mcp`, `claude-code`, `chrome-extension`, `developer-tools`, `ai-coding`, `model-context-protocol`, `localhost`, `ui-feedback`
3. Create a `docs/` folder and add a real **demo GIF** — repos with visuals get indexed better and starred more.
4. Submit to **awesome lists**: search GitHub for `awesome-mcp-servers`, `awesome-claude`, `awesome-developer-tools` and open a PR adding your repo.

### Getting GitHub stars

**Before publishing:**
- [ ] Replace the placeholder demo GIF with a real 30-second screen recording (use LICEcap, Kap, or OBS → GIF).
- [ ] Add a real 128×128 extension icon.
- [ ] Make sure `npm install && npm test` passes on a fresh clone.

**After publishing:**
- Post on [Hacker News](https://news.ycombinator.com/submit) as **Show HN: UI Annotator — drop pins on localhost and let Claude Code fix your UI**.
- Post in the [Claude Discord](https://discord.gg/anthropic) `#tools-and-integrations` channel.
- Post on [r/ClaudeAI](https://www.reddit.com/r/ClaudeAI/) and [r/webdev](https://www.reddit.com/r/webdev/).
- Submit to the [MCP server registry](https://github.com/modelcontextprotocol/servers) if one exists.
- Tweet/X with hashtags: `#ClaudeCode`, `#MCP`, `#DeveloperTools`, `#AI`.
- Write a short blog post (dev.to or your own site) explaining the workflow — link back to the repo.

**Sustaining growth:**
- Respond quickly to issues and PRs to build trust.
- Add a `CHANGELOG.md` and tag releases — it signals an active project.
- Keep the `npm test` badge green at all times.
