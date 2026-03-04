/**
 * popup.js
 * Controls the extension popup UI.
 * Communicates with content.js (via chrome.tabs.sendMessage) and
 * background.js (via chrome.runtime.sendMessage) to orchestrate
 * pin placement, capture, and feedback submission.
 */

const btnTogglePins = document.getElementById('btn-toggle-pins');
const btnCapture    = document.getElementById('btn-capture');
const btnClear      = document.getElementById('btn-clear');
const statusBar     = document.getElementById('status-bar');
const pinList       = document.getElementById('pin-list');
const pinCount      = document.getElementById('pin-count');

let pinModeActive = false;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Set the status bar text and style.
 * @param {string} text
 * @param {'idle'|'active'|'success'|'error'} type
 */
function setStatus(text, type = 'idle') {
  statusBar.textContent = text;
  statusBar.className = `status ${type}`;
}

/**
 * Send a message to the content script on the active tab.
 * @param {object} message
 * @returns {Promise<any>}
 */
async function sendToContent(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab found.');
  return chrome.tabs.sendMessage(tab.id, message);
}

/**
 * Refresh the pin list in the popup from the content script.
 */
async function refreshPinList() {
  try {
    const { pins } = await sendToContent({ type: 'GET_PINS' });
    pinCount.textContent = String(pins.length);
    pinList.innerHTML = '';
    pins.forEach((pin) => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>#${pin.id}</strong>${pin.comment || '<em>no comment</em>'}`;
      pinList.appendChild(li);
    });
  } catch {
    // Content script may not be injected yet — ignore silently
  }
}

// ─── Button handlers ──────────────────────────────────────────────────────────

btnTogglePins.addEventListener('click', async () => {
  try {
    if (!pinModeActive) {
      await sendToContent({ type: 'ENABLE_PIN_MODE' });
      pinModeActive = true;
      btnTogglePins.textContent = 'Disable Pin Mode';
      setStatus('Pin mode ON — click elements to annotate', 'active');
    } else {
      await sendToContent({ type: 'DISABLE_PIN_MODE' });
      pinModeActive = false;
      btnTogglePins.textContent = 'Enable Pin Mode';
      setStatus('Pin mode OFF', 'idle');
    }
    await refreshPinList();
  } catch (err) {
    setStatus(`Error: ${err.message}`, 'error');
  }
});

btnCapture.addEventListener('click', async () => {
  setStatus('Capturing…', 'active');
  btnCapture.disabled = true;

  try {
    const captureResult = await sendToContent({ type: 'CAPTURE' });

    if (!captureResult?.screenshotDataUrl) {
      throw new Error('Capture returned no data.');
    }

    const sendResult = await chrome.runtime.sendMessage({
      type: 'SEND_FEEDBACK',
      payload: captureResult,
    });

    if (sendResult?.ok) {
      setStatus('Feedback sent! Claude Code can now read it.', 'success');
    } else {
      throw new Error(sendResult?.error ?? 'Unknown send error');
    }
  } catch (err) {
    setStatus(`Error: ${err.message}`, 'error');
  } finally {
    btnCapture.disabled = false;
  }
});

btnClear.addEventListener('click', async () => {
  try {
    await sendToContent({ type: 'CLEAR_PINS' });
    pinModeActive = false;
    btnTogglePins.textContent = 'Enable Pin Mode';
    setStatus('Pins cleared', 'idle');
    await refreshPinList();
  } catch (err) {
    setStatus(`Error: ${err.message}`, 'error');
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────

refreshPinList();
