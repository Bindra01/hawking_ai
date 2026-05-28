"use client";

import Link from "next/link";

interface TopBarProps {
  streak: number;
  xp: number;
}

export default function TopBar({ streak, xp }: TopBarProps) {
  return (
    <div
      className="sticky top-0 z-50 flex items-center justify-between px-4 py-3"
      style={{
        background: "#131327",
        borderBottom: "2px solid #2a2a40",
        maxWidth: 480,
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* Streak */}
      <div className="flex items-center gap-1.5">
        <span className="text-xl">🔥</span>
        <span className="font-black text-base" style={{ color: "#ff9600" }}>
          {streak}
        </span>
      </div>

      {/* XP */}
      <div className="flex items-center gap-1.5">
        <span className="text-xl">⚡</span>
        <span className="font-black text-base" style={{ color: "#ffc800" }}>
          {xp} XP
        </span>
      </div>

      {/* Profile */}
      <Link href="/profile">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: "#2a2a40", border: "2px solid #37374a" }}
        >
          <span className="text-lg">👤</span>
        </div>
      </Link>
    </div>
  );
}
