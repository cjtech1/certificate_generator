// ===== Data Manager =====
// Parses the uploaded Excel / CSV file (via SheetJS global XLSX),
// renders the data preview table, column-to-field mapping UI,
// and participant navigation.

import { toast } from './utils.js';

export class DataManager {
  constructor(state, renderer, fieldManager) {
    this.state        = state;
    this.renderer     = renderer;
    this.fieldManager = fieldManager;
  }

  // ──────────────────────────────────────────────
  // Load & parse an Excel / CSV file
  // ──────────────────────────────────────────────

  loadExcel(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data  = new Uint8Array(e.target.result);
        const wb    = XLSX.read(data, { type: 'array' });
        const ws    = wb.Sheets[wb.SheetNames[0]];

        // sheet_to_json with header:1 → raw 2D array
        const raw     = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (!raw || raw.length < 2) {
          toast('File must have a header row and at least one data row', 'error');
          return;
        }

        const headers  = raw[0].map(String);
        const dataRows = raw.slice(1)
          .filter(row => row.some(cell => cell !== '' && cell !== undefined && cell !== null))
          .map(row => {
            const obj = {};
            headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
            return obj;
          });

        if (dataRows.length === 0) {
          toast('No data rows found in the file', 'error');
          return;
        }

        this.state.data       = { headers, rows: dataRows };
        this.state.currentRow = 0;

        this._showDataUI();
        this.renderSummary();
        this.renderTable();
        this.renderColMap();
        this.renderNav();
        this.fieldManager.onDataLoaded();
        this.renderer.render();

        toast(`✓ Loaded ${dataRows.length} participants (${headers.length} columns)`, 'success');

      } catch (err) {
        console.error('Excel parse error:', err);
        toast('Could not parse file — make sure it is a valid .xlsx, .xls, or .csv', 'error');
      }
    };
    reader.onerror = () => toast('Could not read file', 'error');
    reader.readAsArrayBuffer(file);
  }

  clearData() {
    this.state.data       = null;
    this.state.currentRow = 0;

    document.getElementById('data-summary').classList.add('hidden');
    document.getElementById('col-map-section').classList.add('hidden');
    document.getElementById('data-table-wrap').classList.add('hidden');
    document.getElementById('excel-dropzone').classList.remove('hidden');
    document.getElementById('nav-label').textContent = 'No data loaded';

    this.fieldManager.onDataLoaded();
    this.renderer.render();
    toast('Data cleared', 'info');
  }

  // ──────────────────────────────────────────────
  // Participant navigation
  // ──────────────────────────────────────────────

  prevRow() {
    if (!this.state.data) return;
    this.state.currentRow = Math.max(0, this.state.currentRow - 1);
    this.renderNav();
    this.renderTable();
    this.renderer.render();
  }

  nextRow() {
    if (!this.state.data) return;
    this.state.currentRow = Math.min(this.state.data.rows.length - 1, this.state.currentRow + 1);
    this.renderNav();
    this.renderTable();
    this.renderer.render();
  }

  // ──────────────────────────────────────────────
  // UI renderers
  // ──────────────────────────────────────────────

  renderSummary() {
    const { data } = this.state;
    if (!data) return;
    const el = document.getElementById('summary-badge');
    if (el) el.textContent = `✓ ${data.rows.length} participants · ${data.headers.length} columns`;
    document.getElementById('data-summary').classList.remove('hidden');
  }

  renderNav() {
    const { data, currentRow } = this.state;
    const label = document.getElementById('nav-label');
    if (!label) return;
    label.textContent = data
      ? `Preview: ${currentRow + 1} / ${data.rows.length}`
      : 'No data loaded';
  }

  renderTable() {
    const { data, currentRow } = this.state;
    const wrap = document.getElementById('data-table-wrap');
    if (!wrap || !data) return;
    wrap.classList.remove('hidden');

    // Show at most 5 columns and 12 rows to keep the panel compact
    const MAX_COLS = 5;
    const MAX_ROWS = 12;
    const cols     = data.headers.slice(0, MAX_COLS);
    const hasMore  = data.headers.length > MAX_COLS;

    let html = '<table class="data-table"><thead><tr><th>#</th>';
    cols.forEach(h => { html += `<th>${_esc(h)}</th>`; });
    if (hasMore) html += '<th>…</th>';
    html += '</tr></thead><tbody>';

    const rowCount = Math.min(data.rows.length, MAX_ROWS);
    for (let i = 0; i < rowCount; i++) {
      const row  = data.rows[i];
      const cls  = i === currentRow ? 'active-row' : '';
      html += `<tr class="${cls}" data-row="${i}"><td>${i + 1}</td>`;
      cols.forEach(h => {
        const val = row[h] ?? '';
        html += `<td title="${_esc(String(val))}">${_esc(String(val))}</td>`;
      });
      if (hasMore) html += '<td>…</td>';
      html += '</tr>';
    }

    if (data.rows.length > MAX_ROWS) {
      const extra = data.rows.length - MAX_ROWS;
      html += `<tr><td colspan="${cols.length + (hasMore ? 2 : 1)}"
        style="text-align:center;color:var(--text-muted);font-style:italic;padding:6px">
        + ${extra} more row${extra !== 1 ? 's' : ''}</td></tr>`;
    }

    html += '</tbody></table>';
    wrap.innerHTML = html;

    // Click a row to jump the preview there
    wrap.querySelectorAll('tr[data-row]').forEach(tr => {
      tr.addEventListener('click', () => {
        this.state.currentRow = parseInt(tr.dataset.row, 10);
        this.renderNav();
        this.renderTable();
        this.renderer.render();
      });
    });

    // Scroll active row into view
    const activeEl = wrap.querySelector('.active-row');
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
  }

  renderColMap() {
    const section = document.getElementById('col-map-section');
    const list    = document.getElementById('col-map-list');
    if (!section || !list) return;

    const { data, fields } = this.state;
    if (!data) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');

    if (fields.length === 0) {
      list.innerHTML = `<p style="font-size:11px;color:var(--text-muted)">
        Add text fields in the left panel first.</p>`;
      return;
    }

    list.innerHTML = '';
    for (const field of fields) {
      const row = document.createElement('div');
      row.className = 'col-map-item';

      const opts = data.headers
        .map(h => `<option value="${_esc(h)}" ${h === field.column ? 'selected' : ''}>${_esc(h)}</option>`)
        .join('');

      row.innerHTML = `
        <span class="col-map-item-label" title="${_esc(field.label)}">${_esc(field.label)}</span>
        <span class="col-map-arrow">→</span>
        <select class="input" data-fid="${field.id}">
          <option value="">— none —</option>
          ${opts}
        </select>`;

      row.querySelector('select').addEventListener('change', (e) => {
        const f = this.state.fields.find(f => f.id === e.target.dataset.fid);
        if (f) {
          f.column = e.target.value;
          this.fieldManager.renderList();
          this.fieldManager.renderProps();
          this.renderer.render();
        }
      });

      list.appendChild(row);
    }
  }

  // ──────────────────────────────────────────────
  // Internal helpers
  // ──────────────────────────────────────────────

  _showDataUI() {
    document.getElementById('excel-dropzone').classList.add('hidden');
    document.getElementById('data-summary').classList.remove('hidden');
    document.getElementById('participant-nav').classList.remove('hidden');
  }
}

/** Simple HTML-escape for user data in table cells. */
function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
