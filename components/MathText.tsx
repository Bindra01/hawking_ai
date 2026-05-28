"use client";

import katex from "katex";

interface MathTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

type Segment = { kind: "text" | "inline" | "display"; content: string };

function parse(text: string): Segment[] {
  const segments: Segment[] = [];
  // $$...$$ must be matched before $...$
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > cursor) {
      segments.push({ kind: "text", content: text.slice(cursor, m.index) });
    }
    if (m[1] !== undefined) {
      segments.push({ kind: "display", content: m[1] });
    } else {
      segments.push({ kind: "inline", content: m[2] });
    }
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) {
    segments.push({ kind: "text", content: text.slice(cursor) });
  }
  return segments;
}

function renderMath(latex: string, display: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode: display,
      throwOnError: false,
      output: "html",
      trust: false,
    });
  } catch {
    return latex;
  }
}

export default function MathText({ text, className, style }: MathTextProps) {
  const segments = parse(text);
  return (
    <span className={className} style={style}>
      {segments.map((seg, i) => {
        if (seg.kind === "text") {
          return <span key={i}>{seg.content}</span>;
        }
        const html = renderMath(seg.content, seg.kind === "display");
        return (
          <span
            key={i}
            dangerouslySetInnerHTML={{ __html: html }}
            style={seg.kind === "display" ? { display: "block", textAlign: "center", margin: "0.4em 0" } : undefined}
          />
        );
      })}
    </span>
  );
}
