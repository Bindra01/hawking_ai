"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import Link from "next/link";

interface ProfileStats {
  total_xp: number;
  current_streak: number;
  problems_solved: number;
  subject_counts: Record<string, number>;
  name?: string;
  avatar_url?: string;
  email?: string;
}

const SUBJECT_LABELS: Record<string, string> = {
  mechanics: "Mechanics",
  electrodynamics: "Electrodynamics",
  thermodynamics: "Thermo",
  quantum_mechanics: "Quantum",
};

const SUBJECT_COLORS: Record<string, string> = {
  mechanics: "#7c3aed",
  electrodynamics: "#1cb0f6",
  thermodynamics: "#ff9600",
  quantum_mechanics: "#ce82ff",
};

export default function ProfilePage() {
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => {
        if (!r.ok) throw new Error("Unauthorized");
        return r.json();
      })
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const maxCount = stats
    ? Math.max(...Object.values(stats.subject_counts), 1)
    : 1;

  return (
    <div className="min-h-screen" style={{ background: "#131327" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }} className="flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4" style={{ borderBottom: "2px solid #2a2a40" }}>
          <Link href="/home" className="text-xl" style={{ color: "#afafbf" }}>←</Link>
          <h1 className="font-black text-lg" style={{ color: "#e5e5e5" }}>Profile</h1>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-4 px-4 py-12">
            <div className="w-20 h-20 rounded-full animate-pulse" style={{ background: "#1a1a2e" }} />
            <div className="w-40 h-5 rounded animate-pulse" style={{ background: "#1a1a2e" }} />
          </div>
        ) : stats ? (
          <div className="flex flex-col gap-6 px-4 py-6">
            {/* Avatar + name */}
            <div className="flex flex-col items-center gap-3">
              {stats.avatar_url ? (
                <img
                  src={stats.avatar_url}
                  alt="Avatar"
                  className="w-20 h-20 rounded-full"
                  style={{ border: "3px solid #2a2a40" }}
                />
              ) : (
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
                  style={{ background: "#1a1a2e", border: "3px solid #2a2a40" }}
                >
                  👤
                </div>
              )}
              <div className="text-center">
                <p className="font-black text-xl" style={{ color: "#e5e5e5" }}>
                  {stats.name ?? "Physicist"}
                </p>
                <p className="text-sm" style={{ color: "#6b6b80" }}>{stats.email}</p>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Total XP", value: stats.total_xp, icon: "⚡", color: "#ffc800" },
                { label: "Streak", value: stats.current_streak, icon: "🔥", color: "#ff9600" },
                { label: "Solved", value: stats.problems_solved, icon: "✅", color: "#7c3aed" },
              ].map(({ label, value, icon, color }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-1 p-4 rounded-2xl"
                  style={{ background: "#1a1a2e", border: "2px solid #2a2a40" }}
                >
                  <span className="text-2xl">{icon}</span>
                  <span className="text-2xl font-black" style={{ color }}>
                    {value}
                  </span>
                  <span className="text-xs font-bold uppercase" style={{ color: "#6b6b80", letterSpacing: "0.8px", fontSize: "10px" }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Subject breakdown */}
            <div
              className="rounded-2xl p-4 flex flex-col gap-4"
              style={{ background: "#1a1a2e", border: "2px solid #2a2a40" }}
            >
              <p className="text-xs font-black uppercase" style={{ color: "#6b6b80", letterSpacing: "1.5px" }}>
                Subject Breakdown
              </p>
              {Object.entries(SUBJECT_LABELS).map(([key, label]) => {
                const count = stats.subject_counts[key] ?? 0;
                const pct = (count / maxCount) * 100;
                return (
                  <div key={key} className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold" style={{ color: "#e5e5e5" }}>{label}</span>
                      <span className="text-sm font-black" style={{ color: SUBJECT_COLORS[key] }}>
                        {count}
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "#2a2a40" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: SUBJECT_COLORS[key],
                          transition: "width 0.6s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              className="btn-press w-full py-4 rounded-2xl font-black text-sm uppercase"
              style={{
                background: "#1a1a2e",
                color: "#ff4b4b",
                border: "2px solid #ff4b4b",
                boxShadow: "0 5px 0 #330a0a",
                letterSpacing: "1.5px",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Sign Out
            </button>
          </div>
        ) : (
          <p className="text-center py-12" style={{ color: "#6b6b80" }}>
            Failed to load profile
          </p>
        )}
      </div>
    </div>
  );
}
