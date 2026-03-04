/**
 * content.js
 * Injected into the developer's local page as a content script.
 * Responsibilities:
 *   - Render the annotation overlay (pin drop mode toggle)
 *   - Listen for click events to place numbered pins on elements
 *   - Store pins with their comments, positions, and CSS selectors
 *   - On capture request (from popup via chrome.runtime message):
 *       1. Render all pins visually on the page
 *       2. Use html2canvas to capture the full page with pins overlaid
 *       3. Return the screenshot data URL + structured annotations to the popup
 */

/** @type {Array<{id: number, comment: string, x: number, y: number, selector: string, el: HTMLElement}>} */
const pins = [];
let pinModeActive = false;
let nextPinId = 1;

// ─── Overlay container ────────────────────────────────────────────────────────

const overlay = document.createElement('div');
overlay.id = '__ui-annotator-overlay__';
Object.assign(overlay.style, {
  position: 'fixed',
  top: '0',
  left: '0',
  width: '100%',
  height: '100%',
  zIndex: '2147483646',
  pointerEvents: 'none',
  cursor: 'crosshair',
});
document.body.appendChild(overlay);

// ─── Pin helpers ──────────────────────────────────────────────────────────────

/**
 * Build a CSS selector for an element (id > class chain > tag).
 * @param {Element} el
 * @returns {string}
 */
function buildSelector(el) {
  if (el.id) return `#${el.id}`;
  const classes = Array.from(el.classList).slice(0, 3).join('.');
  return classes ? `${el.tagName.toLowerCase()}.${classes}` : el.tagName.toLowerCase();
}

/**
 * Create and append a pin DOM node to the overlay.
 * @param {{id: number, x: number, y: number}} pin
 * @returns {HTMLElement}
 */
function createPinNode(pin) {
  const node = document.createElement('div');
  node.dataset.pinId = String(pin.id);
  Object.assign(node.style, {
    position: 'fixed',
    left: `${pin.x}px`,
    top: `${pin.y}px`,
    width: '24px',
    height: '24px',
    borderRadius: '50% 50% 50% 0',
    background: '#e53e3e',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 'bold',
    fontFamily: 'sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transform: 'rotate(-45deg)',
    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
    pointerEvents: 'none',
    zIndex: '2147483647',
  });
  const label = document.createElement('span');
  label.style.transform = 'rotate(45deg)';
  label.textContent = String(pin.id);
  node.appendChild(label);
  overlay.appendChild(node);
  return node;
}

// ─── Pin mode toggle ──────────────────────────────────────────────────────────

function enablePinMode() {
  pinModeActive = true;
  overlay.style.pointerEvents = 'auto';
  document.body.style.cursor = 'crosshair';
}

function disablePinMode() {
  pinModeActive = false;
  overlay.style.pointerEvents = 'none';
  document.body.style.cursor = '';
}

overlay.addEventListener('click', (e) => {
  if (!pinModeActive) return;
  e.preventDefault();
  e.stopPropagation();

  const x = e.clientX;
  const y = e.clientY;
  const target = document.elementFromPoint(x, y) ?? document.body;
  const selector = buildSelector(target);

  const comment = prompt(`Pin #${nextPinId} — enter your comment:`) ?? '';
  if (comment === null) return; // user cancelled

  const pin = { id: nextPinId++, comment, x, y, selector, el: createPinNode({ id: nextPinId - 1, x, y }) };
  pins.push(pin);
});

// ─── Message listener (from popup) ───────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'ENABLE_PIN_MODE') {
    enablePinMode();
    sendResponse({ ok: true });
    return;
  }

  if (message.type === 'DISABLE_PIN_MODE') {
    disablePinMode();
    sendResponse({ ok: true });
    return;
  }

  if (message.type === 'GET_PINS') {
    sendResponse({ pins: pins.map(({ id, comment, x, y, selector }) => ({ id, comment, x, y, selector })) });
    return;
  }

  if (message.type === 'CLEAR_PINS') {
    pins.forEach((p) => p.el.remove());
    pins.length = 0;
    nextPinId = 1;
    sendResponse({ ok: true });
    return;
  }

  if (message.type === 'CAPTURE') {
    disablePinMode();
    // html2canvas is loaded via content_scripts before this file
    html2canvas(document.body, { useCORS: true, allowTaint: true, scale: 1 }).then((canvas) => {
      sendResponse({
        screenshotDataUrl: canvas.toDataURL('image/png'),
        annotations: pins.map(({ id, comment, x, y, selector }) => ({ id, comment, x, y, selector })),
        pageUrl: location.href,
      });
    });
    return true; // keep message channel open for async response
  }
});
