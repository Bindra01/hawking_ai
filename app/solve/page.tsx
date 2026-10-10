"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SolutionView from "@/components/SolutionView";
import type { SolveSolution } from "@/lib/solve-types";

export default function SolvePage() {
  const [solution, setSolution] = useState<SolveSolution | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const saved = sessionStorage.getItem("hawking-solution");
      if (saved) {
        try { setSolution(JSON.parse(saved) as SolveSolution); } catch { /* ignore invalid browser data */ }
      }
      setReady(true);
    });
  }, []);

  if (!ready) return <div className="solution-loading">Loading solution…</div>;
  if (!solution) return (
    <main className="solution-empty">
      <div className="solution-logo">HAWKING</div>
      <h1>No solution is open</h1>
      <p>Send a physics problem from Home to create a solution.</p>
      <Link href="/home">Go to Home</Link>
    </main>
  );

  return <SolutionView solution={solution} />;
}
