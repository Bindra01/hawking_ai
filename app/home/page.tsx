"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Problem, Attempt } from "@/lib/types";
import TopBar from "@/components/TopBar";
import ChipFilter from "@/components/ChipFilter";
import ProblemCard from "@/components/ProblemCard";
import { CLASS_FILTER_OPTIONS, SUBJECT_FILTER_OPTIONS } from "@/lib/constants";

export default function HomePage() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [subject, setSubject] = useState("");
  // DB column is "difficulty"; surfaced as "Class" in the UI.
  const [difficulty, setDifficulty] = useState("");
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Update streak on every page load
    fetch("/api/streak", { method: "POST" }).catch(() => null);

    Promise.all([
      fetch("/api/profile").then((r) => r.json()),
      fetch("/api/attempts").then((r) => r.json()),
      fetch("/api/admin/check").then((r) => r.json()),
    ]).then(([profile, attemptsData, adminCheck]) => {
      setXp(profile.total_xp ?? 0);
      setStreak(profile.current_streak ?? 0);
      setAttempts(Array.isArray(attemptsData) ? attemptsData : []);
      setIsAdmin(adminCheck?.isAdmin ?? false);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (subject) params.set("subject", subject);
    if (difficulty) params.set("difficulty", difficulty);
    const qs = params.toString();
    fetch(qs ? `/api/problems?${qs}` : "/api/problems")
      .then((r) => r.json())
      .then((data) => setProblems(Array.isArray(data) ? data : []))
      .catch(() => null);
  }, [subject, difficulty]);

  // Build a map of problem_id -> best attempt
  const bestAttempts = new Map<string, Attempt>();
  for (const a of attempts) {
    const existing = bestAttempts.get(a.problem_id);
    if (!existing || a.xp_earned > existing.xp_earned) {
      bestAttempts.set(a.problem_id, a);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "#131327" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <TopBar streak={streak} xp={xp} isAdmin={isAdmin} />

        <div className="flex flex-col gap-4 pt-4 pb-8">
          <div className="flex flex-col gap-3">
            <ChipFilter
              label="Class"
              options={CLASS_FILTER_OPTIONS}
              active={difficulty}
              onChange={setDifficulty}
            />
            <ChipFilter
              label="Subject"
              options={SUBJECT_FILTER_OPTIONS}
              active={subject}
              onChange={setSubject}
            />
          </div>

          {loading ? (
            <div className="flex flex-col gap-3 px-4 mt-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-32 rounded-2xl animate-pulse"
                  style={{ background: "#1a1a2e" }}
                />
              ))}
            </div>
          ) : problems.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-lg font-bold" style={{ color: "#6b6b80" }}>
                {subject || difficulty ? "No problems match these filters" : "No problems yet"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 mt-2">
              {problems.map((p) => (
                <ProblemCard
                  key={p.id}
                  problem={p}
                  bestAttempt={bestAttempts.get(p.id) ?? null}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
