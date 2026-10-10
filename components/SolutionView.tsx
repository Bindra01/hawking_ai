"use client";

import { useState } from "react";
import Link from "next/link";
import katex from "katex";
import AppNav from "@/components/AppNav";
import { HAWKING_FOOTER, highPriority, type SolveFormat, type SolveSolution, type SolveStep } from "@/lib/solve-types";

function MathBlock({ latex, inline = false }: { latex: string; inline?: boolean }) {
  return <span className={inline ? "math-inline" : "math-display"} dangerouslySetInnerHTML={{ __html: katex.renderToString(latex, { displayMode: !inline, throwOnError: false, output: "html", trust: false }) }} />;
}

function firstLine(text: string) {
  return text.split(/(?<=[.!?])\s+/)[0] || text;
}

function StepSection({ number, step, color, format }: { number: number; step: SolveStep; color: string; format: SolveFormat }) {
  const tipVisible = step.tip && (format === "long" || step.tip.priority === "high");
  const warningVisible = step.warning && (format === "long" || step.warning.priority === "high");
  return (
    <section className="solution-section">
      <div className="step-heading">
        <span className="step-badge">STEP {number}</span>
        <h2 style={{ color }}>{step.label}</h2>
      </div>
      <div className="answer-box"><strong>ANSWER</strong><p>{step.answer}</p></div>
      {step.explanation && <p className="solution-explanation">{format === "short" ? firstLine(step.explanation) : step.explanation}</p>}
      {tipVisible && <div className="tip-box"><strong>TIP</strong><span>{step.tip?.text}</span></div>}
      {warningVisible && <div className="warning-box"><strong>WARNING</strong><span>{step.warning?.text}</span></div>}
    </section>
  );
}

export default function SolutionView({ solution }: { solution: SolveSolution }) {
  const [format, setFormat] = useState<SolveFormat>("short");
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloading, setDownloading] = useState<SolveFormat | null>(null);
  const reality = format === "short" ? highPriority(solution.reality_checks, 2) : solution.reality_checks;
  const errors = format === "short" ? highPriority(solution.common_errors, 2) : solution.common_errors;
  const takeaways = format === "short" ? highPriority(solution.takeaways, 3) : solution.takeaways;

  async function downloadPdf(pdfFormat: SolveFormat) {
    setDownloading(pdfFormat);
    setDownloadOpen(false);
    try {
      const response = await fetch("/api/solve/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solution, format: pdfFormat }),
      });
      if (!response.ok) throw new Error("PDF generation failed.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${solution.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${pdfFormat}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <main className="solution-page">
      <header className="solution-toolbar">
        <Link href="/home" className="back-button" aria-label="Back to home"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7" /></svg></Link>
        <div className="format-toggle" aria-label="Solution length">
          <button className={format === "short" ? "active" : ""} onClick={() => setFormat("short")}>Short</button>
          <button className={format === "long" ? "active" : ""} onClick={() => setFormat("long")}>Long</button>
        </div>
        <div className="download-menu">
          <button className="download-button" onClick={() => setDownloadOpen((value) => !value)} aria-label="Download PDF" disabled={downloading !== null}>
            {downloading ? <span className="solve-spinner dark" /> : <svg viewBox="0 0 24 24"><path d="M12 3v12m-5-5 5 5 5-5M5 20h14" /></svg>}
          </button>
          {downloadOpen && <div className="download-popover">
            <button onClick={() => downloadPdf("short")}>Download Short PDF</button>
            <button onClick={() => downloadPdf("long")}>Download Long PDF</button>
          </div>}
        </div>
      </header>

      <article className="solution-paper">
        <div className="solution-cover">
          <div className="solution-logo">HAWKING <span>· Think Through Physics</span></div>
          <h1>{solution.title}</h1>
          <div className="solution-tags">{solution.tags.join(" · ")}</div>
        </div>

        <section className="problem-section">
          <h2>THE PROBLEM</h2>
          <p>{solution.problem_statement}</p>
          {solution.problem_options.length > 0 && <div className="problem-options">{solution.problem_options.map((option) => <span key={option}>{option}</span>)}</div>}
          <em>{solution.framing_line}</em>
        </section>

        <StepSection number={1} step={solution.step1} color="var(--hawking-purple)" format={format} />
        <StepSection number={2} step={solution.step2} color="var(--hawking-orange)" format={format} />
        <StepSection number={3} step={solution.step3} color="var(--hawking-teal)" format={format} />

        <section className="solution-section derivation-section">
          <div className="step-heading"><span className="step-badge">STEPS 4→6</span><h2 style={{ color: "var(--hawking-blue)" }}>{solution.derivation.label}</h2></div>
          <div className="derivation-flow">
            {solution.derivation.blocks.map((block, index) => {
              if (block.type === "subsection") return <h3 key={index}>{block.title}</h3>;
              if (block.type === "prose") return <p key={index}>{block.text}</p>;
              if (block.type === "boxed_result") return <div className="intermediate-result" key={index}><MathBlock latex={block.latex} /></div>;
              return <div className="equation-block" key={index}><MathBlock latex={block.latex} />{block.annotation && <em>{block.annotation}</em>}</div>;
            })}
          </div>
          <div className="final-answer"><small>FINAL ANSWER</small><MathBlock latex={solution.final_answer.latex} /><strong>{solution.final_answer.display}</strong></div>
        </section>

        <section className="solution-section check-section">
          <h2>REALITY CHECK</h2>
          <div className="check-list">{reality.map((item, index) => <div key={index}><span>✓</span><p><strong>{item.heading}</strong>{item.text}</p></div>)}</div>
        </section>

        <section className="solution-section errors-section">
          <h2>WHERE STUDENTS GO WRONG</h2>
          <ol>{errors.map((item, index) => <li key={index}><strong>{item.title}</strong><span>{item.text}</span></li>)}</ol>
        </section>

        <section className="solution-section takeaway-section">
          <h2>TAKE THESE INTO YOUR NEXT PROBLEM</h2>
          <ul>{takeaways.map((item, index) => <li key={index}>{item.text}</li>)}</ul>
        </section>

        <footer className="solution-footer">
          <strong>hawking-mauve.vercel.app · Think Through Physics</strong>
          <p>{HAWKING_FOOTER}</p>
        </footer>
      </article>
      <AppNav />
    </main>
  );
}
