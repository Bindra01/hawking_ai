"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import MathText from "@/components/MathText";
import { TOPIC_SUGGESTIONS } from "@/lib/constants";
import { Step, getStepFormat } from "@/lib/types";

interface Problem {
  id: string;
  title: string;
  subject: string;
  topic: string;
  difficulty: string;
  scenario: string;
  goal: string;
  final_answer: string;
  status: string;
  solution_flow: {
    steps: Step[];
  };
  created_at: string;
}

interface Student {
  id: string;
  email: string;
  name: string | null;
  total_xp: number;
  current_streak: number;
  last_login: string | null;
  created_at: string;
  problems_attempted: number;
}

const SUBJECTS = [
  { key: "mechanics", label: "Mechanics" },
  { key: "electrodynamics", label: "Electrodynamics" },
  { key: "thermodynamics", label: "Thermodynamics" },
  { key: "quantum_mechanics", label: "Quantum Mechanics" },
];

const DIFFICULTIES = [
  { key: "class_11", label: "Class 11" },
  { key: "class_12", label: "Class 12" },
  { key: "college", label: "College" },
];

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  draft: { bg: "#2e2e0a", text: "#ffc800", border: "#ffc800" },
  approved: { bg: "#0a2e1a", text: "#34d399", border: "#34d399" },
  published: { bg: "#0a1a2e", text: "#1cb0f6", border: "#1cb0f6" },
  rejected: { bg: "#2e0a0a", text: "#ff4b4b", border: "#ff4b4b" },
};

export default function AdminPage() {
  // Active dashboard tab
  const [tab, setTab] = useState<"problems" | "students">("problems");

  // Generation form state
  const [subject, setSubject] = useState("mechanics");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("class_11");
  const [count, setCount] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState("");

  // Problems list state
  const [problems, setProblems] = useState<Problem[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const problemsListRef = useRef<HTMLDivElement>(null);

  // Students list state
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);

  const fetchProblems = useCallback(async () => {
    setLoading(true);
    const url = statusFilter
      ? `/api/admin/problems?status=${statusFilter}`
      : "/api/admin/problems";
    try {
      const res = await fetch(url);
      const data = await res.json();
      // Ensure newest problems always appear first (sort client-side as a
      // safety net on top of the API's own created_at DESC ordering).
      const sorted = Array.isArray(data)
        ? [...data].sort(
            (a: Problem, b: Problem) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        : [];
      setProblems(sorted);
    } catch {
      setProblems([]);
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    fetchProblems();
  }, [fetchProblems]);

  const fetchStudents = useCallback(async () => {
    setStudentsLoading(true);
    try {
      const res = await fetch("/api/admin/students");
      const data = await res.json();
      setStudents(Array.isArray(data) ? data : []);
    } catch {
      setStudents([]);
    }
    setStudentsLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "students") {
      fetchStudents();
    }
  }, [tab, fetchStudents]);

  async function handleGenerate() {
    if (!topic.trim()) {
      setGenMessage("Please enter a topic");
      return;
    }
    setGenerating(true);
    setGenMessage("");
    try {
      const res = await fetch("/api/admin/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, topic: topic.trim(), difficulty, count }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenMessage(`Error: ${data.error}`);
      } else {
        setGenMessage(data.message);
        await fetchProblems();
        // Scroll to the problems list so the newly generated problem (at the
        // top, sorted by created_at DESC) is immediately visible.
        problemsListRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    } catch (err) {
      setGenMessage(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    setGenerating(false);
  }

  async function updateStatus(problemId: string, newStatus: string) {
    try {
      const res = await fetch(`/api/admin/problems/${problemId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchProblems();
      } else {
        const data = await res.json().catch(() => ({}));
        setGenMessage(`Error updating status: ${data.error || res.statusText}`);
      }
    } catch (err) {
      setGenMessage(`Error updating status: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  const suggestions = TOPIC_SUGGESTIONS[subject] || [];

  return (
    <div className="min-h-screen" style={{ background: "#131327" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }} className="flex flex-col gap-8 px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black" style={{ color: "#e5e5e5" }}>
              {tab === "problems" ? "Problem Generator" : "Students"}
            </h1>
            <p className="text-sm mt-1" style={{ color: "#6b6b80" }}>
              {tab === "problems"
                ? "AI-powered physics problem creation"
                : "Registered students and their activity"}
            </p>
          </div>
          <a
            href="/home"
            className="px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: "#1a1a2e", color: "#afafbf", border: "2px solid #2a2a40" }}
          >
            ← Back
          </a>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2">
          {([
            { key: "problems", label: "Problems" },
            { key: "students", label: "Students" },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-4 py-2 rounded-xl text-sm font-black"
              style={{
                background: tab === t.key ? "#7c3aed" : "#1a1a2e",
                color: tab === t.key ? "#fff" : "#afafbf",
                border: tab === t.key ? "none" : "2px solid #2a2a40",
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "students" && (
          <StudentsList students={students} loading={studentsLoading} />
        )}

        {tab === "problems" && (
        <>
        {/* Generation Form */}
        <div
          className="rounded-2xl p-5 flex flex-col gap-4"
          style={{ background: "#1a1a2e", border: "2px solid #2a2a40" }}
        >
          <h2 className="text-sm font-black uppercase" style={{ color: "#7c3aed", letterSpacing: "1.5px" }}>
            Generate New Problems
          </h2>

          {/* Subject */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase" style={{ color: "#6b6b80", letterSpacing: "1px" }}>
              Subject
            </label>
            <div className="flex gap-2 flex-wrap">
              {SUBJECTS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => { setSubject(s.key); setTopic(""); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold"
                  style={{
                    background: subject === s.key ? "#7c3aed" : "#2a2a40",
                    color: subject === s.key ? "#fff" : "#afafbf",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Topic */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase" style={{ color: "#6b6b80", letterSpacing: "1px" }}>
              Topic
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Kinematics, Electrostatics..."
              className="w-full px-4 py-3 rounded-xl text-sm font-semibold"
              style={{
                background: "#0d0d1a",
                color: "#e5e5e5",
                border: "2px solid #2a2a40",
                outline: "none",
              }}
            />
            {suggestions.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mt-1">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setTopic(s)}
                    className="px-2.5 py-1 rounded-md text-xs font-semibold"
                    style={{
                      background: topic === s ? "#7c3aed33" : "#2a2a40",
                      color: topic === s ? "#7c3aed" : "#6b6b80",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Difficulty */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase" style={{ color: "#6b6b80", letterSpacing: "1px" }}>
              Difficulty
            </label>
            <div className="flex gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.key}
                  onClick={() => setDifficulty(d.key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold"
                  style={{
                    background: difficulty === d.key ? "#7c3aed" : "#2a2a40",
                    color: difficulty === d.key ? "#fff" : "#afafbf",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Count */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase" style={{ color: "#6b6b80", letterSpacing: "1px" }}>
              How many? (1-5)
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className="w-10 h-10 rounded-lg text-sm font-bold"
                  style={{
                    background: count === n ? "#7c3aed" : "#2a2a40",
                    color: count === n ? "#fff" : "#afafbf",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full py-3.5 rounded-xl font-black text-sm uppercase"
            style={{
              background: generating ? "#2a2a40" : "#7c3aed",
              color: generating ? "#6b6b80" : "#fff",
              boxShadow: generating ? "none" : "0 4px 0 #5b21b6",
              letterSpacing: "1.5px",
              border: "none",
              cursor: generating ? "not-allowed" : "pointer",
            }}
          >
            {generating ? `Generating ${count} problem${count > 1 ? "s" : ""}...` : `Generate ${count} Problem${count > 1 ? "s" : ""}`}
          </button>

          {genMessage && (
            <p
              className="text-sm font-semibold text-center"
              style={{ color: genMessage.startsWith("Error") ? "#ff4b4b" : "#34d399" }}
            >
              {genMessage}
            </p>
          )}
        </div>

        {/* Problems List */}
        <div ref={problemsListRef} className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase" style={{ color: "#7c3aed", letterSpacing: "1.5px" }}>
              All Problems ({problems.length})
            </h2>
            <div className="flex gap-1.5">
              {["", "draft", "approved", "published", "rejected"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className="px-2.5 py-1 rounded-md text-xs font-bold"
                  style={{
                    background: statusFilter === s ? "#7c3aed" : "#2a2a40",
                    color: statusFilter === s ? "#fff" : "#6b6b80",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {s || "All"}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "#1a1a2e" }} />
              ))}
            </div>
          ) : problems.length === 0 ? (
            <p className="text-center py-8 text-sm font-semibold" style={{ color: "#6b6b80" }}>
              No problems found
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {problems.map((p) => (
                <ProblemRow
                  key={p.id}
                  problem={p}
                  expanded={expandedId === p.id}
                  onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  onStatusChange={updateStatus}
                />
              ))}
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
}

// Formats an ISO date string as a short, human-readable date. Returns "—" for
// null/invalid values so empty cells read cleanly in the roster.
function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Admin-only roster of registered students and their activity.
function StudentsList({ students, loading }: { students: Student[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: "#1a1a2e" }} />
        ))}
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <p className="text-center py-8 text-sm font-semibold" style={{ color: "#6b6b80" }}>
        No students yet
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-black uppercase" style={{ color: "#7c3aed", letterSpacing: "1.5px" }}>
        Students ({students.length})
      </h2>
      <div className="flex flex-col gap-3">
        {students.map((s) => (
          <div
            key={s.id}
            className="rounded-2xl p-4 flex flex-col gap-2"
            style={{ background: "#1a1a2e", border: "2px solid #2a2a40" }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-black truncate" style={{ color: "#e5e5e5" }}>
                  {s.name || "Unnamed"}
                </span>
                <span className="text-xs truncate" style={{ color: "#afafbf" }}>
                  {s.email}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-base">⚡</span>
                <span className="text-sm font-black" style={{ color: "#ffc800" }}>
                  {s.total_xp} XP
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "#6b6b80" }}>
              <span>🔥 {s.current_streak} day streak</span>
              <span>📝 {s.problems_attempted} attempted</span>
              <span>Joined {formatDate(s.created_at)}</span>
              <span>Last login {formatDate(s.last_login)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Read-only, format-aware preview of a single solution step for the admin list.
function StepPreview({ step }: { step: Step }) {
  const format = getStepFormat(step);

  if (format === "claim" && step.claim) {
    const { statement, isTrap } = step.claim;
    return (
      <div className="flex flex-col gap-1.5 mt-2">
        <MathText
          text={statement}
          className="text-xs italic"
          style={{ color: "#e5e5e5" }}
        />
        <div className="flex flex-col gap-1">
          <div className="flex items-start gap-1.5">
            <span className="text-xs mt-0.5" style={{ color: isTrap ? "#ff4b4b" : "#34d399" }}>
              {isTrap ? "✗" : "✓"}
            </span>
            <span className="text-xs" style={{ color: isTrap ? "#afafbf" : "#34d399" }}>
              SOUND RIGHT
            </span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="text-xs mt-0.5" style={{ color: isTrap ? "#34d399" : "#ff4b4b" }}>
              {isTrap ? "✓" : "✗"}
            </span>
            <span className="text-xs" style={{ color: isTrap ? "#34d399" : "#afafbf" }}>
              IT&apos;S A TRAP
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (format === "multiselect" && step.multiselect) {
    return (
      <div className="flex flex-col gap-1 mt-2">
        {step.multiselect.items.map((item, j) => (
          <div key={j} className="flex items-start gap-1.5">
            <span className="text-xs mt-0.5" style={{ color: item.matters ? "#34d399" : "#ff4b4b" }}>
              {item.matters ? "✓" : "✗"}
            </span>
            <MathText
              text={item.text}
              className="text-xs"
              style={{ color: item.matters ? "#34d399" : "#afafbf" }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (format === "predict" && step.predict) {
    const { target, variables } = step.predict;
    return (
      <div className="flex flex-col gap-1.5 mt-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold" style={{ color: "#6b6b80" }}>
            Target
          </span>
          <MathText text={`$${target}$`} className="text-xs" style={{ color: "#e5e5e5" }} />
        </div>
        {variables.map((v, j) => (
          <div key={j} className="flex items-start gap-1.5">
            <MathText text={`$${v.symbol}$`} className="text-xs" style={{ color: "#e5e5e5" }} />
            <span className="text-xs" style={{ color: "#6b6b80" }}>→</span>
            <span
              className="text-xs"
              style={{ color: v.role === "numerator" ? "#34d399" : "#38bdf8" }}
            >
              {v.role}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (format === "build" && step.build) {
    const { tiles, accepted } = step.build;
    return (
      <div className="flex flex-col gap-1.5 mt-2">
        <div className="flex flex-wrap gap-1">
          {tiles.map((tile, j) => (
            <span
              key={j}
              className="px-2 py-0.5 rounded-md text-xs"
              style={{ background: "#1a1a2e", border: "1px solid #2a2a40", color: "#e5e5e5" }}
            >
              <MathText text={tile} className="text-xs" />
            </span>
          ))}
        </div>
        {accepted[0] && (
          <div className="flex items-start gap-1.5">
            <span className="text-xs mt-0.5" style={{ color: "#34d399" }}>✓</span>
            <span className="text-xs" style={{ color: "#34d399" }}>
              <MathText text={accepted[0].join("  ")} className="text-xs" />
            </span>
          </div>
        )}
      </div>
    );
  }

  // mcq (and legacy) — unchanged options rendering.
  return (
    <div className="flex flex-col gap-1 mt-2">
      {(step.options ?? []).map((opt, j) => (
        <div key={j} className="flex items-start gap-1.5">
          <span className="text-xs mt-0.5" style={{ color: opt.correct ? "#34d399" : "#ff4b4b" }}>
            {opt.correct ? "✓" : "✗"}
          </span>
          <MathText
            text={opt.text}
            className="text-xs"
            style={{ color: opt.correct ? "#34d399" : "#afafbf" }}
          />
        </div>
      ))}
    </div>
  );
}

function ProblemRow({
  problem,
  expanded,
  onToggle,
  onStatusChange,
}: {
  problem: Problem;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const statusStyle = STATUS_COLORS[problem.status] || STATUS_COLORS.draft;
  const steps = problem.solution_flow?.steps || [];

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "#1a1a2e", border: "2px solid #2a2a40" }}
    >
      {/* Summary row */}
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 p-4 text-left"
        style={{ background: "transparent", border: "none", cursor: "pointer" }}
      >
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm leading-tight truncate" style={{ color: "#e5e5e5" }}>
            {problem.title}
          </h3>
          <p className="text-xs mt-1" style={{ color: "#6b6b80" }}>
            {problem.subject.replace("_", " ")} · {problem.topic} · {problem.difficulty.replace("_", " ")} · {steps.length} steps
          </p>
        </div>
        <span
          className="shrink-0 px-2.5 py-1 rounded-full text-xs font-black uppercase"
          style={{
            background: statusStyle.bg,
            color: statusStyle.text,
            border: `1.5px solid ${statusStyle.border}`,
            letterSpacing: "0.8px",
            fontSize: "10px",
          }}
        >
          {problem.status}
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-4" style={{ borderTop: "1px solid #2a2a40" }}>
          {/* Scenario */}
          <div className="pt-3">
            <p className="text-xs font-black uppercase mb-1.5" style={{ color: "#6b6b80", letterSpacing: "1px" }}>
              Scenario
            </p>
            <MathText
              text={problem.scenario}
              className="text-sm font-semibold leading-relaxed"
              style={{ color: "#e5e5e5" }}
            />
          </div>

          {/* Answer */}
          <div className="flex gap-4">
            <div>
              <p className="text-xs font-black uppercase mb-1" style={{ color: "#6b6b80", letterSpacing: "1px" }}>
                Goal
              </p>
              <p className="text-sm font-bold" style={{ color: "#ffc800" }}>{problem.goal}</p>
            </div>
            <div>
              <p className="text-xs font-black uppercase mb-1" style={{ color: "#6b6b80", letterSpacing: "1px" }}>
                Answer
              </p>
              <MathText
                text={problem.final_answer}
                className="text-sm font-bold"
                style={{ color: "#34d399" }}
              />
            </div>
          </div>

          {/* Steps preview */}
          <div>
            <p className="text-xs font-black uppercase mb-2" style={{ color: "#6b6b80", letterSpacing: "1px" }}>
              Solution Steps
            </p>
            <div className="flex flex-col gap-2">
              {steps.map((step, i) => (
                <div
                  key={i}
                  className="rounded-xl p-3"
                  style={{ background: "#0d0d1a", border: "1px solid #2a2a40" }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-base">{step.icon}</span>
                    <span className="text-xs font-black uppercase" style={{ color: "#afafbf", letterSpacing: "1px", fontSize: "10px" }}>
                      {step.label}
                    </span>
                  </div>
                  <MathText
                    text={step.prompt}
                    className="text-sm font-semibold leading-snug"
                    style={{ color: "#e5e5e5" }}
                  />
                  <StepPreview step={step} />
                  {step.tip && (
                    <p className="text-xs mt-2 italic" style={{ color: "#ffc800" }}>
                      Tip: {step.tip}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Status actions */}
          <div className="flex gap-2 pt-2">
            {problem.status !== "published" && (
              <button
                onClick={() => onStatusChange(problem.id, "published")}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase"
                style={{
                  background: "#1cb0f6",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  letterSpacing: "1px",
                }}
              >
                Publish
              </button>
            )}
            {problem.status === "draft" && (
              <button
                onClick={() => onStatusChange(problem.id, "approved")}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase"
                style={{
                  background: "#34d399",
                  color: "#0d0d1a",
                  border: "none",
                  cursor: "pointer",
                  letterSpacing: "1px",
                }}
              >
                Approve
              </button>
            )}
            {problem.status !== "rejected" && problem.status !== "published" && (
              <button
                onClick={() => onStatusChange(problem.id, "rejected")}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase"
                style={{
                  background: "transparent",
                  color: "#ff4b4b",
                  border: "2px solid #ff4b4b",
                  cursor: "pointer",
                  letterSpacing: "1px",
                }}
              >
                Reject
              </button>
            )}
            {problem.status === "published" && (
              <button
                onClick={() => onStatusChange(problem.id, "draft")}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase"
                style={{
                  background: "transparent",
                  color: "#ffc800",
                  border: "2px solid #ffc800",
                  cursor: "pointer",
                  letterSpacing: "1px",
                }}
              >
                Unpublish
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
