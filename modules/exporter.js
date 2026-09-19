// ===== Exporter =====
// Generates certificates in all supported formats:
//   • Single merged PDF  (all participants as pages)
//   • Individual PDFs    (one per participant, ZIP)
//   • PNG images         (one per participant, ZIP)
//   • JPEG images        (one per participant, ZIP)

import { toast, downloadBlob, sanitizeFilename, yieldToUI } from './utils.js';

export class Exporter {
  constructor(state, renderer) {
    this.state    = state;
    this.renderer = renderer;
  }

  // ──────────────────────────────────────────────
  // Main export entry point
  // ──────────────────────────────────────────────

  async generateAll() {
    const { state, renderer } = this;

    // Guard: all three requirements must be met
    if (!state.template) {
      toast('Upload a certificate template first', 'error'); return;
    }
    if (!state.data || state.data.rows.length === 0) {
      toast('Upload participant data (Excel/CSV) first', 'error'); return;
    }
    if (state.fields.length === 0) {
      toast('Add at least one text field first', 'error'); return;
    }
    if (!state.fields.some(f => f.column)) {
      toast('Map at least one field to an Excel column', 'error'); return;
    }

    const rows   = state.data.rows;
    const format = state.exportFormat;
    const btn    = document.getElementById('btn-generate');

    // Disable button during export
    btn.disabled    = true;
    btn.textContent = '⏳ Generating…';

    this._showProgress(0, rows.length);

    try {
      const setProgress = (n) => this._setProgress(n, rows.length);

      switch (format) {
        case 'pdf-single': await this._exportSinglePDF(rows, setProgress);   break;
        case 'pdf-zip':    await this._exportPDFZip(rows, setProgress);       break;
        case 'png-zip':    await this._exportImageZip(rows, setProgress, 'png');  break;
        case 'jpeg-zip':   await this._exportImageZip(rows, setProgress, 'jpeg'); break;
        default:           throw new Error('Unknown export format: ' + format);
      }

      toast('🎉 Certificates generated successfully!', 'success', 5000);

    } catch (err) {
      console.error('Export error:', err);
      toast('Export failed: ' + err.message, 'error');
    } finally {
      setTimeout(() => {
        this._hideProgress();
        btn.disabled    = false;
        btn.textContent = '✨ Generate Certificates';
      }, 1500);
    }
  }

  // ──────────────────────────────────────────────
  // Download the current preview as PNG
  // ──────────────────────────────────────────────

  async downloadPreview() {
    if (!this.state.template) { toast('No template loaded', 'error'); return; }

    const row    = this.state.data?.rows[this.state.currentRow] ?? {};
    const canvas = await this.renderer.renderRow(row);
    const name   = this._fileName(row, 0);

    canvas.toBlob(blob => downloadBlob(blob, `${name}_preview.png`), 'image/png');
  }

  // ──────────────────────────────────────────────
  // Export: single merged PDF
  // ──────────────────────────────────────────────

  async _exportSinglePDF(rows, setProgress) {
    const { jsPDF } = window.jspdf;
    const { naturalW, naturalH } = this.state.template;

    // Use 72 DPI: 1 pt = 1/72 inch → pixels * (1/72 inch/px) * (25.4 mm/inch)
    const W_MM = (naturalW / 96) * 25.4;
    const H_MM = (naturalH / 96) * 25.4;
    const orientation = W_MM >= H_MM ? 'landscape' : 'portrait';

    const pdf = new jsPDF({ orientation, unit: 'mm', format: [W_MM, H_MM], compress: true });

    for (let i = 0; i < rows.length; i++) {
      if (i > 0) pdf.addPage([W_MM, H_MM], orientation);

      const canvas  = await this.renderer.renderRow(rows[i]);
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imgData, 'JPEG', 0, 0, W_MM, H_MM, undefined, 'FAST');

      setProgress(i + 1);
      await yieldToUI();
    }

    pdf.save('certificates.pdf');
  }

  // ──────────────────────────────────────────────
  // Export: one PDF per participant → ZIP
  // ──────────────────────────────────────────────

  async _exportPDFZip(rows, setProgress) {
    const { jsPDF } = window.jspdf;
    const { naturalW, naturalH } = this.state.template;
    const W_MM = (naturalW / 96) * 25.4;
    const H_MM = (naturalH / 96) * 25.4;
    const orientation = W_MM >= H_MM ? 'landscape' : 'portrait';
    const zip = new JSZip();

    for (let i = 0; i < rows.length; i++) {
      const pdf     = new jsPDF({ orientation, unit: 'mm', format: [W_MM, H_MM], compress: true });
      const canvas  = await this.renderer.renderRow(rows[i]);
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imgData, 'JPEG', 0, 0, W_MM, H_MM, undefined, 'FAST');

      const name = this._fileName(rows[i], i);
      zip.file(`${name}.pdf`, pdf.output('blob'));

      setProgress(i + 1);
      await yieldToUI();
    }

    const blob = await zip.generateAsync({ type: 'blob',
      compression: 'STORE', // PDFs are already compressed
    });
    downloadBlob(blob, 'certificates_pdf.zip');
  }

  // ──────────────────────────────────────────────
  // Export: PNG or JPEG images → ZIP
  // ──────────────────────────────────────────────

  async _exportImageZip(rows, setProgress, format) {
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const quality  = format === 'jpeg' ? 0.93 : undefined;
    const zip      = new JSZip();

    for (let i = 0; i < rows.length; i++) {
      const canvas  = await this.renderer.renderRow(rows[i]);
      const dataUrl = quality
        ? canvas.toDataURL(mimeType, quality)
        : canvas.toDataURL(mimeType);

      // Strip the data: prefix to get raw base64
      const base64 = dataUrl.split(',')[1];
      const name   = this._fileName(rows[i], i);
      zip.file(`${name}.${format}`, base64, { base64: true });

      setProgress(i + 1);
      await yieldToUI();
    }

    const compression = format === 'png' ? 'DEFLATE' : 'STORE';
    const blob = await zip.generateAsync({ type: 'blob', compression });
    downloadBlob(blob, `certificates_${format}.zip`);
  }

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────

  /**
   * Determine the filename for a row.
   * Uses the value of the first field that has a column binding.
   * Falls back to "Certificate_N".
   */
  _fileName(row, idx) {
    for (const field of this.state.fields) {
      if (field.column && row[field.column]) {
        return sanitizeFilename(row[field.column]);
      }
    }
    return `Certificate_${idx + 1}`;
  }

  _showProgress(n, total) {
    document.getElementById('progress-wrap').classList.remove('hidden');
    this._setProgress(n, total);
  }

  _hideProgress() {
    document.getElementById('progress-wrap').classList.add('hidden');
    document.getElementById('progress-fill').style.width = '0%';
  }

  _setProgress(n, total) {
    const pct = total > 0 ? (n / total) * 100 : 0;
    document.getElementById('progress-fill').style.width = `${pct}%`;
    document.getElementById('progress-label').textContent = `Generating… ${n} / ${total}`;
  }
}
