/**
 * background.js
 * Manifest V3 service worker for the UI Annotator extension.
 * Responsibilities:
 *   - Relay capture results from the content script to the MCP HTTP bridge
 *   - Handle any cross-origin fetch that the popup cannot perform directly
 */

const MCP_BRIDGE_URL = 'http://127.0.0.1:3333/feedback';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SEND_FEEDBACK') {
    const { screenshotDataUrl, annotations, pageUrl } = message.payload;

    fetch(MCP_BRIDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screenshotDataUrl, annotations, pageUrl }),
    })
      .then(async (res) => {
        const data = await res.json();
        sendResponse({ ok: res.ok, data });
      })
      .catch((err) => {
        console.error('[background] Failed to send feedback:', err);
        sendResponse({ ok: false, error: err.message });
      });

    return true; // keep message channel open for async response
  }
});
