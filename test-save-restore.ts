import PDFDocument from "pdfkit";
import { writeFileSync } from "fs";

const doc = new PDFDocument({ size: "LETTER", margins: { top: 60, bottom: 60, left: 56, right: 56 } });
const chunks: Buffer[] = [];
doc.on("data", (c: Buffer) => chunks.push(c));
doc.on("end", () => {
  writeFileSync("/tmp/save-restore-test.pdf", Buffer.concat(chunks));
  console.log("done");
});

// drawHeader with save/restore
doc.rect(0, 0, doc.page.width, 90).fill("#1a2744");
const sx = 36, sy = 12, sw = 28, sh = 28;
doc.save()
  .moveTo(sx + sw / 2, sy)
  .lineTo(sx, sy + sh * 0.22)
  .lineTo(sx, sy + sh * 0.62)
  .bezierCurveTo(sx, sy + sh * 0.85, sx + sw / 2, sy + sh, sx + sw / 2, sy + sh)
  .bezierCurveTo(sx + sw, sy + sh, sx + sw, sy + sh * 0.85, sx + sw, sy + sh * 0.62)
  .lineTo(sx + sw, sy + sh * 0.22)
  .closePath()
  .fill("#f97316");
doc.fillColor("#ffffff").fontSize(14).font("Helvetica-Bold").text("C", sx + sw / 2 - 4, sy + 8, { lineBreak: false });
doc.fillColor("#ffffff").fontSize(18).font("Helvetica-Bold").text("Written Works", 56, 58, { lineBreak: false });
doc.fillColor("#ffffff").fontSize(9).font("Helvetica").text("subtitle", 56, 80, { lineBreak: false });
doc.restore();

// drawFooter
const fy = doc.page.height - 36;
doc.rect(0, fy, doc.page.width, 36).fill("#f5f6f8");
doc.fillColor("#9ca3af").fontSize(7.5).font("Helvetica").text("footer", 56, fy + 13, { lineBreak: false });

// Reset doc.y
doc.y = 108;
console.log("doc.y after reset:", doc.y);

// Instructions
doc.rect(56, doc.y, 500, 28).fill("#f5f6f8");
doc.fillColor("#374151").fontSize(8).font("Helvetica").text("Instructions text here for the form", 64, doc.y + 8, { width: 484, lineBreak: false });
doc.y += 38;
console.log("doc.y after instructions:", doc.y);

// Section
doc.rect(56, doc.y, 500, 20).fill("#1a2744");
doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold").text("SECTION ONE", 64, doc.y + 6, { lineBreak: false });
doc.y += 26;

// Text field
doc.fillColor("#374151").fontSize(9).font("Helvetica-Bold").text("Company Name", 56, doc.y, { lineBreak: false });
doc.y += 11;
doc.rect(56, doc.y, 500, 20).strokeColor("#d1d5db").lineWidth(0.75).stroke();
doc.y += 30;

console.log("final doc.y:", doc.y);
doc.end();
