import type { Metadata } from "next";
import Tutor from "@/components/tutor/Tutor";
import "./tutor.css";

export const metadata: Metadata = {
  title: "Physics Studio · Hawking",
  description:
    "A live physics tutor. Listen, watch ideas take shape, and ask questions as you go.",
};
export default function TutorPage() {
  return <Tutor />;
}
