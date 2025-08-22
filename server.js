const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const PDFDocument = require("pdfkit");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static(path.join(__dirname, "public")));
// Serve tmp files (generated PDFs/images) so browser can download them
app.use("/tmp", express.static(path.join(__dirname, "tmp")));

// Return list of installed printers (Windows only). Uses PowerShell Get-Printer.
app.get("/printers", (req, res) => {
  if (process.platform !== "win32") return res.json({ printers: [] });

  // Use PowerShell to list printer names
  const cmd =
    'powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"';
  exec(cmd, { timeout: 5000 }, (err, stdout, stderr) => {
    if (err) {
      console.error("Failed to list printers (returning empty):", err, stderr);
      return res.json({ printers: [] });
    }
    const printers = stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    res.json({ printers });
  });
});

// Save image and print using mspaint (Windows). This is a simple approach: write PNG and invoke mspaint /pt
app.post("/print", async (req, res) => {
  try {
    const { dataUrl, printerName } = req.body;
    if (!dataUrl) return res.status(400).json({ error: "Missing dataUrl" });

    const matches = dataUrl.match(/^data:(image\/(png|jpeg|jpg));base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: "Invalid dataUrl" });

    const ext = matches[2] === "jpeg" || matches[2] === "jpg" ? "jpg" : "png";
    const base64 = matches[3];
    const buffer = Buffer.from(base64, "base64");

    const outDir = path.join(__dirname, "tmp");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
    const filename = path.join(outDir, `capture_${Date.now()}.${ext}`);
    fs.writeFileSync(filename, buffer);

    // If request asked to generate PDF instead of printing
    if (req.body && req.body.savePdf) {
      const pdfPath = path.join(outDir, `capture_${Date.now()}.pdf`);
      const doc = new PDFDocument({ autoFirstPage: false });
      const ws = fs.createWriteStream(pdfPath);
      doc.pipe(ws);
      try {
        const image = doc.openImage(filename);
        doc.addPage({ size: [image.width, image.height] });
        doc.image(filename, 0, 0);
        doc.end();
      } catch (err) {
        console.error("PDF error", err);
        return res
          .status(500)
          .json({ error: "PDF generation failed", details: String(err) });
      }
      ws.on("finish", () => {
        // Return path relative to server so frontend can download
        const url = `/tmp/${path.basename(pdfPath)}`;
        res.json({ ok: true, file: pdfPath, pdf: true, url });
      });
      ws.on("error", (err) => {
        console.error("PDF write error", err);
        res
          .status(500)
          .json({ error: "PDF generation failed", details: String(err) });
      });
      return;
    }

    // Use mspaint /pt "file" "printer name" -> prints silently (Windows)
    // If printerName is not provided, omit it so mspaint uses default printer
    const quotedFile = '"' + filename + '"';
    const cmd = printerName
      ? `mspaint /pt ${quotedFile} "${printerName.replace(/\"/g, "")}"`
      : `mspaint /pt ${quotedFile}`;

    exec(cmd, (err, stdout, stderr) => {
      // mspaint spawns and exits quickly; errors may be non-zero when user interaction required
      if (err) {
        console.error("Print error:", err, stderr);
        return res
          .status(500)
          .json({ error: "Print failed", details: String(err) });
      }

      res.json({ ok: true, file: filename });
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
