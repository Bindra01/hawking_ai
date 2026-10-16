import { describe, expect, it } from "vitest";
import { hasMath, parseMathText } from "@/lib/math-text";

const math = (latex: string, display = false) => ({ kind: "math", latex, display });
const text = (content: string) => ({ kind: "text", content });

describe("parseMathText", () => {
  it("leaves plain prose untouched", () => {
    expect(parseMathText("The shell explodes at time T.")).toEqual([text("The shell explodes at time T.")]);
    expect(parseMathText("")).toEqual([]);
    expect(hasMath("20 m/s")).toBe(false);
  });

  it("splits \\( \\) inline math that the model emits inside prose", () => {
    expect(parseMathText("initial speed \\(u\\), total flight time \\( T \\) before explosion")).toEqual([
      text("initial speed "), math("u"), text(", total flight time "), math("T"), text(" before explosion"),
    ]);
  });

  it("splits $ $ inline math and $$ $$ or \\[ \\] display math", () => {
    expect(parseMathText("angle $\\theta$ obeys $$\\tan\\theta = \\frac{d}{2}$$ and \\[E=mc^2\\]")).toEqual([
      text("angle "), math("\\theta"), text(" obeys "), math("\\tan\\theta = \\frac{d}{2}", true), text(" and "), math("E=mc^2", true),
    ]);
  });

  it("renders bare LaTeX commands without delimiters as inline math", () => {
    expect(parseMathText("the angle \\theta to fire the shell")).toEqual([
      text("the angle "), math("\\theta"), text(" to fire the shell"),
    ]);
    expect(parseMathText("ratio \\frac{gT^2}{2d}, then square it")).toEqual([
      text("ratio "), math("\\frac{gT^2}{2d}"), text(", then square it"),
    ]);
    expect(parseMathText("use \\sqrt{\\frac{a}{b}} here")).toEqual([
      text("use "), math("\\sqrt{\\frac{a}{b}}"), text(" here"),
    ]);
  });

  it("keeps a bare equation together and stops at the sentence", () => {
    expect(parseMathText("\\displaystyle \\tan \\theta = \\frac{d}{2}")).toEqual([
      math("\\displaystyle \\tan \\theta = \\frac{d}{2}"),
    ]);
    expect(parseMathText("so \\theta_0 = 30^\\circ. Next")).toEqual([
      text("so "), math("\\theta_0 = 30^\\circ"), text(". Next"),
    ]);
    expect(parseMathText("(see \\theta) and \\phi, \\psi")).toEqual([
      text("(see "), math("\\theta"), text(") and "), math("\\phi"), text(", "), math("\\psi"),
    ]);
  });

  it("does not swallow English words after a bare command", () => {
    expect(parseMathText("\\theta is the angle")).toEqual([math("\\theta"), text(" is the angle")]);
    expect(parseMathText("\\theta - the launch angle")).toEqual([math("\\theta"), text(" - the launch angle")]);
  });

  it("drops empty delimited math", () => {
    expect(parseMathText("empty $ $ here")).toEqual([text("empty "), text(" here")]);
  });
});
