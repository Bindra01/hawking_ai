import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";
import { HAWKING_FOOTER, highPriority, type SolveFormat, type SolveSolution, type SolveStep } from "@/lib/solve-types";

const C = {
  green: "#2E7D32", greenLight: "#58CC02", blue: "#1565C0", purple: "#6A1B9A",
  orange: "#E65100", teal: "#00695C", gold: "#B8860B", red: "#C62828",
  gray: "#6B7280", dark: "#1A1A2E", page: "#FAFAF8", border: "#E5E7EB",
};
const MARGIN = 48;
const CONTENT_WIDTH = 499;
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const mathDocument = mathjax.document("", {
  InputJax: new TeX({ packages: AllPackages }),
  OutputJax: new SVG({ fontCache: "none" }),
});

function mathSvg(latex: string, color: string): string {
  const markup = adaptor.outerHTML(mathDocument.convert(latex, { display: true }));
  const svgStart = markup.indexOf("<svg");
  const svgEnd = markup.lastIndexOf("</svg>");
  if (svgStart < 0 || svgEnd < 0) throw new Error("MathJax did not return SVG output.");
  return markup.slice(svgStart, svgEnd + 6).replaceAll("currentColor", color);
}

function drawMath(doc: PDFKit.PDFDocument, latex: string, x: number, y: number, width: number, color: string) {
  SVGtoPDF(doc, mathSvg(latex, color), x, y, { width, preserveAspectRatio: "xMidYMid meet" });
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
  if (doc.y + height > doc.page.height - 58) doc.addPage();
}

function heading(doc: PDFKit.PDFDocument, text: string, color = C.green) {
  ensureSpace(doc, 30);
  doc.moveDown(.8).font("Helvetica-Bold").fontSize(12).fillColor(color).text(text, MARGIN, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(.35);
}

function callout(doc: PDFKit.PDFDocument, label: string, text: string, border: string, background: string) {
  const h = Math.max(48, doc.heightOfString(`${label}: ${text}`, { width: CONTENT_WIDTH - 30 }) + 18);
  ensureSpace(doc, h + 8);
  const y = doc.y;
  doc.save().rect(MARGIN, y, CONTENT_WIDTH, h).fill(background).rect(MARGIN, y, 4, h).fill(border).restore();
  doc.font("Helvetica-Bold").fontSize(8).fillColor(border).text(label, MARGIN + 14, y + 10, { continued: true });
  doc.font("Helvetica").fontSize(9.5).fillColor(C.dark).text(`  ${text}`, { width: CONTENT_WIDTH - 28, lineGap: 2 });
  doc.y = y + h + 5;
}

function step(doc: PDFKit.PDFDocument, number: number, data: SolveStep, color: string, format: SolveFormat) {
  ensureSpace(doc, 130);
  doc.moveDown(.8);
  const y = doc.y;
  doc.roundedRect(MARGIN, y, 51, 17, 8).fill(C.dark);
  doc.font("Helvetica-Bold").fontSize(7).fillColor("#FFFFFF").text(`STEP ${number}`, MARGIN + 9, y + 5);
  doc.font("Helvetica-Bold").fontSize(12).fillColor(color).text(data.label, MARGIN + 62, y + 2, { width: CONTENT_WIDTH - 62 });
  doc.y = y + 27;
  callout(doc, "ANSWER", data.answer, C.greenLight, "#F0FDF4");
  const explanation = format === "short" ? data.explanation.split(/(?<=[.!?])\s+/)[0] : data.explanation;
  if (explanation) doc.font("Helvetica").fontSize(9.5).fillColor(C.dark).text(explanation, MARGIN, doc.y + 4, { width: CONTENT_WIDTH, lineGap: 3 });
  if (data.tip && (format === "long" || data.tip.priority === "high")) callout(doc, "TIP", data.tip.text, C.gold, "#FFFBEB");
  if (data.warning && (format === "long" || data.warning.priority === "high")) callout(doc, "WARNING", data.warning.text, C.red, "#FFF5F5");
}

function bullet(doc: PDFKit.PDFDocument, marker: string, text: string, markerColor: string, boldPrefix = "") {
  const h = doc.heightOfString(text, { width: CONTENT_WIDTH - 25 }) + 8;
  ensureSpace(doc, h);
  const y = doc.y;
  doc.font("Helvetica-Bold").fontSize(10).fillColor(markerColor).text(marker, MARGIN, y, { width: 20 });
  doc.font("Helvetica").fontSize(9.5).fillColor(C.dark);
  if (boldPrefix) doc.font("Helvetica-Bold").text(`${boldPrefix} `, MARGIN + 24, y, { continued: true, width: CONTENT_WIDTH - 24 });
  doc.font("Helvetica").text(text, { width: CONTENT_WIDTH - 24, lineGap: 2 });
  doc.moveDown(.4);
}

export async function renderSolutionPdf(solution: SolveSolution, format: SolveFormat): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margins: { top: MARGIN, bottom: 48, left: MARGIN, right: MARGIN }, info: { Title: `${solution.title} - Hawking ${format} solution`, Author: "Hawking AI" }, autoFirstPage: false, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.on("pageAdded", () => {
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.page);
    doc.fillColor(C.dark);
  });
  doc.addPage();

  doc.font("Helvetica-Bold").fontSize(14).fillColor(C.greenLight).text("HAWKING · THINK THROUGH PHYSICS", { characterSpacing: 1.2 });
  doc.moveDown(1.2).font("Times-Bold").fontSize(25).fillColor(C.dark).text(solution.title.toUpperCase(), { width: CONTENT_WIDTH });
  doc.moveDown(.35).font("Helvetica").fontSize(9).fillColor(C.gray).text(solution.tags.join(" · "));
  doc.moveDown(.8).strokeColor(C.greenLight).lineWidth(2).moveTo(MARGIN, doc.y).lineTo(MARGIN + CONTENT_WIDTH, doc.y).stroke();

  heading(doc, "THE PROBLEM");
  doc.font("Helvetica").fontSize(10).fillColor(C.dark).text(solution.problem_statement, { width: CONTENT_WIDTH, lineGap: 3 });
  if (solution.problem_options.length) {
    doc.moveDown(.45);
    solution.problem_options.forEach((option) => doc.text(option, { width: CONTENT_WIDTH }));
  }
  doc.moveDown(.55).font("Times-Italic").fontSize(10).fillColor(C.gray).text(solution.framing_line, { width: CONTENT_WIDTH, lineGap: 2 });

  step(doc, 1, solution.step1, C.purple, format);
  step(doc, 2, solution.step2, C.orange, format);
  step(doc, 3, solution.step3, C.teal, format);

  ensureSpace(doc, 80);
  doc.moveDown(1);
  const y = doc.y;
  doc.roundedRect(MARGIN, y, 66, 17, 8).fill(C.dark);
  doc.font("Helvetica-Bold").fontSize(7).fillColor("#FFFFFF").text("STEPS 4-6", MARGIN + 8, y + 5);
  doc.font("Helvetica-Bold").fontSize(12).fillColor(C.blue).text(solution.derivation.label, MARGIN + 77, y + 2, { width: CONTENT_WIDTH - 77 });
  doc.y = y + 28;

  for (const block of solution.derivation.blocks) {
    if (block.type === "subsection") {
      ensureSpace(doc, 28);
      doc.moveDown(.5).font("Helvetica-Bold").fontSize(10.5).fillColor(C.blue).text(block.title, { width: CONTENT_WIDTH });
    } else if (block.type === "prose") {
      doc.moveDown(.3).font("Helvetica").fontSize(9.5).fillColor(C.dark).text(block.text, { width: CONTENT_WIDTH, lineGap: 2 });
    } else {
      const h = block.type === "equation" && block.annotation ? 66 : 54;
      ensureSpace(doc, h + 8);
      const blockY = doc.y + 4;
      const bg = block.type === "boxed_result" ? "#F0FDF4" : "#F0F4FF";
      const border = block.type === "boxed_result" ? C.greenLight : C.blue;
      doc.rect(MARGIN, blockY, CONTENT_WIDTH, h).fill(bg).rect(MARGIN, blockY, 3, h).fill(border);
      drawMath(doc, block.latex, MARGIN + 20, blockY + 8, CONTENT_WIDTH - 40, block.type === "boxed_result" ? C.green : C.dark);
      if (block.type === "equation" && block.annotation) doc.font("Times-Italic").fontSize(8).fillColor(C.gray).text(block.annotation, MARGIN + 14, blockY + h - 17, { width: CONTENT_WIDTH - 28, align: "center" });
      doc.y = blockY + h + 4;
    }
  }

  const finalY = doc.y + 8;
  const finalH = 74;
  ensureSpace(doc, finalH + 12);
  doc.roundedRect(MARGIN, finalY, CONTENT_WIDTH, finalH, 8).fillAndStroke("#F0FDF4", C.greenLight);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(C.green).text("FINAL ANSWER", MARGIN + 15, finalY + 12, { width: CONTENT_WIDTH - 30, align: "center" });
  drawMath(doc, solution.final_answer.latex, MARGIN + 24, finalY + 26, CONTENT_WIDTH - 48, C.green);
  doc.font("Times-Bold").fontSize(11).fillColor(C.green).text(solution.final_answer.display, MARGIN + 15, finalY + 56, { width: CONTENT_WIDTH - 30, align: "center" });
  doc.y = finalY + finalH + 6;

  const reality = format === "short" ? highPriority(solution.reality_checks, 2) : solution.reality_checks;
  const errors = format === "short" ? highPriority(solution.common_errors, 2) : solution.common_errors;
  const takeaways = format === "short" ? highPriority(solution.takeaways, 3) : solution.takeaways;
  heading(doc, "REALITY CHECK");
  reality.forEach((item) => bullet(doc, "✓", item.text, C.greenLight, item.heading));
  heading(doc, "WHERE STUDENTS GO WRONG", C.red);
  errors.forEach((item, index) => bullet(doc, `${index + 1}.`, item.text, C.red, item.title));
  heading(doc, "TAKE THESE INTO YOUR NEXT PROBLEM");
  takeaways.forEach((item) => bullet(doc, "•", item.text, C.green));

  ensureSpace(doc, 95);
  doc.moveDown(.8).strokeColor(C.border).lineWidth(1).moveTo(MARGIN, doc.y).lineTo(MARGIN + CONTENT_WIDTH, doc.y).stroke();
  doc.moveDown(.7).font("Helvetica-Bold").fontSize(8.5).fillColor(C.green).text("hawking-mauve.vercel.app · Think Through Physics");
  doc.moveDown(.35).font("Helvetica").fontSize(8).fillColor(C.gray).text(HAWKING_FOOTER, { width: CONTENT_WIDTH, lineGap: 2 });

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.font("Helvetica").fontSize(7.5).fillColor(C.gray).text(`${i + 1} / ${range.count}`, 0, doc.page.height - 28, { width: doc.page.width, align: "center" });
  }
  doc.end();
  return done;
}
