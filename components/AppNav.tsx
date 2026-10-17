"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function HomeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.8 12 3l9 7.8v9.7a.5.5 0 0 1-.5.5h-5.8v-6.6H9.3V21H3.5a.5.5 0 0 1-.5-.5v-9.7Z" /></svg>;
}

function PracticeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m2 8 10-5 10 5-10 5L2 8Zm4 3.2V16c0 1.8 2.7 3.5 6 3.5s6-1.7 6-3.5v-4.8l-6 3-6-3ZM21 10v6h1v-6h-1Z" /></svg>;
}

export default function AppNav() {
  const pathname = usePathname();
  const homeActive = pathname === "/home" || pathname.startsWith("/solve");
  const practiceActive = pathname.startsWith("/practice") || pathname.startsWith("/play");

  return (
    <nav className="app-nav" aria-label="Main navigation">
      <Link href="/home" className={homeActive ? "active" : ""} aria-current={homeActive ? "page" : undefined}>
        <HomeIcon />
        <span>Home</span>
      </Link>
      <Link href="/practice" className={practiceActive ? "active" : ""} aria-current={practiceActive ? "page" : undefined}>
        <PracticeIcon />
        <span>Practice</span>
      </Link>
    </nav>
  );
}
