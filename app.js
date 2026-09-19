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

  // ── About / Developer Info modal ─────────────
  const aboutOverlay = document.getElementById('about-overlay');
  const openAbout  = () => aboutOverlay.classList.remove('hidden');
  const closeAbout = () => aboutOverlay.classList.add('hidden');

  document.getElementById('btn-about').addEventListener('click', openAbout);
  document.getElementById('btn-about-close').addEventListener('click', closeAbout);
  // Click outside the modal card to close
  aboutOverlay.addEventListener('click', (e) => {
    if (e.target === aboutOverlay) closeAbout();
  });

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
        if (!aboutOverlay.classList.contains('hidden')) { closeAbout(); break; }
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

  // ── Mobile tab navigation ─────────────────────
  setupMobileTabs(renderer);
}

/**
 * Sets up the mobile bottom tab bar.
 * On mobile (≤768px), only one panel is visible at a time.
 * The tab bar switches between them by toggling the `mobile-active` CSS class.
 *
 * Auto-switches to the canvas tab after important actions so the user
 * always sees the result without having to tap manually.
 */
function setupMobileTabs(renderer) {
  const MOBILE_BP = 768;
  const isMobile  = () => window.innerWidth <= MOBILE_BP;

  const panels = {
    'panel-tools':  document.getElementById('panel-tools'),
    'panel-canvas': document.getElementById('panel-canvas'),
    'panel-data':   document.getElementById('panel-data'),
  };
  const tabs = document.querySelectorAll('.mobile-tab');

  /** Activate a panel by its element ID. */
  function switchTab(targetId) {
    // Update panel visibility
    Object.entries(panels).forEach(([id, el]) => {
      if (!el) return;
      el.classList.toggle('mobile-active', id === targetId);
    });

    // Update tab active state
    tabs.forEach(t => {
      const isActive = t.dataset.target === targetId;
      t.classList.toggle('mobile-tab-active', isActive);
    });

    // Re-render the canvas whenever it becomes visible
    if (targetId === 'panel-canvas') {
      setTimeout(() => renderer.render(), 50); // allow layout to settle
    }
  }

  // Wire tab clicks
  tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.target));
  });

  // ── Auto-switch rules (only on mobile) ─────────
  // Switch to Canvas when template is loaded
  document.addEventListener('cert:template-loaded', () => {
    if (isMobile()) switchTab('panel-canvas');
  });

  // Switch to Canvas when a field is added, so user can position it
  document.addEventListener('cert:field-added', () => {
    if (isMobile()) switchTab('panel-canvas');
  });

  // Switch to Canvas when data is loaded, so user can preview
  document.addEventListener('cert:data-loaded', () => {
    if (isMobile()) switchTab('panel-canvas');
  });

  // ── Initialise: activate correct panel on load ──
  if (isMobile()) {
    switchTab('panel-canvas');
  } else {
    // On desktop: make all panels visible (remove any stale mobile-active class)
    Object.values(panels).forEach(el => el?.classList.remove('mobile-active'));
  }

  // Handle resize: if user rotates to landscape (no longer mobile), clean up
  window.addEventListener('resize', () => {
    if (!isMobile()) {
      Object.values(panels).forEach(el => el?.classList.remove('mobile-active'));
    } else {
      // Re-activate whichever tab is currently marked active
      const activeTab = document.querySelector('.mobile-tab-active');
      if (activeTab) switchTab(activeTab.dataset.target);
    }
  });
}

init().catch(err => {
  console.error('CertGen init failed:', err);
});

