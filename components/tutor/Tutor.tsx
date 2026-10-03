"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { TutorSession } from "@/lib/tutor/session";
import { BrowserSpeech } from "@/lib/tutor/speech";
import type { GenerationRequest, Lesson } from "@/lib/tutor/types";
import { Whiteboard } from "./Whiteboard";

const subscribeSupport = () => () => {};
const speechSupported = () => !!window.speechSynthesis;
const serverSupport = () => true;

export default function Tutor() {
  const [session] = useState(() => new TutorSession(new BrowserSpeech()));
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [topic, setTopic] = useState("");
  const [lessonTopic, setLessonTopic] = useState("");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const supported = useSyncExternalStore(subscribeSupport, speechSupported, serverSupport);
  const request = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  useEffect(() => {
    // Populate the voice list early; some browsers load it asynchronously.
    window.speechSynthesis?.getVoices();
    const onHide = () => { if (document.hidden) session.pause(); };
    document.addEventListener("visibilitychange", onHide);
    return () => { request.current?.abort(); session.dispose(); document.removeEventListener("visibilitychange", onHide); };
  }, [session]);
  async function generate(payload: GenerationRequest): Promise<Lesson> {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const timer = setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch("/api/tutor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not prepare your lesson. Please try again.");
      return data;
    } finally { clearTimeout(timer); }
  }
  async function startLesson(value = topic) {
    if (!value.trim()) return;
    const id = ++requestId.current;
    session.reset(); setLoading(true); setError(""); setQuestion(""); setTopic(value);
    try {
      const lesson = await generate({ topic: value.trim() });
      if (id === requestId.current) { setLessonTopic(value.trim()); session.load(lesson); }
    } catch (e) { if (id === requestId.current) setError(e instanceof Error && e.name !== "AbortError" ? e.message : "The request timed out. Please try again."); }
    finally { if (id === requestId.current) setLoading(false); }
  }
  async function ask() {
    if (!question.trim() || state.status !== "paused_for_question") return;
    const id = ++requestId.current;
    session.generatingAnswer();
    const main = state.stack[0];
    const context = main?.lesson.beats.slice(0, main.position.beat + 1).map(b => b.narration).join(" ").slice(-4000);
    try {
      const answer = await generate({ topic: lessonTopic, question: question.trim(), context });
      if (id === requestId.current) { setQuestion(""); session.answer(answer); }
    } catch (e) { if (id === requestId.current) session.answerFailed(e instanceof Error && e.name !== "AbortError" ? e.message : "The answer timed out. Retry or return to your lesson."); }
  }
  function returnToLesson() { requestId.current++; request.current?.abort(); setQuestion(""); session.returnToLesson(); }
  const active = state.active;
  const main = state.stack[0] ?? active;
  const playing = state.status === "playing" || state.status === "answering";
  const answering = state.stack.length > 0 && state.status !== "paused_for_question" && state.status !== "generating_answer";
  const current = active?.lesson.beats[active.position.beat];
  const sections = [...new Set(main?.lesson.beats.map(b => b.section) ?? [])];
  const mainSection = main?.lesson.beats[Math.min(main.position.beat, main.lesson.beats.length - 1)]?.section;
  const percent = main ? Math.round(100 * Math.min(1, (main.position.beat + main.position.progress) / main.lesson.beats.length)) : 0;
  const canAsk = !!active && !loading && !answering && state.status !== "done" && state.status !== "generating_answer";
  const label = loading ? "Preparing your lesson" : state.status === "generating_answer" ? "Thinking through your question" : answering ? "A quick detour" : state.status === "done" ? "Lesson complete" : state.status === "paused_for_question" ? "Your lesson is on hold" : playing ? "Let’s work through it" : active ? "Ready when you are" : "Your own physics tutor";
  return <main className="tutor-shell">
    <header className="tutor-header"><a href="/tutor" className="tutor-logo"><span className="logo-orbit">h</span>hawking<span className="logo-divider" /> <small>the physics studio</small></a><span className="prototype-label">CLASS 11–12 <span> / </span> LIVE LEARNING</span></header>
    <section className="tutor-intro"><div><p className="eyebrow">UNDERSTAND IT. DON’T JUST MEMORIZE IT.</p><h1>Big ideas. <em>Small aha moments.</em></h1><p>A voice, a whiteboard, and room for every question.</p></div><span className="intro-note">Physics, at your pace.</span></section>
    <form className="topic-form" onSubmit={e => { e.preventDefault(); void startLesson(); }}><label htmlFor="topic">What are you curious about?</label><div className="topic-input-row"><input id="topic" maxLength={160} placeholder="Try a physics topic, like work and energy…" value={topic} onChange={e => setTopic(e.target.value)} disabled={loading} /><button className="primary" disabled={loading || !topic.trim()}>{loading ? "Preparing…" : "Create lesson"}<span aria-hidden="true">↗</span></button></div><div className="topic-seeds"><span>A place to start</span>{["Work", "Energy", "Power", "Electrostatics"].map(seed => <button type="button" key={seed} disabled={loading} onClick={() => void startLesson(seed)}>{seed} <span aria-hidden="true">↗</span></button>)}</div></form>
    {(error || state.error || !supported) && <div className="tutor-error" role="alert">{error || state.error || "This browser does not support narration. Use Chrome, Edge, or Safari with a speech voice installed."}</div>}
    <div className="studio-grid"><section className="lesson-panel" aria-label="Lesson player"><div className="lesson-heading"><div><span className={`status-dot ${playing ? "is-playing" : ""}`} /><span aria-live="polite">{label}</span></div><span>{active ? active.lesson.title : "~2 MIN · ONE CLEAR IDEA"}</span></div>
      <Whiteboard thread={active} writing={playing} />
      <div className="narration-caption">{loading ? "Building an explanation, one small teaching step at a time…" : current?.narration ?? (state.status === "done" ? "That’s a wrap. Pick another topic to keep exploring." : "Your explanation will appear here as your tutor speaks.")}</div>
      <div className="playback"><button className="play-button" disabled={!active || loading || !supported || ["paused_for_question", "generating_answer"].includes(state.status)} onClick={() => { if (state.status === "done" && active) { session.load(active.lesson); session.play(); } else if (playing) session.pause(); else session.play(); }} aria-label={playing ? "Pause lesson" : state.status === "done" ? "Replay lesson" : "Play lesson"}>{playing ? "Ⅱ" : "▶"}</button><div className="playback-progress"><div><strong>{state.status === "done" ? "Replay lesson" : playing ? "Pause" : active ? "Play lesson" : "Your lesson awaits"}</strong><span>{percent}%</span></div><progress max={100} value={percent} aria-label="Main lesson progress" /></div><label className="rate-control">PACE<select aria-label="Narration speed" value={state.rate} onChange={e => session.setRate(Number(e.target.value))}><option value={.75}>0.75×</option><option value={.9}>0.9×</option><option value={1}>1×</option><option value={1.15}>1.15×</option></select></label></div>
      <div className="speech-note">Browser voice · Word-synced when supported; estimated timing otherwise.</div>
    </section><aside className="tutor-sidebar"><section className="question-card"><div className="card-kicker"><span className="question-icon">?</span> CURIOSITY WELCOME</div><h2>Wait, why?</h2><p>Ask as you go. We’ll pause here, work it out, then pick up where you left off.</p><form onSubmit={e => { e.preventDefault(); void ask(); }}><label htmlFor="question" className="sr-only">Your physics question</label><textarea id="question" maxLength={600} placeholder="What doesn’t quite click?" value={question} disabled={!canAsk} onChange={e => { setQuestion(e.target.value); if (e.target.value) session.beginQuestion(); }} /><button className="ask-button" disabled={!question.trim() || state.status !== "paused_for_question"}>{state.status === "generating_answer" ? "Preparing answer…" : "Let’s work it out"}<span aria-hidden="true">↗</span></button></form>{state.stack.length > 0 ? <button className="return-button" onClick={returnToLesson}>{answering ? "Skip answer & resume lesson" : "Cancel & resume lesson"}</button> : <small>Typing pauses the lesson. No question is too small.</small>}</section>
      <section className="outline-card"><p className="eyebrow">THE PATH TO UNDERSTANDING</p><ol>{(sections.length ? sections : ["Start with an intuition", "Give the idea a name", "Build the equation", "Try a real example", "Clear up a common mistake"]).map((section, i) => <li key={section} className={section === mainSection ? "current" : ""}><span>{String(i + 1).padStart(2, "0")}</span>{section}</li>)}</ol></section><div className="sidebar-note">“The important thing is not to stop questioning.”<span>Keep that curiosity.</span></div></aside></div>
    <footer className="tutor-footer"><span>Made for understanding, not memorizing.</span><span>No account. No recording. Just learning.</span></footer>
  </main>;
}
