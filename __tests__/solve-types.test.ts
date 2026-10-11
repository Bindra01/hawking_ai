import { describe, expect, it } from "vitest";
import { highPriority, showCallout, type PriorityItem } from "@/lib/solve-types";

describe("highPriority", () => {
  it("keeps only high-priority items and applies the format limit", () => {
    const items: PriorityItem[] = [
      { text: "low first", priority: "low" },
      { text: "high one", priority: "high" },
      { text: "high two", priority: "high" },
      { text: "high three", priority: "high" },
    ];

    expect(highPriority(items, 2).map((item) => item.text)).toEqual([
      "high one",
      "high two",
    ]);
  });

  it("does not fill short sections with low-priority items", () => {
    const items: PriorityItem[] = [
      { text: "high one", priority: "high" },
      { text: "fallback one", priority: "low" },
      { text: "fallback two", priority: "low" },
    ];

    expect(highPriority(items, 2).map((item) => item.text)).toEqual(["high one"]);
  });
});

describe("showCallout", () => {
  it("keeps every high-priority callout in Short regardless of its step", () => {
    expect(showCallout({ text: "High-priority warning", priority: "high" }, "short")).toBe(true);
  });

  it("filters low-priority callouts from Short and retains them in Long", () => {
    const callout = { text: "Low-priority tip", priority: "low" } as const;
    expect(showCallout(callout, "short")).toBe(false);
    expect(showCallout(callout, "long")).toBe(true);
  });
});
