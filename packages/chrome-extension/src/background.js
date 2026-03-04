/**
 * background.js
 * Manifest V3 service worker for the UI Annotator extension.
 *
 * Message protocol:
 *   IN  { action: "ACTIVATE_ANNOTATION", tabId: number }
 *         → inject scripts into tab, send START_ANNOTATION to content script
 *   IN  { action: "ANNOTATION_COMPLETE" }
 *         → update badge to green ✓
 *   IN  { action: "ANNOTATION_ERROR", error: string }
 *         → log the error
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'ACTIVATE_ANNOTATION') {
    activateAnnotation(message.tabId)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // keep channel open for async response
  }

  if (message.action === 'ANNOTATION_COMPLETE') {
    const tabId = sender.tab?.id;
    if (tabId) {
      chrome.action.setBadgeText({ text: '✓', tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#40A02B', tabId });
    }
    return false;
  }

  if (message.action === 'ANNOTATION_ERROR') {
    console.error('[ui-annotator] Annotation error:', message.error);
    return false;
  }
});

/**
 * Inject html2canvas and content.js into the given tab, then activate annotation mode.
 * @param {number} tabId
 * @returns {Promise<void>}
 */
async function activateAnnotation(tabId) {
  // Inject html2canvas first (content.js depends on it being present)
  await chrome.scripting.executeScript({
    target: { tabId },
    files:  ['lib/html2canvas.min.js'],
  });

  // Inject content script (idempotent — re-injection just re-runs it)
  await chrome.scripting.executeScript({
    target: { tabId },
    files:  ['src/content.js'],
  });

  // Tell the content script to start annotation mode
  await chrome.tabs.sendMessage(tabId, { action: 'START_ANNOTATION' });
}
