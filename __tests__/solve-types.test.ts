import { describe, expect, it } from "vitest";
import { highPriority, type PriorityItem } from "@/lib/solve-types";

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
});
