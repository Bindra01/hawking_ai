import SVGtoPDF from "svg-to-pdfkit";
import { parseMathText } from "@/lib/math-text";
import { EX_PER_EM, mathSvg, type MathSvg } from "@/lib/math-svg";

/**
 * Lays out prose that mixes text with inline LaTeX for pdfkit.
 *
 * pdfkit can only wrap plain strings, so this module does its own greedy line breaking: words are
 * measured with their font, math is converted to SVG by MathJax and measured in ex units, and each
 * line is drawn item by item on a shared baseline.
 */
export interface ProseStyle {
  font: string;
  size: number;
  color: string;
}

export interface ProseRun {
  text: string;
  style: ProseStyle;
}

export interface ProseOptions {
  /** Extra space between lines, matching pdfkit's `lineGap`. */
  lineGap?: number;
  align?: "left" | "center";
}

type TextItem = { kind: "text"; text: string; width: number; style: ProseStyle; space: boolean };
type MathItem = { kind: "math"; svg: string; width: number; ascent: number; depth: number; display: boolean };
type Item = TextItem | MathItem | { kind: "break" };

interface Line {
  items: Item[];
  width: number;
  ascent: number;
  descent: number;
  display: boolean;
}

const DISPLAY_PAD = 3;
const PAGE_BOTTOM_SLACK = 10;
const svgCache = new Map<string, MathSvg>();

function cachedMathSvg(latex: string, color: string, display: boolean): MathSvg {
  const key = `${display ? "D" : "I"}|${color}|${latex}`;
  let rendered = svgCache.get(key);
  if (!rendered) {
    rendered = mathSvg(latex, color, display);
    svgCache.set(key, rendered);
  }
  return rendered;
}

function fontMetrics(doc: PDFKit.PDFDocument, style: ProseStyle): { ascender: number; descender: number } {
  doc.font(style.font).fontSize(style.size);
  return (doc as unknown as { _font: { ascender: number; descender: number } })._font;
}

const isSpace = (item: Item | undefined): item is TextItem => item?.kind === "text" && item.space;
const isDisplayMath = (item: Item | undefined): item is MathItem => item?.kind === "math" && item.display;
const widthOf = (items: Item[]) => items.reduce((sum, item) => sum + ("width" in item ? item.width : 0), 0);

function textItems(doc: PDFKit.PDFDocument, text: string, style: ProseStyle): Item[] {
  const items: Item[] = [];
  text.split("\n").forEach((paragraph, index) => {
    if (index > 0) items.push({ kind: "break" });
    for (const token of paragraph.split(/(\s+)/)) {
      if (token) items.push({ kind: "text", text: token, width: doc.widthOfString(token), style, space: /^\s+$/.test(token) });
    }
  });
  return items;
}

function mathItem(rendered: MathSvg, style: ProseStyle, display: boolean, maxWidth: number): MathItem {
  const em = style.size * EX_PER_EM;
  const scale = Math.min(1, maxWidth / Math.max(rendered.widthEx * em, 1e-6));
  return {
    kind: "math",
    svg: rendered.svg,
    width: rendered.widthEx * em * scale,
    ascent: (rendered.heightEx - rendered.depthEx) * em * scale,
    depth: rendered.depthEx * em * scale,
    display,
  };
}

function buildItems(doc: PDFKit.PDFDocument, runs: ProseRun[], maxWidth: number): Item[] {
  const items: Item[] = [];
  for (const run of runs) {
    doc.font(run.style.font).fontSize(run.style.size);
    for (const segment of parseMathText(run.text)) {
      if (segment.kind === "text") items.push(...textItems(doc, segment.content, run.style));
      else items.push(mathItem(cachedMathSvg(segment.latex, run.style.color, segment.display), run.style, segment.display, maxWidth));
    }
  }
  return items;
}

function makeLine(doc: PDFKit.PDFDocument, items: Item[], fallback: ProseStyle | undefined): Line {
  let ascent = 0;
  let descent = 0;
  const measured: Item[] = items.length || !fallback ? items : [{ kind: "text", text: "", width: 0, style: fallback, space: false }];
  for (const item of measured) {
    if (item.kind === "text") {
      const metrics = fontMetrics(doc, item.style);
      ascent = Math.max(ascent, (metrics.ascender / 1000) * item.style.size);
      descent = Math.max(descent, (-metrics.descender / 1000) * item.style.size);
    } else if (item.kind === "math") {
      ascent = Math.max(ascent, item.ascent);
      descent = Math.max(descent, item.depth);
    }
  }
  return { items, width: widthOf(items), ascent, descent, display: items.some(isDisplayMath) };
}

function layout(doc: PDFKit.PDFDocument, runs: ProseRun[], width: number): Line[] {
  const items = buildItems(doc, runs, width);
  const lines: Line[] = [];
  let current: Item[] = [];

  const flush = () => {
    while (isSpace(current[current.length - 1])) current.pop();
    while (isSpace(current[0])) current.shift();
    lines.push(makeLine(doc, current, runs[0]?.style));
    current = [];
  };

  let index = 0;
  while (index < items.length) {
    const item = items[index];
    if (item.kind === "break") {
      flush();
      index++;
    } else if (isDisplayMath(item)) {
      if (current.length) flush();
      current.push(item);
      flush();
      index++;
    } else if (isSpace(item)) {
      if (current.length) current.push(item);
      index++;
    } else {
      // Words, punctuation, and inline math with no whitespace between them stay together.
      const chunk: Item[] = [];
      while (index < items.length && items[index].kind !== "break" && !isSpace(items[index]) && !isDisplayMath(items[index])) chunk.push(items[index++]);
      if (current.length && widthOf(current) + widthOf(chunk) > width) flush();
      current.push(...chunk);
    }
  }
  if (current.length || lines.length === 0) flush();
  return lines;
}

/** Joins neighbouring text items that share a style so each run is one text-showing operator. */
function mergeText(items: Item[]): Item[] {
  const merged: Item[] = [];
  for (const item of items) {
    const last = merged[merged.length - 1];
    if (item.kind === "text" && last?.kind === "text" && last.style === item.style) {
      merged[merged.length - 1] = { ...last, text: last.text + item.text, width: last.width + item.width };
    } else {
      merged.push(item);
    }
  }
  return merged;
}

const lineHeight = (line: Line, lineGap: number) => line.ascent + line.descent + lineGap + (line.display ? 2 * DISPLAY_PAD : 0);

/** Distance from the top of the prose to its first text baseline, so markers can share that baseline. */
export function proseFirstBaseline(doc: PDFKit.PDFDocument, runs: ProseRun[], width: number): number {
  const first = layout(doc, runs, width)[0];
  return (first.display ? DISPLAY_PAD : 0) + first.ascent;
}

/** Height the prose will occupy when drawn at `width`, in points. */
export function proseHeight(doc: PDFKit.PDFDocument, runs: ProseRun[], width: number, options: ProseOptions = {}): number {
  const lineGap = options.lineGap ?? 0;
  return layout(doc, runs, width).reduce((sum, line) => sum + lineHeight(line, lineGap), 0);
}

/** Draws the prose from (x, y) and returns the y just below the last line. Adds pages when a line does not fit. */
export function drawProse(doc: PDFKit.PDFDocument, runs: ProseRun[], x: number, y: number, width: number, options: ProseOptions = {}): number {
  const lineGap = options.lineGap ?? 0;
  let top = y;
  for (const line of layout(doc, runs, width)) {
    const height = lineHeight(line, lineGap);
    if (top + height > doc.page.height - doc.page.margins.bottom - PAGE_BOTTOM_SLACK && top > doc.page.margins.top) {
      doc.addPage();
      top = doc.page.margins.top;
    }
    const baseline = top + (line.display ? DISPLAY_PAD : 0) + line.ascent;
    let cursor = x + (options.align === "center" || line.display ? (width - line.width) / 2 : 0);
    for (const item of mergeText(line.items)) {
      if (item.kind === "text") {
        doc.font(item.style.font).fontSize(item.style.size).fillColor(item.style.color);
        doc.text(item.text, cursor, baseline, { lineBreak: false, baseline: "alphabetic" });
      } else if (item.kind === "math" && item.width > 0 && item.ascent + item.depth > 0) {
        SVGtoPDF(doc, item.svg, cursor, baseline - item.ascent, { width: item.width, height: item.ascent + item.depth, preserveAspectRatio: "xMidYMid meet" });
      }
      if ("width" in item) cursor += item.width;
    }
    top += height;
  }
  doc.x = x;
  doc.y = top;
  return top;
}
