import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: "Hawking — Think Through Physics",
  description: "Duolingo for physics problem-solving strategy.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={nunito.variable}>
      <body className="min-h-screen" style={{ background: "#131327", fontFamily: "Nunito, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
