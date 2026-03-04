/**
 * popup.js
 * Controls the UI Annotator popup.
 * - Checks MCP server health on load
 * - Activates annotation mode on button click
 */

const statusDot  = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const statusHint = document.getElementById('status-hint');
const btnAnnotate = document.getElementById('btn-annotate');
const errorMsg   = document.getElementById('error-msg');

const HEALTH_URL = 'http://localhost:3847/health';
const HEALTH_TIMEOUT_MS = 2000;

// ─── Server health check ──────────────────────────────────────────────────────

/**
 * Fetch the MCP server health endpoint with a 2 s timeout.
 * @returns {Promise<{ok: boolean, hasFeedback?: boolean}>}
 */
async function checkServerHealth() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  try {
    const res = await fetch(HEALTH_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { ok: false };
    const data = await res.json();
    return { ok: true, hasFeedback: data.hasFeedback };
  } catch {
    clearTimeout(timer);
    return { ok: false };
  }
}

function setServerOk() {
  statusDot.className = 'status-dot ok';
  statusText.innerHTML = '<strong>Server running</strong>';
  statusHint.textContent = '';
  btnAnnotate.disabled = false;
}

function setServerDown() {
  statusDot.className = 'status-dot error';
  statusText.innerHTML = '<strong>Server not running</strong>';
  statusHint.textContent = 'npm start  (in packages/mcp-server)';
  btnAnnotate.disabled = true;
}

// ─── Error display ────────────────────────────────────────────────────────────

/**
 * @param {string} text
 */
function showError(text) {
  errorMsg.textContent = text;
  errorMsg.classList.add('visible');
}

function clearError() {
  errorMsg.classList.remove('visible');
  errorMsg.textContent = '';
}

// ─── Annotate button ──────────────────────────────────────────────────────────

btnAnnotate.addEventListener('click', async () => {
  clearError();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || !tab.url) {
    showError('No active tab found.');
    return;
  }

  const url = tab.url;
  if (!url.startsWith('http://localhost') && !url.startsWith('http://127.0.0.1')) {
    showError('UI Annotator only works on localhost');
    return;
  }

  chrome.runtime.sendMessage(
    { action: 'ACTIVATE_ANNOTATION', tabId: tab.id },
    (response) => {
      if (chrome.runtime.lastError) {
        showError(`Could not activate: ${chrome.runtime.lastError.message}`);
        return;
      }
      if (!response?.ok) {
        showError(`Activation failed: ${response?.error ?? 'unknown error'}`);
        return;
      }
      window.close();
    }
  );
});

// ─── Init ─────────────────────────────────────────────────────────────────────

(async () => {
  const { ok } = await checkServerHealth();
  if (ok) {
    setServerOk();
  } else {
    setServerDown();
  }
})();
