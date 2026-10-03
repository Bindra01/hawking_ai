import { describe, expect, it } from "vitest";
import { boardFrame } from "@/lib/tutor/board";
import { TEACHING_EXAMPLE } from "@/lib/tutor/teaching-example";
import { prepareLesson } from "@/lib/tutor/validate";
import type { Lesson, Visual } from "@/lib/tutor/types";

const frame = (lesson: Lesson, beat: number, progress = 0.5) =>
  boardFrame({ lesson, position: { beat, progress, offset: 0 } });
const fixture = (...visuals: Visual[]): Lesson => ({
  title: "Board",
  beats: visuals.map((visual) => ({
    section: "One page",
    narration: "Explain this idea.",
    visual,
  })),
});
const mark: Visual = {
  type: "write_text",
  text: "Suitcase",
  x: 60,
  y: 90,
  color: "ink",
};

describe("sparse teaching actions", () => {
  it("ships a schema-valid complete demonstration within the target budget", () => {
    const lesson = prepareLesson(TEACHING_EXAMPLE);
    expect(lesson).toEqual(TEACHING_EXAMPLE);
    expect(lesson.beats).toHaveLength(24);
    const words = lesson.beats.reduce(
      (n, b) => n + b.narration.split(/\s+/).length,
      0,
    );
    expect(words).toBeGreaterThanOrEqual(240);
    expect(words).toBeLessThanOrEqual(280);
    expect(
      lesson.beats.filter((b) => b.visual.type === "hold").length,
    ).toBeGreaterThanOrEqual(4);
    expect(
      lesson.beats.slice(0, 3).some((b) => b.visual.type === "write_equation"),
    ).toBe(false);
  });
  it("preserves complete existing ink throughout a narration-only beat", () => {
    const lesson = fixture(mark, { type: "hold" });
    expect(frame(lesson, 1, 0)).toEqual(frame(lesson, 1, 1));
    expect(frame(lesson, 1)[0].progress).toBe(1);
  });
  it("supports an initially blank explanation", () => {
    expect(frame(fixture({ type: "hold" }), 0)).toEqual([]);
  });
  it("clears immediately and does not resurrect earlier marks", () => {
    const lesson = fixture(mark, { type: "clear" }, { type: "hold" }, mark);
    expect(frame(lesson, 1, 0)).toEqual([]);
    expect(frame(lesson, 2)).toEqual([]);
    expect(frame(lesson, 3).map((b) => b.index)).toEqual([3]);
    expect(frame(lesson, 0)).toHaveLength(1); // replay/checkpoint before clear
  });
  it("keeps emphasis temporary and restores it at the saved checkpoint", () => {
    const highlight: Visual = {
      type: "highlight",
      x: 100,
      y: 100,
      radius: 30,
      color: "amber",
    };
    const lesson = fixture(mark, highlight, { type: "hold" });
    expect(frame(lesson, 1).map((b) => b.beat.visual)).toEqual([
      mark,
      highlight,
    ]);
    expect(frame(lesson, 2).map((b) => b.beat.visual)).toEqual([mark]);
    expect(frame(lesson, 1)).toHaveLength(2);
  });
  it("clears at section transitions, even when the next beat only speaks", () => {
    const lesson = fixture(mark, { type: "hold" });
    lesson.beats[1].section = "Next idea";
    expect(frame(lesson, 1)).toEqual([]);
  });
  it.each(["= F", "× d", "× cos θ"])(
    "keeps natural equation increment %s as one spoken beat",
    (text) => {
      const lesson = structuredClone(TEACHING_EXAMPLE);
      lesson.beats[7].visual = { ...mark, type: "write_equation", text };
      expect(prepareLesson(lesson).beats[7]).toEqual(lesson.beats[7]);
    },
  );
  it("rejects malformed emphasis before rendering", () => {
    const lesson = structuredClone(TEACHING_EXAMPLE);
    lesson.beats[0].visual = {
      type: "highlight",
      x: 35,
      y: 45,
      radius: 80,
      color: "ink",
    };
    expect(() => prepareLesson(lesson)).toThrow(/bounds/);
  });
  it("validates the new action types through preparation", () => {
    const lesson = structuredClone(TEACHING_EXAMPLE);
    lesson.beats[0].visual = { type: "clear" };
    expect(prepareLesson(lesson).beats[0].visual).toEqual({ type: "clear" });
  });
});
