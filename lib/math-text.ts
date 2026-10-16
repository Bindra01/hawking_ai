/**
 * Splits prose that mixes English with LaTeX into text and math segments.
 *
 * The model is asked for `$...$` inline math, but it also emits `\(...\)`, `\[...\]`, `$$...$$`,
 * and bare commands such as `\theta` or `\frac{gT^2}{2d}`. Every renderer (web and PDF) goes
 * through this one parser so the same input produces the same split everywhere.
 */
export type MathSegment =
  | { kind: "text"; content: string }
  | { kind: "math"; latex: string; display: boolean };

const DELIMITED = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g;
const OPERATORS = "=+-*/<>|";

export function parseMathText(text: string): MathSegment[] {
  const segments: MathSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(DELIMITED)) {
    pushPlain(segments, text.slice(cursor, match.index));
    const display = match[1] !== undefined || match[2] !== undefined;
    const latex = (match[1] ?? match[2] ?? match[3] ?? match[4]).trim();
    if (latex) segments.push({ kind: "math", latex, display });
    cursor = match.index + match[0].length;
  }
  pushPlain(segments, text.slice(cursor));
  return segments;
}

export function hasMath(text: string): boolean {
  return parseMathText(text).some((segment) => segment.kind === "math");
}

/** Splits undelimited text at bare LaTeX runs such as `\theta` or `\sin\theta = \frac{a}{b}`. */
function pushPlain(segments: MathSegment[], text: string) {
  const command = /\\[A-Za-z]+/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = command.exec(text))) {
    const end = bareRunEnd(text, match.index);
    if (match.index > cursor) segments.push({ kind: "text", content: text.slice(cursor, match.index) });
    segments.push({ kind: "math", latex: text.slice(match.index, end), display: false });
    cursor = end;
    command.lastIndex = end;
  }
  if (cursor < text.length) segments.push({ kind: "text", content: text.slice(cursor) });
}

function bareRunEnd(text: string, start: number): number {
  let i = readCommand(text, start);
  for (;;) {
    let j = i;
    while (text[j] === " " || text[j] === "\t") j++;
    const next = readMathToken(text, j, j > i, i);
    if (next === null) break;
    i = next;
  }
  let run = text.slice(start, i).replace(/[\s,.;:=+\-*/<>|]+$/, "");
  while (run.endsWith(")") && count(run, "(") < count(run, ")")) run = run.slice(0, -1);
  return start + run.length;
}

function readCommand(text: string, at: number): number {
  let i = at + 1;
  while (i < text.length && /[A-Za-z]/.test(text[i])) i++;
  return i;
}

function readGroup(text: string, at: number): number | null {
  let depth = 0;
  for (let i = at; i < text.length; i++) {
    if (text[i] === "{") depth++;
    if (text[i] === "}" && --depth === 0) return i + 1;
  }
  return null;
}

/**
 * Reads one token that may continue a bare math run. `spaced` is true when whitespace separates
 * the token from the previous one; only commands, groups, and operators may follow a space, and a
 * number may follow a spaced operator. `previousEnd` is the index just after the previous token.
 */
function readMathToken(text: string, at: number, spaced: boolean, previousEnd: number): number | null {
  const char = text[at];
  if (char === undefined) return null;
  if (char === "\\" && /[A-Za-z]/.test(text[at + 1] ?? "")) return readCommand(text, at);
  if (char === "{") return readGroup(text, at);
  if (OPERATORS.includes(char)) return at + 1;
  if (char === "_" || char === "^") {
    const target = text[at + 1];
    if (target === "{") return readGroup(text, at + 1);
    if (target === "\\") return readMathToken(text, at + 1, false, at + 1);
    return /[A-Za-z0-9]/.test(target ?? "") ? at + 2 : null;
  }
  const afterOperator = OPERATORS.includes(text[previousEnd - 1] ?? "");
  if (/[0-9]/.test(char) && (!spaced || afterOperator)) {
    let i = at;
    while (/[0-9]/.test(text[i] ?? "") || (text[i] === "." && /[0-9]/.test(text[i + 1] ?? ""))) i++;
    return i;
  }
  if (spaced) return null;
  if (char === "(" || char === ")" || char === "'") return at + 1;
  if (/[A-Za-z]/.test(char) && !/[A-Za-z]/.test(text[at + 1] ?? "")) return at + 1;
  return null;
}

function count(text: string, char: string): number {
  return text.split(char).length - 1;
}
