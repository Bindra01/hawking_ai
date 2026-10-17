import { inflateSync } from "node:zlib";

/** Decodes every text-showing operator in a pdfkit PDF so its words can be searched as plain text. */
export function pdfText(pdf: Buffer): string {
  const raw = pdf.toString("latin1");
  const streams = [...raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map((match) => {
    const bytes = Buffer.from(match[1], "latin1");
    try {
      return inflateSync(bytes).toString("latin1");
    } catch {
      return match[1];
    }
  });
  return streams
    .join("\n")
    .split("\n")
    .filter((line) => / T[Jj]$/.test(line))
    .map((line) => [...line.matchAll(/<([0-9a-fA-F]+)>/g)].map((hex) => Buffer.from(hex[1], "hex").toString("latin1")).join(""))
    .join("\n");
}

/** Counts vector path segments (MathJax glyph outlines) in the PDF content streams. */
export function pdfCurveCount(pdf: Buffer): number {
  const raw = pdf.toString("latin1");
  let count = 0;
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try {
      count += (inflateSync(Buffer.from(match[1], "latin1")).toString("latin1").match(/ c\n/g) ?? []).length;
    } catch {
      /* not a compressed stream */
    }
  }
  return count;
}
