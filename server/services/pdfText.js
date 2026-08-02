const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const MIN_TEXT_CHARS = 200;

const isOcrAvailable = async () => {
  try {
    await execFileAsync("which", ["pdftoppm"]);
    await execFileAsync("which", ["tesseract"]);
    return true;
  } catch {
    return false;
  }
};

const ocrPdf = async (pdfBuffer) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pathfinder-ocr-"));
  const pdfPath = path.join(tmpDir, "audit.pdf");

  try {
    fs.writeFileSync(pdfPath, pdfBuffer);
    await execFileAsync("pdftoppm", ["-r", "200", "-png", pdfPath, path.join(tmpDir, "page")]);

    const pageFiles = fs
      .readdirSync(tmpDir)
      .filter((file) => /^page-\d+\.png$/.test(file))
      .sort((a, b) => {
        const numA = Number(a.match(/page-(\d+)/)[1]);
        const numB = Number(b.match(/page-(\d+)/)[1]);
        return numA - numB;
      });

    let fullText = "";
    for (const pageFile of pageFiles) {
      const { stdout } = await execFileAsync("tesseract", [
        path.join(tmpDir, pageFile),
        "stdout",
      ]);
      fullText += `\n${stdout}`;
    }

    return fullText.trim();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};

const extractPdfText = async (pdfBuffer, pdfParse) => {
  try {
    const parsed = await pdfParse(pdfBuffer);
    const text = (parsed.text || "").trim();

    // Some DegreeWorks PDFs are rasterized ("Microsoft Print To PDF") and
    // expose no embedded text at all, so fall back to OCR in that case.
    if (text.length >= MIN_TEXT_CHARS) {
      return text;
    }

    if (!(await isOcrAvailable())) {
      return text;
    }

    const ocrText = await ocrPdf(pdfBuffer);
    return ocrText.length > text.length ? ocrText : text;
  } catch (err) {
    console.error("PDF text extraction error:", err);
    throw err;
  }
};

module.exports = { extractPdfText, isOcrAvailable, ocrPdf };
