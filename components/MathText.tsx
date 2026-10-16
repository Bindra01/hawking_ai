"use client";

import katex from "katex";
import { parseMathText } from "@/lib/math-text";

interface MathTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
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

/** Renders prose that mixes English with `$...$`, `\(...\)`, `$$...$$`, `\[...\]`, or bare LaTeX. */
export default function MathText({ text, className, style }: MathTextProps) {
  const segments = parseMathText(text);
  return (
    <span className={className} style={style}>
      {segments.map((seg, i) => {
        if (seg.kind === "text") {
          return <span key={i}>{seg.content}</span>;
        }
        const html = renderMath(seg.latex, seg.display);
        return (
          <span
            key={i}
            dangerouslySetInnerHTML={{ __html: html }}
            style={seg.display ? { display: "block", textAlign: "center", margin: "0.4em 0" } : undefined}
          />
        );
      })}
    </span>
  );
}
