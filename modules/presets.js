// ===== Preset Manager =====
// Save and load field layouts as JSON files.
// Layouts are self-contained (font settings, positions) and
// can be reloaded even with a different template image.

import { toast, downloadBlob } from './utils.js';

export class PresetManager {
  constructor(state, fieldManager, renderer) {
    this.state        = state;
    this.fieldManager = fieldManager;
    this.renderer     = renderer;
  }

  // ──────────────────────────────────────────────
  // Save current field layout to a JSON file
  // ──────────────────────────────────────────────

  savePreset() {
    if (this.state.fields.length === 0) {
      toast('Add some fields before saving a layout', 'info');
      return;
    }

    const preset = {
      version:   1,
      createdAt: new Date().toISOString(),
      fieldCount: this.state.fields.length,
      // Deep-copy fields (exclude any non-serialisable objects)
      fields: this.state.fields.map(f => ({ ...f })),
    };

    const json = JSON.stringify(preset, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    downloadBlob(blob, 'certgen_layout.json');
    toast('Layout saved as certgen_layout.json', 'success');
  }

  // ──────────────────────────────────────────────
  // Load a previously saved JSON layout
  // ──────────────────────────────────────────────

  loadPreset(file) {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const preset = JSON.parse(e.target.result);

        if (!preset || !Array.isArray(preset.fields) || preset.fields.length === 0) {
          throw new Error('Missing or empty "fields" array');
        }

        // Validate that each field has the minimum required properties
        for (const f of preset.fields) {
          if (!f.id || f.nx === undefined || f.ny === undefined) {
            throw new Error('Field missing required property (id, nx, ny)');
          }
        }

        this.state.fields          = preset.fields.map(f => ({ ...f }));
        this.state.selectedFieldId = null;

        this.fieldManager.renderList();
        this.fieldManager.renderProps();
        this.renderer.render();

        // If data is already loaded, refresh the column map
        // (the preset may reference column names that exist in current data)
        // We access dataManager via fieldManager's reference
        this.fieldManager._dataManager?.renderColMap();

        toast(`Layout loaded — ${preset.fields.length} field${preset.fields.length !== 1 ? 's' : ''} restored`, 'success');

      } catch (err) {
        console.error('Preset load error:', err);
        toast('Invalid layout file: ' + err.message, 'error');
      }
    };

    reader.onerror = () => toast('Could not read preset file', 'error');
    reader.readAsText(file);
  }
}
