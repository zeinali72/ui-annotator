/**
 * background.js
 * Manifest V3 service worker for the UI Annotator extension.
 *
 * Responsibilities:
 *   - Listen for the toolbar action click and inject the content script + activate
 *     annotation mode on the active tab.
 *   - (content.js posts directly to the HTTP bridge — no relay needed here.)
 */

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  try {
    // Ensure content script is injected (idempotent — manifest already injects it
    // on matching origins, but scripting.executeScript covers manual activation on
    // any tab the user has open).
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files:  ['lib/html2canvas.min.js', 'src/content.js'],
    });
  } catch {
    // Script may already be injected — proceed to send the message regardless
  }

  chrome.tabs.sendMessage(tab.id, { action: 'START_ANNOTATION' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[background] Could not start annotation:', chrome.runtime.lastError.message);
    } else {
      console.log('[background] Annotation mode started:', response);
    }
  });
});
