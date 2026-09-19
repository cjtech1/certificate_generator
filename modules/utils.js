// ===== Shared Utility Functions =====

/**
 * Show a toast notification at the bottom-right of the screen.
 * @param {string} message
 * @param {'info'|'success'|'error'} type
 * @param {number} duration ms
 */
export function toast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', 'alert');
  el.textContent = message;
  container.appendChild(el);

  setTimeout(() => {
    el.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

/**
 * Generate a short random ID for a field.
 * @returns {string}
 */
export function generateId() {
  return 'f' + Math.random().toString(36).slice(2, 10);
}

/**
 * Trigger a browser download for a Blob.
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Sanitize a string for use as a filename (remove special chars).
 * @param {string} str
 * @returns {string}
 */
export function sanitizeFilename(str) {
  return String(str)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')  // Remove illegal chars
    .replace(/\s+/g, ' ')                      // Collapse whitespace
    .trim()
    .slice(0, 100) || 'Certificate';           // Max 100 chars
}

/**
 * Promise that resolves after one event-loop tick (allows UI to update).
 * @returns {Promise<void>}
 */
export function yieldToUI() {
  return new Promise(resolve => setTimeout(resolve, 0));
}
