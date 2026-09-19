// ===== File Upload Handler =====
import { toast } from './utils.js';

/**
 * Set up drag-and-drop and click-to-browse for the template image,
 * the Excel/CSV file, and custom font files.
 */
export function initUploader(state, renderer, fieldManager, dataManager) {
  _setupTemplateUpload(state, renderer, fieldManager);
  _setupExcelUpload(dataManager);
  _setupClearData(dataManager);
  _setupFontUpload(state);
}

// ─────────────────────────────────────────
// Template (PNG / JPEG) upload
// ─────────────────────────────────────────
function _setupTemplateUpload(state, renderer, fieldManager) {
  const zone  = document.getElementById('template-dropzone');
  const input = document.getElementById('template-file-input');

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) _loadTemplate(file, state, renderer, fieldManager);
  });
  // Click on the zone itself (not on child label/input) triggers browse
  zone.addEventListener('click', (e) => {
    if (e.target !== input && e.target.tagName !== 'LABEL') input.click();
  });
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) _loadTemplate(file, state, renderer, fieldManager);
    e.target.value = '';
  });
}

function _loadTemplate(file, state, renderer, fieldManager) {
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!allowed.includes(file.type)) {
    toast('Please upload a PNG, JPEG, or WebP image', 'error');
    return;
  }

  const url = URL.createObjectURL(file);
  const img = new Image();

  img.onload = () => {
    state.template = {
      image:    img,
      naturalW: img.naturalWidth,
      naturalH: img.naturalHeight,
      name:     file.name,
    };

    // Reveal canvas panel; hide the dropzone
    document.getElementById('template-dropzone').classList.add('hidden');
    document.getElementById('canvas-container').classList.remove('hidden');
    document.getElementById('participant-nav').classList.remove('hidden');

    // Update status hint in header
    const hint = document.getElementById('status-hint');
    if (hint) hint.textContent = `${img.naturalWidth} × ${img.naturalHeight} px`;

    renderer.initCanvas();
    renderer.render();

    // Notify mobile tab switcher to jump to canvas
    document.dispatchEvent(new CustomEvent('cert:template-loaded'));

    toast(`Template loaded — ${img.naturalWidth}×${img.naturalHeight} px`, 'success');
  };

  img.onerror = () => {
    toast('Failed to load image. Try a different file.', 'error');
    URL.revokeObjectURL(url);
  };

  img.src = url;
}

// ─────────────────────────────────────────
// Excel / CSV upload
// ─────────────────────────────────────────
function _setupExcelUpload(dataManager) {
  const zone  = document.getElementById('excel-dropzone');
  const input = document.getElementById('excel-file-input');

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) dataManager.loadExcel(file);
  });
  zone.addEventListener('click', (e) => {
    if (e.target !== input && e.target.tagName !== 'LABEL') input.click();
  });
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) dataManager.loadExcel(file);
    e.target.value = '';
  });
}

function _setupClearData(dataManager) {
  const btn = document.getElementById('btn-clear-data');
  if (btn) btn.addEventListener('click', () => dataManager.clearData());
}

// ─────────────────────────────────────────
// Custom font upload
// ─────────────────────────────────────────
function _setupFontUpload(state) {
  const input = document.getElementById('custom-font-input');

  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Derive a CSS-safe family name from the filename
    const baseName   = file.name.replace(/\.[^.]+$/, '');
    const fontFamily = 'CustomFont_' + baseName.replace(/[^a-zA-Z0-9]/g, '_');

    try {
      const dataUrl = await _fileToDataURL(file);
      const face = new FontFace(fontFamily, `url(${dataUrl})`);
      const loaded = await face.load();
      document.fonts.add(loaded);

      // Remember it
      state.customFonts.push({ name: baseName, family: fontFamily });

      // Add option to the font-family select
      const sel = document.getElementById('prop-font');
      if (sel) {
        const opt = document.createElement('option');
        opt.value = fontFamily;
        opt.textContent = `${baseName} (custom)`;
        sel.appendChild(opt);
      }

      // Show tag in left panel
      const list = document.getElementById('custom-fonts-list');
      if (list) {
        const tag = document.createElement('div');
        tag.className = 'custom-font-tag';
        tag.innerHTML = `<span style="font-family:'${fontFamily}'">Aa</span> <span>${baseName}</span>`;
        list.appendChild(tag);
      }

      toast(`Font "${baseName}" ready to use!`, 'success');
    } catch (err) {
      console.error('Font load error:', err);
      toast('Could not load font file. Try a .ttf or .otf file.', 'error');
    }

    e.target.value = '';
  });
}

function _fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
