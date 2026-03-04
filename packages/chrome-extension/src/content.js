/**
 * content.js
 * Annotation engine for the UI Annotator Chrome extension.
 * Injected into localhost pages at document_idle.
 * Activated by: chrome.runtime.sendMessage({ action: "START_ANNOTATION" })
 *
 * @typedef {Object} PinData
 * @property {number} id
 * @property {string} selector
 * @property {string} elementTag
 * @property {string} elementText
 * @property {number} x           - % of document scrollWidth
 * @property {number} y           - % of document scrollHeight
 * @property {string} comment
 */

// ─── Module-level state ───────────────────────────────────────────────────────

/** @type {PinData[]} */
let pins = [];
let nextPinId = 1;
let isActive = false;

/** @type {HTMLElement|null} */
let overlay = null;
/** @type {HTMLElement|null} */
let pinLayer = null;
/** @type {HTMLElement|null} */
let toolbar = null;
/** @type {HTMLElement|null} */
let activePopover = null;
/** @type {HTMLElement|null} */
let pendingPinEl = null;

// ─── Styles ───────────────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById('uia-styles')) return;
  const style = document.createElement('style');
  style.id = 'uia-styles';
  style.textContent = `
    #uia-overlay {
      position: fixed;
      inset: 0;
      z-index: 999999;
      background: transparent;
      cursor: crosshair;
    }
    #uia-pin-layer {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      pointer-events: none;
      z-index: 999998;
    }
    #uia-toolbar {
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000000;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      background: #1E1E2E;
      color: #CDD6F4;
      font-family: system-ui, sans-serif;
      font-size: 13px;
      border-radius: 8px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5);
      user-select: none;
      white-space: nowrap;
    }
    #uia-toolbar-label {
      font-weight: 600;
      color: #CDD6F4;
    }
    #uia-toolbar-sep {
      width: 1px;
      height: 16px;
      background: #45475A;
    }
    #uia-pin-badge {
      background: #E53935;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 20px;
      min-width: 44px;
      text-align: center;
    }
    .uia-btn {
      padding: 5px 12px;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      font-family: system-ui, sans-serif;
      line-height: 1.4;
      transition: opacity 0.15s;
    }
    .uia-btn:hover:not([disabled]) { opacity: 0.82; }
    .uia-btn[disabled] { opacity: 0.4; cursor: default; }
    #uia-btn-send  { background: #89B4FA; color: #1E1E2E; }
    #uia-btn-clear { background: transparent; color: #CDD6F4; border: 1px solid #45475A; }
    #uia-btn-cancel { background: transparent; color: #CDD6F4; border: 1px solid #45475A; }
    .uia-pin {
      position: absolute;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #E53935;
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      font-family: system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: translate(-50%, -50%);
      box-shadow: 0 2px 8px rgba(0,0,0,0.45);
      pointer-events: none;
    }
    .uia-popover {
      position: fixed;
      z-index: 1000001;
      background: #1E1E2E;
      border: 1px solid #45475A;
      border-radius: 8px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 240px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      font-family: system-ui, sans-serif;
    }
    .uia-popover-label {
      font-size: 12px;
      font-weight: 600;
      color: #89B4FA;
    }
    .uia-popover textarea {
      width: 100%;
      min-height: 72px;
      resize: vertical;
      background: #181825;
      color: #CDD6F4;
      border: 1px solid #45475A;
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 12px;
      font-family: system-ui, sans-serif;
      box-sizing: border-box;
    }
    .uia-popover textarea:focus { outline: 1px solid #89B4FA; border-color: #89B4FA; }
    .uia-popover-buttons {
      display: flex;
      gap: 6px;
      justify-content: flex-end;
    }
    .uia-popover .uia-btn-save {
      background: #89B4FA;
      color: #1E1E2E;
      padding: 4px 12px;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      font-family: system-ui, sans-serif;
    }
    .uia-popover .uia-btn-save:hover { opacity: 0.85; }
    .uia-popover .uia-btn-popover-cancel {
      background: transparent;
      color: #CDD6F4;
      border: 1px solid #45475A;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      font-family: system-ui, sans-serif;
    }
    .uia-popover .uia-btn-popover-cancel:hover { opacity: 0.8; }
    #uia-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000002;
      padding: 10px 20px;
      border-radius: 8px;
      font-family: system-ui, sans-serif;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      pointer-events: none;
      opacity: 1;
      transition: opacity 0.4s;
    }
    #uia-toast.uia-toast-success { background: #40A02B; color: #fff; }
    #uia-toast.uia-toast-error   { background: #E53935; color: #fff; }
    #uia-toast.uia-toast-fade    { opacity: 0; }
  `;
  document.head.appendChild(style);
}

// ─── CSS selector algorithm ───────────────────────────────────────────────────

/**
 * Compute the shortest unique CSS selector for an element.
 * Strategy: id → path of tagName[:nth-of-type], up to 5 levels, stops when unique.
 * @param {Element} el
 * @returns {string}
 */
function getCssSelector(el) {
  // 1. Unique id wins immediately
  if (el.id) {
    const escaped = CSS.escape(el.id);
    if (document.querySelectorAll('#' + escaped).length === 1) {
      return '#' + escaped;
    }
  }

  // 2. Build upward path, stopping at body or when selector becomes unique
  const parts = [];
  let current = el;

  for (let depth = 0; depth < 5; depth++) {
    if (!current || current === document.body || current === document.documentElement) break;

    let part = current.tagName.toLowerCase();
    const parent = current.parentElement;

    if (parent) {
      const sameSiblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
      if (sameSiblings.length > 1) {
        const idx = sameSiblings.indexOf(current) + 1;
        part += `:nth-of-type(${idx})`;
      }
    }

    parts.unshift(part);

    const candidate = parts.join(' > ');
    if (document.querySelectorAll(candidate).length === 1) {
      return candidate;
    }

    current = current.parentElement;
  }

  // Return whatever we have (best-effort)
  return parts.join(' > ') || el.tagName.toLowerCase();
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function createToolbar() {
  const el = document.createElement('div');
  el.id = 'uia-toolbar';
  el.innerHTML = `
    <span id="uia-toolbar-label">UI Annotator</span>
    <span id="uia-toolbar-sep"></span>
    <span id="uia-pin-badge">0 pins</span>
    <button class="uia-btn" id="uia-btn-send" disabled>Send to Claude</button>
    <button class="uia-btn" id="uia-btn-clear">Clear All</button>
    <button class="uia-btn" id="uia-btn-cancel">Cancel</button>
  `;
  document.body.appendChild(el);

  el.querySelector('#uia-btn-send').addEventListener('click', (e) => {
    e.stopPropagation();
    sendFeedback();
  });
  el.querySelector('#uia-btn-clear').addEventListener('click', (e) => {
    e.stopPropagation();
    clearAllPins();
  });
  el.querySelector('#uia-btn-cancel').addEventListener('click', (e) => {
    e.stopPropagation();
    removeAnnotationMode();
  });

  return el;
}

function updatePinBadge() {
  const badge = document.getElementById('uia-pin-badge');
  if (badge) badge.textContent = `${pins.length} pin${pins.length !== 1 ? 's' : ''}`;

  const sendBtn = document.getElementById('uia-btn-send');
  if (sendBtn) {
    if (pins.length > 0) {
      sendBtn.removeAttribute('disabled');
    } else {
      sendBtn.setAttribute('disabled', '');
    }
  }
}

// ─── Pins ─────────────────────────────────────────────────────────────────────

/**
 * @param {number} id
 * @param {number} pageX  - pixels from left of document
 * @param {number} pageY  - pixels from top of document
 * @returns {HTMLElement}
 */
function createPinElement(id, pageX, pageY) {
  const el = document.createElement('div');
  el.className = 'uia-pin';
  el.dataset.pinId = String(id);
  el.style.left = `${pageX}px`;
  el.style.top  = `${pageY}px`;
  el.textContent = String(id);
  pinLayer.appendChild(el);
  return el;
}

function clearAllPins() {
  if (activePopover) dismissPopover(false);
  pins = [];
  nextPinId = 1;
  pinLayer.innerHTML = '';
  updatePinBadge();
}

// ─── Popover ──────────────────────────────────────────────────────────────────

/**
 * @param {number}   pinId
 * @param {number}   clientX  - viewport x of click
 * @param {number}   clientY  - viewport y of click
 * @param {function} onSave   - called with comment string
 * @param {function} onCancel
 */
function showCommentPopover(pinId, clientX, clientY, onSave, onCancel) {
  dismissPopover(false); // dismiss any existing one without callback

  const popover = document.createElement('div');
  popover.className = 'uia-popover';
  popover.innerHTML = `
    <div class="uia-popover-label">Pin #${pinId} — add a comment</div>
    <textarea placeholder="Describe the issue or what needs changing…" autocomplete="off"></textarea>
    <div class="uia-popover-buttons">
      <button class="uia-btn-popover-cancel">Cancel</button>
      <button class="uia-btn-save">Save Pin</button>
    </div>
  `;

  // Position near the pin, staying inside viewport
  const popW = 240;
  const popH = 180; // approximate
  const margin = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = clientX + 16;
  let top  = clientY - 16;

  if (left + popW + margin > vw) left = clientX - popW - 16;
  if (left < margin) left = margin;
  if (top + popH + margin > vh) top = vh - popH - margin;
  if (top < margin) top = margin;

  popover.style.left = `${left}px`;
  popover.style.top  = `${top}px`;

  document.body.appendChild(popover);
  activePopover = popover;

  // Disable overlay clicks while popover is open
  if (overlay) overlay.style.pointerEvents = 'none';

  const textarea = popover.querySelector('textarea');
  textarea.focus();

  const handleSave = () => {
    const comment = textarea.value.trim();
    if (comment.length < 3) {
      textarea.style.borderColor = '#E53935';
      textarea.focus();
      return;
    }
    dismissPopover(false);
    onSave(comment);
  };

  const handleCancel = () => {
    dismissPopover(false);
    onCancel();
  };

  popover.querySelector('.uia-btn-save').addEventListener('click', handleSave);
  popover.querySelector('.uia-btn-popover-cancel').addEventListener('click', handleCancel);

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') { e.preventDefault(); handleCancel(); }
  });
}

/**
 * Remove the active popover and re-enable the overlay.
 * @param {boolean} [restoreOverlay=true]
 */
function dismissPopover(restoreOverlay = true) {
  if (activePopover) {
    activePopover.remove();
    activePopover = null;
  }
  if (restoreOverlay && overlay) {
    overlay.style.pointerEvents = 'auto';
  }
}

// ─── Toast ────────────────────────────────────────────────────────────────────

/**
 * @param {string} message
 * @param {'success'|'error'} type
 * @param {number} [duration] ms
 */
function showToast(message, type, duration = 3000) {
  const existing = document.getElementById('uia-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'uia-toast';
  toast.className = `uia-toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('uia-toast-fade');
    setTimeout(() => toast.remove(), 450);
  }, duration);
}

// ─── Overlay click handler ────────────────────────────────────────────────────

function handleOverlayClick(e) {
  // Ignore if a popover is open (popover has higher z-index, this shouldn't fire,
  // but guard anyway)
  if (activePopover) return;

  e.preventDefault();
  e.stopPropagation();

  const clientX = e.clientX;
  const clientY = e.clientY;

  // Temporarily hide overlay to hit-test the real element beneath
  overlay.style.display = 'none';
  const target = document.elementFromPoint(clientX, clientY) ?? document.body;
  overlay.style.display = '';

  const selector    = getCssSelector(target);
  const elementTag  = target.tagName.toLowerCase();
  const elementText = (target.textContent ?? '').trim().slice(0, 100);

  const pageX = clientX + window.scrollX;
  const pageY = clientY + window.scrollY;

  const pinId = nextPinId++;
  pendingPinEl = createPinElement(pinId, pageX, pageY);

  showCommentPopover(
    pinId,
    clientX,
    clientY,
    (comment) => {
      // Save pin
      const docW = document.documentElement.scrollWidth;
      const docH = document.documentElement.scrollHeight;
      pins.push({
        id:          pinId,
        selector,
        elementTag,
        elementText,
        x:           Number(((pageX / docW) * 100).toFixed(2)),
        y:           Number(((pageY / docH) * 100).toFixed(2)),
        comment,
      });
      pendingPinEl = null;
      updatePinBadge();
      // Re-enable overlay
      if (overlay) overlay.style.pointerEvents = 'auto';
    },
    () => {
      // Cancel — remove the pin marker
      if (pendingPinEl) {
        pendingPinEl.remove();
        pendingPinEl = null;
      }
      nextPinId--;
      // Re-enable overlay
      if (overlay) overlay.style.pointerEvents = 'auto';
    }
  );
}

// ─── Send feedback ────────────────────────────────────────────────────────────

async function sendFeedback() {
  if (pins.length === 0) return;

  const sendBtn = document.getElementById('uia-btn-send');
  if (sendBtn) sendBtn.setAttribute('disabled', '');

  // Hide toolbar and any popover before capture
  if (toolbar)       toolbar.style.display = 'none';
  if (activePopover) activePopover.style.display = 'none';
  if (overlay)       overlay.style.display = 'none';

  let screenshotBase64;
  try {
    const canvas = await html2canvas(document.body, {
      useCORS:      true,
      allowTaint:   true,
      scale:        window.devicePixelRatio || 1,
      width:        document.documentElement.scrollWidth,
      height:       document.documentElement.scrollHeight,
      windowWidth:  document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight,
      scrollX:      0,
      scrollY:      0,
    });
    // Strip the data:image/png;base64, prefix
    screenshotBase64 = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
  } catch (err) {
    if (toolbar) toolbar.style.display = '';
    if (activePopover) activePopover.style.display = '';
    if (overlay) overlay.style.display = '';
    if (sendBtn) sendBtn.removeAttribute('disabled');
    showToast(`Screenshot failed: ${err.message}`, 'error');
    return;
  }

  // Restore UI
  if (toolbar)       toolbar.style.display = '';
  if (activePopover) activePopover.style.display = '';
  if (overlay)       overlay.style.display = '';

  const payload = {
    pageUrl:         location.href,
    pageTitle:       document.title,
    screenshotBase64,
    annotations:     pins,
  };

  try {
    const res = await fetch('http://localhost:3847/feedback', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }

    showToast('✓ Sent to Claude! You can now ask Claude Code to review your UI.', 'success', 3000);

    // Deactivate after the toast duration
    setTimeout(() => removeAnnotationMode(), 3000);
  } catch (err) {
    if (sendBtn) sendBtn.removeAttribute('disabled');
    showToast(`Send failed: ${err.message}`, 'error', 5000);
  }
}

// ─── Activation / deactivation ────────────────────────────────────────────────

/**
 * Remove all uia-* elements and event listeners; restore normal page state.
 */
function removeAnnotationMode() {
  isActive = false;

  dismissPopover(false);

  const ids = ['uia-overlay', 'uia-pin-layer', 'uia-toolbar', 'uia-styles', 'uia-toast'];
  ids.forEach(id => document.getElementById(id)?.remove());

  overlay      = null;
  pinLayer     = null;
  toolbar      = null;
  activePopover = null;
  pendingPinEl  = null;
  pins          = [];
  nextPinId     = 1;
}

/**
 * Initialise (or re-initialise) annotation mode.
 * Idempotent: tears down any existing session before starting fresh.
 */
function startAnnotationMode() {
  // Teardown any previous session first
  if (isActive) removeAnnotationMode();
  isActive = true;

  injectStyles();

  // Pin layer — absolute, covers full document height, no pointer events
  pinLayer = document.createElement('div');
  pinLayer.id = 'uia-pin-layer';
  document.body.appendChild(pinLayer);

  // Transparent overlay — fixed, covers viewport, intercepts clicks
  overlay = document.createElement('div');
  overlay.id = 'uia-overlay';
  overlay.addEventListener('click', handleOverlayClick);
  document.body.appendChild(overlay);

  // Toolbar
  toolbar = createToolbar();
  updatePinBadge();
}

// ─── Message listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'START_ANNOTATION') {
    startAnnotationMode();
    sendResponse({ ok: true });
    return true;
  }
});
