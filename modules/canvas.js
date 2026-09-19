// ===== Canvas Renderer =====
// Handles all canvas drawing (template + text fields) and
// interactive drag/resize of field boxes.

const MAX_DISPLAY_W   = 1600;   // px – max canvas width for display
const HANDLE_SIZE     = 9;      // px – visual handle square size
const HANDLE_HIT_AREA = 14;     // px – hit region around each handle

export class CanvasRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} state - shared app state
   */
  constructor(canvas, state) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.state  = state;

    // Scale factor: canvas pixels / template pixels (for display canvas)
    this.displayScale = 1;

    // Drag / resize interaction state
    this._drag   = null;  // { fieldId, startPos, startField }
    this._resize = null;  // { fieldId, handle, startPos, startField }

    // Callbacks set by FieldManager
    this.onFieldSelect = null;   // (id | null) => void
    this.onFieldChange = null;   // (field) => void

    this._setupMouseEvents();
  }

  // ──────────────────────────────────────────────────
  // Initialise canvas dimensions to match the template
  // ──────────────────────────────────────────────────
  initCanvas() {
    const { naturalW, naturalH } = this.state.template;
    const scale = Math.min(1, MAX_DISPLAY_W / naturalW);
    this.displayScale = scale;
    this.canvas.width  = Math.round(naturalW * scale);
    this.canvas.height = Math.round(naturalH * scale);
  }

  // ──────────────────────────────────────────────────
  // Main render — draws template + all fields
  // ──────────────────────────────────────────────────
  render() {
    const { canvas, ctx, state } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!state.template) return;

    // 1. Background template image
    ctx.drawImage(state.template.image, 0, 0, canvas.width, canvas.height);

    // 2. Text fields
    for (const field of state.fields) {
      const text     = this._resolveText(field);
      const selected = field.id === state.selectedFieldId;
      this._drawText(ctx, field, canvas.width, canvas.height, text, selected, false);
    }
  }

  // ──────────────────────────────────────────────────
  // Resolve the display text for a field from current row
  // ──────────────────────────────────────────────────
  _resolveText(field) {
    const { data, currentRow } = this.state;
    if (data && field.column) {
      const row = data.rows[currentRow];
      if (row && row[field.column] !== undefined) return String(row[field.column]);
    }
    return field.label || `[${field.id}]`;
  }

  // ──────────────────────────────────────────────────
  // Draw a single field's text (+ selection chrome)
  // Works for both the display canvas and offscreen export canvas.
  //
  // nx/ny/nw/nh are normalised 0-1 fractions.
  // fontSize is stored in template pixels; we multiply by scale.
  // scale = canvasW / template.naturalW
  // ──────────────────────────────────────────────────
  _drawText(ctx, field, canvasW, canvasH, text, selected = false, isExport = false) {
    const x = field.nx * canvasW;
    const y = field.ny * canvasH;
    const w = field.nw * canvasW;
    const h = field.nh * canvasH;

    const scale    = canvasW / this.state.template.naturalW;
    let   fontSize = field.fontSize * scale;

    if (text) {
      const styleStr  = `${field.italic ? 'italic ' : ''}${field.bold ? 'bold ' : ''}`;
      const familyStr = `"${field.fontFamily}"`;

      ctx.font = `${styleStr}${fontSize}px ${familyStr}`;

      // Auto-fit: shrink font until text fits within the box width
      if (field.autoFit) {
        while (ctx.measureText(text).width > w && fontSize > 4) {
          fontSize -= 1;
          ctx.font = `${styleStr}${fontSize}px ${familyStr}`;
        }
      }

      ctx.fillStyle   = field.color;
      ctx.textBaseline = 'middle';
      ctx.textAlign    = field.align;

      let textX;
      if      (field.align === 'left')   textX = x;
      else if (field.align === 'center') textX = x + w / 2;
      else                               textX = x + w;

      ctx.fillText(text, textX, y + h / 2);

      // Reset alignment for subsequent draws
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    // ── Selection chrome ──────────────────────────
    if (selected && !isExport) {
      ctx.save();
      ctx.strokeStyle = '#a78bfa';
      ctx.lineWidth   = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
      this._drawHandles(ctx, x, y, w, h);
      ctx.restore();
    }
  }

  // Draw 8 resize handles on the selection rect
  _drawHandles(ctx, x, y, w, h) {
    const hs = HANDLE_SIZE;
    const positions = this._handlePositions(x, y, w, h);
    for (const [hx, hy] of Object.values(positions)) {
      ctx.fillStyle   = '#7c3aed';
      ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 1.5;
      ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
    }
  }

  // Returns { nw:[x,y], n:[x,y], ne:[x,y], w, e, sw, s, se }
  _handlePositions(x, y, w, h) {
    return {
      nw: [x,       y],
      n:  [x + w/2, y],
      ne: [x + w,   y],
      w:  [x,       y + h/2],
      e:  [x + w,   y + h/2],
      sw: [x,       y + h],
      s:  [x + w/2, y + h],
      se: [x + w,   y + h],
    };
  }

  // ──────────────────────────────────────────────────
  // Export: render one row to a full-resolution offscreen canvas
  // Returns a Promise<HTMLCanvasElement>
  // ──────────────────────────────────────────────────
  async renderRow(rowData) {
    const { naturalW, naturalH, image } = this.state.template;
    const off = document.createElement('canvas');
    off.width  = naturalW;
    off.height = naturalH;
    const ctx  = off.getContext('2d');

    // Draw template at full resolution
    ctx.drawImage(image, 0, 0, naturalW, naturalH);

    // Draw each field (scale = 1 since canvas width = naturalW)
    for (const field of this.state.fields) {
      let text = '';
      if (field.column && rowData && rowData[field.column] !== undefined) {
        text = String(rowData[field.column]);
      } else if (!field.column) {
        text = field.label || '';
      }
      this._drawText(ctx, field, naturalW, naturalH, text, false, true);
    }

    return off;
  }

  // ──────────────────────────────────────────────────
  // Mouse coordinate helpers
  // ──────────────────────────────────────────────────

  /** Convert a MouseEvent to canvas-pixel coordinates. */
  _mousePos(e) {
    const rect   = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width  / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  }

  /** Find which resize handle of `field` the point hits, or null. */
  _hitHandle(pos, field) {
    const x = field.nx * this.canvas.width;
    const y = field.ny * this.canvas.height;
    const w = field.nw * this.canvas.width;
    const h = field.nh * this.canvas.height;
    const positions = this._handlePositions(x, y, w, h);
    const ht = HANDLE_HIT_AREA / 2;

    for (const [name, [hx, hy]] of Object.entries(positions)) {
      if (Math.abs(pos.x - hx) <= ht && Math.abs(pos.y - hy) <= ht) return name;
    }
    return null;
  }

  /** Find which field (if any) contains the given point. */
  _hitField(pos) {
    for (let i = this.state.fields.length - 1; i >= 0; i--) {
      const f = this.state.fields[i];
      const x = f.nx * this.canvas.width;
      const y = f.ny * this.canvas.height;
      const w = f.nw * this.canvas.width;
      const h = f.nh * this.canvas.height;
      if (pos.x >= x && pos.x <= x + w && pos.y >= y && pos.y <= y + h) return f;
    }
    return null;
  }

  // ──────────────────────────────────────────────────
  // Mouse event wiring
  // ──────────────────────────────────────────────────
  _setupMouseEvents() {
    const c = this.canvas;

    c.addEventListener('mousedown', (e) => this._onDown(e));
    c.addEventListener('mousemove', (e) => this._onMove(e));
    c.addEventListener('mouseup',   (e) => this._onUp(e));
    c.addEventListener('mouseleave',     () => this._onUp());
  }

  _onDown(e) {
    if (!this.state.template) return;
    const pos = this._mousePos(e);

    // Check handles of selected field first
    if (this.state.selectedFieldId) {
      const sel = this.state.fields.find(f => f.id === this.state.selectedFieldId);
      if (sel) {
        const handle = this._hitHandle(pos, sel);
        if (handle) {
          this._resize = { fieldId: sel.id, handle, startPos: pos, startField: { ...sel } };
          e.preventDefault();
          return;
        }
      }
    }

    // Hit test a field body
    const hit = this._hitField(pos);
    if (hit) {
      this.state.selectedFieldId = hit.id;
      this._drag = { fieldId: hit.id, startPos: pos, startField: { ...hit } };
      this.onFieldSelect?.(hit.id);
      this.render();
    } else {
      // Click on empty area → deselect
      this.state.selectedFieldId = null;
      this.onFieldSelect?.(null);
      this.render();
    }
  }

  _onMove(e) {
    if (!this.state.template) return;
    const pos = this._mousePos(e);

    // ── Resize ──────────────────────────────────
    if (this._resize) {
      const { fieldId, handle, startPos, startField } = this._resize;
      const field = this.state.fields.find(f => f.id === fieldId);
      if (!field) return;

      const dx = (pos.x - startPos.x) / this.canvas.width;
      const dy = (pos.y - startPos.y) / this.canvas.height;

      let { nx, ny, nw, nh } = startField;

      if (handle.includes('e')) { nw = Math.max(0.01, startField.nw + dx); }
      if (handle.includes('s')) { nh = Math.max(0.01, startField.nh + dy); }
      if (handle.includes('w')) {
        const newNx = Math.min(startField.nx + startField.nw - 0.01, startField.nx + dx);
        nw = startField.nw - (newNx - startField.nx);
        nx = newNx;
      }
      if (handle.includes('n')) {
        const newNy = Math.min(startField.ny + startField.nh - 0.01, startField.ny + dy);
        nh = startField.nh - (newNy - startField.ny);
        ny = newNy;
      }

      field.nx = Math.max(0, Math.min(1 - nw, nx));
      field.ny = Math.max(0, Math.min(1 - nh, ny));
      field.nw = nw;
      field.nh = nh;

      this.render();
      this.onFieldChange?.(field);
      return;
    }

    // ── Drag ─────────────────────────────────────
    if (this._drag) {
      const { fieldId, startPos, startField } = this._drag;
      const field = this.state.fields.find(f => f.id === fieldId);
      if (!field) return;

      const dx = (pos.x - startPos.x) / this.canvas.width;
      const dy = (pos.y - startPos.y) / this.canvas.height;

      field.nx = Math.max(0, Math.min(1 - field.nw, startField.nx + dx));
      field.ny = Math.max(0, Math.min(1 - field.nh, startField.ny + dy));

      this.render();
      this.onFieldChange?.(field);
      return;
    }

    // ── Cursor feedback ───────────────────────────
    this._updateCursor(pos);
  }

  _onUp() {
    this._drag   = null;
    this._resize = null;
  }

  _updateCursor(pos) {
    if (this.state.selectedFieldId) {
      const sel = this.state.fields.find(f => f.id === this.state.selectedFieldId);
      if (sel) {
        const handle = this._hitHandle(pos, sel);
        if (handle) {
          const cursors = {
            nw: 'nw-resize', n: 'n-resize',  ne: 'ne-resize',
            w:  'w-resize',                   e:  'e-resize',
            sw: 'sw-resize', s: 's-resize',   se: 'se-resize',
          };
          this.canvas.style.cursor = cursors[handle] || 'crosshair';
          return;
        }
      }
    }
    const hit = this._hitField(pos);
    this.canvas.style.cursor = hit ? 'move' : 'crosshair';
  }
}
