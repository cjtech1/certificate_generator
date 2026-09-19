// ===== App Entry Point =====
import { initUploader }  from './modules/uploader.js';
import { CanvasRenderer } from './modules/canvas.js';
import { FieldManager }   from './modules/fields.js';
import { DataManager }    from './modules/dataTable.js';
import { Exporter }       from './modules/exporter.js';
import { PresetManager }  from './modules/presets.js';
import { toast }          from './modules/utils.js';

// ───────────────────────────────────────────────
// Global state object — single source of truth
// ───────────────────────────────────────────────
export const state = {
  /** @type {{ image: HTMLImageElement, naturalW: number, naturalH: number, name: string }|null} */
  template: null,

  /**
   * Array of field objects.
   * Each field: { id, label, column, nx, ny, nw, nh, fontFamily,
   *               fontSize, color, bold, italic, align, autoFit }
   * nx/ny/nw/nh are normalized 0-1 fractions of template dimensions.
   * fontSize is in template pixels.
   */
  fields: [],

  /** ID of the currently selected field, or null. */
  selectedFieldId: null,

  /** @type {{ headers: string[], rows: object[] }|null} */
  data: null,

  /** Index of the participant row currently shown in the preview. */
  currentRow: 0,

  /** Export format string. */
  exportFormat: 'pdf-single',

  /** Custom loaded fonts (for the select list). */
  customFonts: [],
};

// ───────────────────────────────────────────────
// Bootstrap all modules
// ───────────────────────────────────────────────
async function init() {
  // Wait for Google Fonts to load so canvas rendering is accurate
  await document.fonts.ready;

  const canvas = document.getElementById('cert-canvas');

  // Instantiate core modules
  const renderer     = new CanvasRenderer(canvas, state);
  const fieldManager = new FieldManager(state, renderer);
  const dataManager  = new DataManager(state, renderer, fieldManager);
  const exporter     = new Exporter(state, renderer);
  const presetMgr    = new PresetManager(state, fieldManager, renderer);

  // Cross-wire references so modules can call each other
  fieldManager.setDataManager(dataManager);

  // Set up file upload handlers
  initUploader(state, renderer, fieldManager, dataManager);

  // ── Theme toggle ──────────────────────────────
  const themeBtn = document.getElementById('btn-theme-toggle');
  themeBtn.addEventListener('click', () => {
    const html   = document.documentElement;
    const isLight = html.getAttribute('data-theme') === 'light';
    html.setAttribute('data-theme', isLight ? 'dark' : 'light');
    themeBtn.textContent = isLight ? '🌙' : '☀️';
  });

  // ── Export format selection ───────────────────
  document.querySelectorAll('input[name="export-format"]').forEach(radio => {
    radio.addEventListener('change', () => {
      state.exportFormat = radio.value;
    });
  });

  // ── Generate button ───────────────────────────
  document.getElementById('btn-generate').addEventListener('click', () => {
    exporter.generateAll();
  });

  // ── Preview download ──────────────────────────
  document.getElementById('btn-preview-dl').addEventListener('click', () => {
    exporter.downloadPreview();
  });

  // ── Participant navigation ────────────────────
  document.getElementById('btn-prev').addEventListener('click', () => {
    dataManager.prevRow();
  });
  document.getElementById('btn-next').addEventListener('click', () => {
    dataManager.nextRow();
  });

  // ── Layout preset buttons ─────────────────────
  document.getElementById('btn-save-preset').addEventListener('click', () => {
    presetMgr.savePreset();
  });
  document.getElementById('btn-load-preset').addEventListener('click', () => {
    document.getElementById('preset-file-input').click();
  });
  document.getElementById('preset-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) presetMgr.loadPreset(file);
    e.target.value = '';
  });

  // ── Keyboard shortcuts ────────────────────────
  document.addEventListener('keydown', (e) => {
    // Don't intercept when user is typing in an input
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        if (state.selectedFieldId) {
          fieldManager.deleteField(state.selectedFieldId);
        }
        break;
      case 'Escape':
        state.selectedFieldId = null;
        fieldManager.renderList();
        fieldManager.renderProps();
        renderer.render();
        break;
      case 'ArrowLeft':
        if (e.ctrlKey || e.metaKey) { dataManager.prevRow(); e.preventDefault(); }
        break;
      case 'ArrowRight':
        if (e.ctrlKey || e.metaKey) { dataManager.nextRow(); e.preventDefault(); }
        break;
    }
  });
}

init().catch(err => {
  console.error('CertGen init failed:', err);
});
