// ===== Field Manager =====
// Manages the list of text fields, the left-panel field list UI,
// and the field properties editor.

import { generateId, toast } from './utils.js';

/** Default properties for a new field. */
const FIELD_DEFAULTS = {
  nx:         0.2,        // normalised x (0-1)
  ny:         0.40,       // normalised y (0-1)
  nw:         0.60,       // normalised width
  nh:         0.14,       // normalised height
  fontFamily: 'Inter',
  fontSize:   72,         // template pixels
  color:      '#1a1a1a',
  bold:       false,
  italic:     false,
  align:      'center',
  autoFit:    true,
  column:     '',
};

export class FieldManager {
  constructor(state, renderer) {
    this.state    = state;
    this.renderer = renderer;

    /** Optional reference to DataManager (set via setDataManager). */
    this._dataManager = null;

    // Expose selection / change callbacks to the renderer
    renderer.onFieldSelect = (id) => {
      this.state.selectedFieldId = id;
      this.renderList();
      this.renderProps();
    };

    renderer.onFieldChange = (field) => {
      // Keep position inputs in sync while dragging
      this._syncPositionInputs(field);
    };

    this._initListeners();
  }

  /** Called by app.js after DataManager is created. */
  setDataManager(dm) {
    this._dataManager = dm;
  }

  // ──────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────

  addField() {
    if (!this.state.template) {
      toast('Upload a template first, then add fields', 'info');
      return;
    }

    const offset = this.state.fields.length;
    const field  = {
      ...FIELD_DEFAULTS,
      id:    generateId(),
      label: `Field ${offset + 1}`,
      // Slightly stagger new fields so they don't all stack exactly
      nx: 0.20 + (offset % 4) * 0.01,
      ny: 0.40 + (offset % 6) * 0.02,
    };

    this.state.fields.push(field);
    this.state.selectedFieldId = field.id;

    this.renderList();
    this.renderProps();
    this.renderer.render();
    this._dataManager?.renderColMap();
  }

  deleteField(id) {
    this.state.fields = this.state.fields.filter(f => f.id !== id);
    if (this.state.selectedFieldId === id) {
      this.state.selectedFieldId = null;
    }
    this.renderList();
    this.renderProps();
    this.renderer.render();
    this._dataManager?.renderColMap();
    toast('Field removed', 'info');
  }

  /** Update the column dropdown in field props after data is loaded. */
  onDataLoaded() {
    const field = this._selected();
    this.updateColumnDropdown(field);
  }

  // ──────────────────────────────────────────────
  // Left panel – fields list
  // ──────────────────────────────────────────────

  renderList() {
    const list = document.getElementById('fields-list');
    if (!list) return;

    if (this.state.fields.length === 0) {
      list.innerHTML = `
        <div class="empty-state-small">
          <div class="empty-icon">✏️</div>
          <p>No fields yet.</p>
          <p>Click <strong>+ Add Field</strong> after<br>uploading a template.</p>
        </div>`;
      return;
    }

    list.innerHTML = '';
    for (const field of this.state.fields) {
      const item = document.createElement('div');
      item.className = `field-item${field.id === this.state.selectedFieldId ? ' active' : ''}`;
      item.dataset.id = field.id;
      item.title = `${field.label}${field.column ? ' → ' + field.column : ''}`;
      item.innerHTML = `
        <div class="field-item-dot"></div>
        <span class="field-item-name">${field.label || field.id}</span>
        <span class="field-item-col">${field.column || '—'}</span>`;
      item.addEventListener('click', () => {
        this.state.selectedFieldId = field.id;
        this.renderList();
        this.renderProps();
        this.renderer.render();
      });
      list.appendChild(item);
    }
  }

  // ──────────────────────────────────────────────
  // Left panel – field properties editor
  // ──────────────────────────────────────────────

  renderProps() {
    const panel = document.getElementById('field-props');
    const field = this._selected();

    if (!field) {
      panel.classList.add('hidden');
      return;
    }

    panel.classList.remove('hidden');

    document.getElementById('field-props-title').textContent = field.label || 'Field Settings';
    document.getElementById('prop-label').value   = field.label   || '';
    document.getElementById('prop-font').value    = field.fontFamily;
    document.getElementById('prop-size').value    = field.fontSize;
    document.getElementById('prop-color').value   = field.color;
    document.getElementById('prop-bold').classList.toggle('active', field.bold);
    document.getElementById('prop-italic').classList.toggle('active', field.italic);
    document.getElementById('prop-autofit').checked = field.autoFit;

    document.querySelectorAll('[data-align]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.align === field.align);
    });

    this._syncPositionInputs(field);
    this.updateColumnDropdown(field);
  }

  updateColumnDropdown(field = null) {
    const sel = document.getElementById('prop-column');
    if (!sel) return;

    const current = field?.column || '';
    sel.innerHTML = '<option value="">— select column —</option>';

    if (this.state.data) {
      for (const h of this.state.data.headers) {
        const opt = document.createElement('option');
        opt.value = h;
        opt.textContent = h;
        if (h === current) opt.selected = true;
        sel.appendChild(opt);
      }
    } else {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '— upload Excel first —';
      sel.appendChild(opt);
    }
  }

  // ──────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────

  _selected() {
    return this.state.fields.find(f => f.id === this.state.selectedFieldId) ?? null;
  }

  _syncPositionInputs(field) {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };
    set('prop-x', (field.nx * 100).toFixed(1));
    set('prop-y', (field.ny * 100).toFixed(1));
    set('prop-w', (field.nw * 100).toFixed(1));
    set('prop-h', (field.nh * 100).toFixed(1));
  }

  /** Read property inputs and write back to the selected field. */
  _applyProps() {
    const field = this._selected();
    if (!field) return;

    field.label      = document.getElementById('prop-label').value;
    field.column     = document.getElementById('prop-column').value;
    field.fontFamily = document.getElementById('prop-font').value;
    field.fontSize   = Math.max(4, parseInt(document.getElementById('prop-size').value) || 72);
    field.color      = document.getElementById('prop-color').value;

    // Position inputs are percentages → convert to normalised 0-1
    const pct = (id) => parseFloat(document.getElementById(id).value);
    const x   = pct('prop-x'); if (!isNaN(x)) field.nx = Math.max(0, Math.min(0.99, x / 100));
    const y   = pct('prop-y'); if (!isNaN(y)) field.ny = Math.max(0, Math.min(0.99, y / 100));
    const w   = pct('prop-w'); if (!isNaN(w)) field.nw = Math.max(0.01, Math.min(1,   w / 100));
    const h   = pct('prop-h'); if (!isNaN(h)) field.nh = Math.max(0.01, Math.min(1,   h / 100));

    this.renderList();
    this.renderer.render();
    this._dataManager?.renderColMap();
    // Update title in props header
    document.getElementById('field-props-title').textContent = field.label || 'Field Settings';
  }

  _initListeners() {
    // Add field button
    document.getElementById('btn-add-field').addEventListener('click', () => this.addField());

    // Delete field button
    document.getElementById('btn-delete-field').addEventListener('click', () => {
      if (this.state.selectedFieldId) this.deleteField(this.state.selectedFieldId);
    });

    // Text inputs that immediately update the field
    const textInputs = ['prop-label', 'prop-column', 'prop-font', 'prop-size', 'prop-color',
                        'prop-x', 'prop-y', 'prop-w', 'prop-h'];
    textInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input',  () => this._applyProps());
        el.addEventListener('change', () => this._applyProps());
      }
    });

    // Bold / Italic toggles
    document.getElementById('prop-bold').addEventListener('click', () => {
      const field = this._selected();
      if (!field) return;
      field.bold = !field.bold;
      document.getElementById('prop-bold').classList.toggle('active', field.bold);
      this.renderer.render();
    });

    document.getElementById('prop-italic').addEventListener('click', () => {
      const field = this._selected();
      if (!field) return;
      field.italic = !field.italic;
      document.getElementById('prop-italic').classList.toggle('active', field.italic);
      this.renderer.render();
    });

    // Alignment buttons
    document.querySelectorAll('[data-align]').forEach(btn => {
      btn.addEventListener('click', () => {
        const field = this._selected();
        if (!field) return;
        field.align = btn.dataset.align;
        document.querySelectorAll('[data-align]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderer.render();
      });
    });

    // Auto-fit checkbox
    document.getElementById('prop-autofit').addEventListener('change', () => {
      const field = this._selected();
      if (!field) return;
      field.autoFit = document.getElementById('prop-autofit').checked;
      this.renderer.render();
    });
  }
}
