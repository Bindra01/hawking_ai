import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ElevenSpeech } from "@/lib/tutor/ElevenSpeech";
class AudioMock {
  src = "";
  currentTime = 0;
  playbackRate = 1;
  onended?: () => void;
  onerror?: () => void;
  onplaying?: () => void;
  play = vi.fn(async () => {
    this.onplaying?.();
  });
  pause = vi.fn();
  load = vi.fn();
  removeAttribute = vi.fn();
}
let audio: AudioMock;
const payload = {
  audio_base64: "YWJj",
  alignment: {
    characters: ["a", "b", "c"],
    character_start_times_seconds: [0, 1, 2],
    character_end_times_seconds: [1, 2, 3],
  },
};
const cb = () => ({ progress: vi.fn(), end: vi.fn(), error: vi.fn() });
const settle = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};
beforeEach(() => {
  vi.useFakeTimers();
  audio = new AudioMock();
  vi.stubGlobal(
    "Audio",
    class {
      constructor() {
        return audio;
      }
    },
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => payload })),
  );
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("ElevenSpeech", () => {
  it("checkpoints exact audio time and resumes cached audio without generation", async () => {
    const driver = new ElevenSpeech();
    const callbacks = cb();
    driver.speak("abc", 0, 0.9, callbacks);
    await settle();
    audio.currentTime = 1.456;
    expect(driver.checkpoint()).toEqual({
      seconds: 1.456,
      offset: 1,
      progress: 1.456 / 3,
    });
    driver.stop();
    driver.speak("abc", 1, 1.15, callbacks, 1.456);
    await settle();
    expect(audio.currentTime).toBe(1.456);
    expect(audio.playbackRate).toBe(1.15);
    expect(fetch).toHaveBeenCalledTimes(1);
    driver.dispose();
  });
  it("prefetch deduplicates concurrent requests and stop ignores stale completion", async () => {
    let resolve!: (value: Response) => void;
    vi.mocked(fetch).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }) as Promise<Response>,
    );
    const driver = new ElevenSpeech();
    const callbacks = cb();
    driver.prefetch("abc");
    driver.speak("abc", 0, 1, callbacks);
    driver.stop();
    resolve(Response.json(payload));
    await settle();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(audio.play).not.toHaveBeenCalled();
    driver.speak("abc", 0, 1, callbacks);
    await settle();
    expect(audio.play).toHaveBeenCalledOnce();
    driver.dispose();
  });
  it("preserves parent clip across answer playback and rejects stale audio events", async () => {
    const driver = new ElevenSpeech();
    const parent = cb();
    const answer = cb();
    driver.speak("abc", 0, 1, parent);
    await settle();
    const oldEnd = audio.onended;
    driver.stop();
    driver.speak("def", 0, 1, answer);
    await settle();
    oldEnd?.();
    expect(parent.end).not.toHaveBeenCalled();
    audio.onended?.();
    expect(answer.end).toHaveBeenCalledOnce();
    driver.speak("abc", 1, 1, parent, 1.2);
    await settle();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(audio.currentTime).toBe(1.2);
    driver.dispose();
  });
  it("advances only with media time and reports blocked playback", async () => {
    const driver = new ElevenSpeech();
    const callbacks = cb();
    driver.speak("abc", 0, 1, callbacks);
    await settle();
    vi.advanceTimersByTime(200);
    expect(callbacks.progress).not.toHaveBeenCalled();
    audio.currentTime = 0.5;
    vi.advanceTimersByTime(40);
    expect(callbacks.progress).toHaveBeenLastCalledWith({
      seconds: 0.5,
      offset: 0,
      progress: 0.5 / 3,
    });
    driver.stop();
    audio.play.mockRejectedValue(new Error("blocked"));
    driver.speak("abc", 0, 1, callbacks);
    await settle();
    expect(callbacks.error).toHaveBeenCalledWith(
      expect.stringContaining("blocked"),
    );
    driver.dispose();
  });
  it("aborts outstanding work and revokes URLs on disposal", async () => {
    const driver = new ElevenSpeech();
    driver.prefetch("abc");
    await settle();
    let signal: AbortSignal | undefined;
    vi.mocked(fetch).mockImplementation((_url, init) => {
      signal = init?.signal as AbortSignal;
      return new Promise(() => {});
    });
    driver.prefetch("def");
    driver.dispose();
    expect(signal?.aborted).toBe(true);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });
  it("generates a joined lesson once and crosses beat ranges without restarting audio", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        audio_base64: "YWJj",
        alignment: {
          characters: ["a", " ", "b"],
          character_start_times_seconds: [0, 1, 1.2],
          character_end_times_seconds: [1, 1.2, 2],
        },
      }),
    );
    const driver = new ElevenSpeech();
    const first = cb();
    const second = cb();
    first.end.mockImplementation(() => driver.speak("b", 0, 1, second));
    driver.prepare(["a", "b"]);
    driver.speak("a", 0, 1, first);
    await settle();
    expect(
      JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string).text,
    ).toBe("a b");
    audio.currentTime = 1.22;
    vi.advanceTimersByTime(40);
    await settle();
    expect(first.end).toHaveBeenCalledOnce();
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(audio.currentTime).toBe(1.22);
    expect(fetch).toHaveBeenCalledOnce();
    audio.currentTime = 1.7;
    expect(driver.checkpoint()?.seconds).toBeCloseTo(0.5);
    driver.stop();
    driver.speak("b", 0, 0.75, second, 0.5);
    await settle();
    expect(audio.currentTime).toBe(1.7);
    expect(fetch).toHaveBeenCalledOnce();
    driver.dispose();
  });
  it("distinguishes duplicate microbeats and parent/answer narration by lesson identity", async () => {
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      const text = JSON.parse(init?.body as string).text as string;
      return Response.json({
        audio_base64: "YWJj",
        alignment: {
          characters: [...text],
          character_start_times_seconds: [...text].map((_, i) => i),
          character_end_times_seconds: [...text].map((_, i) => i + 1),
        },
      });
    });
    const driver = new ElevenSpeech();
    const lesson = {};
    const answer = {};
    const callbacks = cb();
    driver.prepare(["a", "a"], lesson);
    driver.prepare(["b", "a"], answer);
    await settle();
    driver.speak("a", 0, 1, callbacks, undefined, { key: lesson, beat: 0 });
    await settle();
    expect(audio.currentTime).toBe(0);
    driver.speak("a", 0, 1, callbacks, 0.4, { key: lesson, beat: 1 });
    await settle();
    expect(audio.currentTime).toBe(2.4);
    driver.speak("a", 0, 1, callbacks, 0.5, { key: answer, beat: 1 });
    await settle();
    expect(audio.currentTime).toBe(2.5);
    expect(fetch).toHaveBeenCalledTimes(2);
    driver.dispose();
  });
  it("does not cache a response that arrives after clearCache", async () => {
    let resolve!: (value: Response) => void;
    vi.mocked(fetch).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const driver = new ElevenSpeech();
    driver.prefetch("abc");
    driver.clearCache();
    resolve(Response.json(payload));
    await settle();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it("bounds cache and provides stall recovery", async () => {
    const driver = new ElevenSpeech();
    for (let i = 0; i < 66; i++) {
      driver.prefetch(`abc${i}`);
      await settle();
    }
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    const callbacks = cb();
    driver.speak("abc65", 0, 1, callbacks);
    await settle();
    vi.advanceTimersByTime(20_080);
    expect(callbacks.error).toHaveBeenCalledWith(
      expect.stringContaining("stalled"),
    );
    driver.dispose();
  });
});
