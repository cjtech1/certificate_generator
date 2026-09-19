# 🎓 CertGen — Bulk Certificate Generator

Generate personalized certificates for all your participants in one click.
Upload your Canva template, position text fields visually, load your Excel sheet, and export — all in the browser with no backend required.

---

## ✨ Features

| Feature | Details |
|---|---|
| **Visual Field Placement** | Drag and resize text boxes directly on the template |
| **Excel / CSV Import** | Reads `.xlsx`, `.xls`, and `.csv` via SheetJS |
| **Multi-field Support** | Name, Role, Date, Event — unlimited fields |
| **Export Formats** | Single PDF · PDF per cert (ZIP) · PNG (ZIP) · JPEG (ZIP) |
| **Auto-fit Text** | Long names automatically shrink to fit the box |
| **Custom Fonts** | Upload `.ttf` / `.otf` fonts to match your brand |
| **Layout Presets** | Save field layouts as JSON and reload for future events |
| **Dark / Light Mode** | Easy on the eyes for long sessions |
| **100% client-side** | No data ever leaves your browser |

---

## 🚀 Quick Start

### Run Locally

```bash
# Any static file server works — Python is usually available:
python3 -m http.server 8080

# Then open http://localhost:8080
```

Or use the VS Code **Live Server** extension — just open `index.html` and click **Go Live**.

> ⚠️ **Cannot be opened via `file://`** — browsers block ES module imports on the `file://` protocol. Use a local server.

### Host on GitHub Pages

1. Push this folder to a GitHub repository
2. Go to **Settings → Pages → Source → main branch / root**
3. Your generator is live at `https://<username>.github.io/<repo>/`

---

## 📋 Workflow

```
1. Upload Template    → Drop your Canva PNG/JPEG export
2. Add Text Fields    → Click "+ Add Field" in the left panel
3. Position Fields    → Drag to place, handles to resize
4. Style Typography   → Font, size, color, bold, italic, align
5. Load Excel         → Drop your .xlsx / .csv in the right panel
6. Map Columns        → Link each field to an Excel column
7. Preview            → Navigate participants with ← → buttons
8. Generate           → Choose format and click "Generate Certificates"
```

---

## 📁 Project Structure

```
CERT_GEN/
├── index.html          # App shell + CDN scripts
├── style.css           # Design system (dark/light themes)
├── app.js              # Main orchestrator + keyboard shortcuts
├── modules/
│   ├── utils.js        # Toast, download, ID helpers
│   ├── uploader.js     # Template, Excel, and font file uploads
│   ├── canvas.js       # Rendering + interactive drag/resize
│   ├── fields.js       # Field CRUD + properties panel
│   ├── dataTable.js    # Excel parsing + column mapping UI
│   ├── exporter.js     # PDF / PNG / JPEG / ZIP export
│   └── presets.js      # Save/load field layouts as JSON
└── README.md
```

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|---|---|
| `Delete` / `Backspace` | Delete selected field |
| `Escape` | Deselect field |
| `Ctrl + ←` | Previous participant |
| `Ctrl + →` | Next participant |

---

## 🛠 Tech Stack

| Library | Purpose | Version |
|---|---|---|
| [SheetJS (xlsx)](https://sheetjs.com/) | Excel/CSV parsing | latest |
| [jsPDF](https://github.com/parallax/jsPDF) | PDF generation | 2.5.1 |
| [JSZip](https://stuk.github.io/jszip/) | ZIP packaging | 3.10.1 |
| Vanilla JS + Canvas API | UI, rendering, interaction | ES2022 |

---

## 💡 Tips

- **Template resolution**: Export your Canva design at the highest quality (e.g., 3508 × 2480 px for A4). CertGen scales it for display but exports at full resolution.
- **Font size**: The "Font Size (px)" field uses template pixel units. For a 3508px-wide template, try 120–180px for a name.
- **Saving layouts**: After setting up fields once, click **💾 Save Layout** and keep the JSON file. Next event: load new template + load preset + load new Excel → done.
- **Filename**: Each exported file is named after the participant's name (first mapped field).

---

## 📄 License

MIT — free to use, modify, and distribute.
