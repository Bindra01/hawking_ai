import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserSpeech } from "@/lib/tutor/speech";

class Utterance {
  rate = 1;
  lang = "";
  voice = null;
  onstart?: () => void;
  onboundary?: (event: { name: string; charIndex: number }) => void;
  onend?: () => void;
  onerror?: (event: { error: string }) => void;
  constructor(public text: string) {}
}
let utterance: Utterance;
const synth = {
  cancel: vi.fn(),
  getVoices: () => [],
  speak: vi.fn((value: Utterance) => {
    utterance = value;
  }),
};
const callbacks = () => ({ progress: vi.fn(), end: vi.fn(), error: vi.fn() });
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", { speechSynthesis: synth });
  vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("browser speech timing", () => {
  it("does not draw before speech starts and reports start failures", () => {
    const speech = new BrowserSpeech();
    const cb = callbacks();
    speech.speak("A force moves a box.", 0, 0.9, cb);
    vi.advanceTimersByTime(1000);
    expect(cb.progress).not.toHaveBeenCalled();
    vi.advanceTimersByTime(7000);
    expect(cb.error).toHaveBeenCalledOnce();
    speech.stop();
  });
  it("uses word checkpoints and ignores delayed callbacks after cancellation", () => {
    const speech = new BrowserSpeech();
    const cb = callbacks();
    speech.speak("A force moves a box.", 0, 0.9, cb);
    utterance.onstart?.();
    utterance.onboundary?.({ name: "word", charIndex: 8 });
    expect(cb.progress.mock.lastCall?.[0].offset).toBe(8);
    speech.stop();
    const count = cb.progress.mock.calls.length;
    utterance.onboundary?.({ name: "word", charIndex: 14 });
    utterance.onend?.();
    vi.advanceTimersByTime(1000);
    expect(cb.progress).toHaveBeenCalledTimes(count);
    expect(cb.end).not.toHaveBeenCalled();
  });
  it("speaks only the uncompleted suffix on resume", () => {
    const speech = new BrowserSpeech();
    const cb = callbacks();
    speech.speak("A force moves a box.", 8, 0.75, cb);
    expect(utterance.text).toBe("moves a box.");
    expect(utterance.rate).toBe(0.75);
    utterance.onstart?.();
    utterance.onboundary?.({ name: "word", charIndex: 6 });
    expect(cb.progress.mock.lastCall?.[0].offset).toBe(14);
    utterance.onend?.();
    expect(cb.progress.mock.lastCall?.[0]).toEqual({ offset: 20, progress: 1 });
    expect(cb.end).toHaveBeenCalledOnce();
    speech.stop();
  });
  it("estimates drawing only after onstart when boundaries are unavailable", () => {
    const speech = new BrowserSpeech();
    const cb = callbacks();
    speech.speak("A force moves a box.", 0, 1, cb);
    utterance.onstart?.();
    vi.advanceTimersByTime(800);
    expect(cb.progress.mock.lastCall?.[0].progress).toBeGreaterThan(0);
    expect(cb.progress.mock.lastCall?.[0].progress).toBeLessThan(1);
    expect(cb.end).not.toHaveBeenCalled();
    speech.stop();
  });
  it("falls back when boundary events start and then stop", () => {
    const speech = new BrowserSpeech();
    const cb = callbacks();
    speech.speak(
      "A force moves a box along the floor while we watch it move.",
      0,
      1,
      cb,
    );
    utterance.onstart?.();
    utterance.onboundary?.({ name: "word", charIndex: 2 });
    vi.advanceTimersByTime(2400);
    expect(cb.progress.mock.lastCall?.[0].offset).toBeGreaterThan(8);
    expect(cb.progress.mock.lastCall?.[0].progress).toBeGreaterThan(0.3);
    speech.stop();
  });
});
