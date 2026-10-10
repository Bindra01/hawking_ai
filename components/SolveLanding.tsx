"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import type { SolveSolution } from "@/lib/solve-types";

type UploadKind = "photo" | "pdf";

function UploadIcon({ kind }: { kind: "photo" | "pdf" | "paste" }) {
  if (kind === "photo") return <svg viewBox="0 0 24 24"><path d="M8.2 5 9.5 3h5L16 5h3.5A2.5 2.5 0 0 1 22 7.5v10a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 17.5v-10A2.5 2.5 0 0 1 4.5 5h3.7ZM12 17a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z" /></svg>;
  if (kind === "pdf") return <svg viewBox="0 0 24 24"><path d="M6 2h8l5 5v15H6V2Zm7 1.8V8h4.2L13 3.8ZM8 12v7h2v-2h1a2.5 2.5 0 0 0 0-5H8Zm2 2h1a.5.5 0 0 1 0 1h-1v-1Zm3 5h2.3c1.7 0 2.7-1.3 2.7-3.5S17 12 15.3 12H13v7Zm2-5h.3c.5 0 .7.6.7 1.5s-.2 1.5-.7 1.5H15v-3Z" /></svg>;
  return <svg viewBox="0 0 24 24"><path d="M8 2h8v2h3v18H5V4h3V2Zm2 2v2h4V4h-4Zm-2 5v2h8V9H8Zm0 4v2h8v-2H8Zm0 4v2h5v-2H8Z" /></svg>;
}

export default function SolveLanding() {
  const router = useRouter();
  const photoRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [problem, setProblem] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clarification, setClarification] = useState("");

  function chooseFile(kind: UploadKind, chosen?: File) {
    if (!chosen) return;
    setFile(chosen);
    setError("");
    if (kind === "photo" && chosen.type === "application/pdf") setError("Choose an image for Photo.");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!problem.trim() && !file) {
      setError("Type a physics problem or attach a file.");
      return;
    }

    setLoading(true);
    setError("");
    setClarification("");

    const body = new FormData();
    body.set("problem", problem.trim());
    if (file) body.set("file", file);

    try {
      const response = await fetch("/api/solve", { method: "POST", body });
      const data = await response.json();
      if (response.status === 401) {
        router.replace("/login?next=/home");
        return;
      }
      if (!response.ok) throw new Error(data.error || "The solution could not be generated.");
      if (data.needs_clarification) {
        setClarification(data.clarification_question);
        return;
      }
      sessionStorage.setItem("hawking-solution", JSON.stringify(data.solution as SolveSolution));
      router.push("/solve");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The solution could not be generated.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="solve-shell">
      <div className="solve-home">
        <header className="solve-brand-row">
          <div>
            <div className="solve-wordmark">HAWKING</div>
            <div className="solve-tagline">Think Through Physics</div>
          </div>
          <Link href="/profile" className="solve-avatar" aria-label="Open profile">AB</Link>
        </header>

        <section className="solve-hero">
          <span className="solve-eyebrow">YOUR PHYSICS COPILOT</span>
          <h1>Stuck on a problem?</h1>
          <p>Send it to Hawking. Get a clear derivation, checks, and the exact trap to avoid.</p>
        </section>

        <form onSubmit={submit}>
          <div className="solve-input-actions">
            <button type="button" onClick={() => photoRef.current?.click()}>
              <UploadIcon kind="photo" /><span>Photo</span>
            </button>
            <button type="button" onClick={() => pdfRef.current?.click()}>
              <UploadIcon kind="pdf" /><span>PDF</span>
            </button>
            <button type="button" onClick={() => textareaRef.current?.focus()}>
              <UploadIcon kind="paste" /><span>Paste</span>
            </button>
          </div>
          <input ref={photoRef} hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => chooseFile("photo", e.target.files?.[0])} />
          <input ref={pdfRef} hidden type="file" accept="application/pdf" onChange={(e) => chooseFile("pdf", e.target.files?.[0])} />

          {file && <div className="selected-file"><span>{file.name}</span><button type="button" onClick={() => setFile(null)}>Remove</button></div>}

          <div className="solve-composer">
            <textarea ref={textareaRef} value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="Or type your problem…" rows={3} />
            <button className="solve-send" type="submit" disabled={loading} aria-label="Solve problem">
              {loading ? <span className="solve-spinner" /> : <svg viewBox="0 0 24 24"><path d="m4 12 15-8-4.5 16-3.2-6.1L4 12Zm7.9.1 2.2 4.2 2.3-8.1-7.6 4 3.1-.1Z" /></svg>}
            </button>
          </div>
          {loading && <p className="solve-status">Reading the problem and building the derivation…</p>}
          {clarification && <div className="solve-message"><strong>I need one detail:</strong> {clarification}</div>}
          {error && <div className="solve-error">{error}</div>}
        </form>

        <div className="solve-divider"><span>or keep practicing</span></div>

        <Link href="/practice" className="practice-entry">
          <div className="practice-orbit"><span>∑</span></div>
          <div className="practice-entry-copy">
            <small>DAILY PRACTICE</small>
            <strong>Build your physics instinct</strong>
            <span>Mechanics, electrodynamics, thermal physics, and more</span>
          </div>
          <svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" /></svg>
        </Link>
      </div>
      <AppNav />
    </main>
  );
}
