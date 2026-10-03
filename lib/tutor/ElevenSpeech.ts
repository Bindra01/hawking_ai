import type { SpeechCheckpoint, SpeechDriver } from "./speech";

type Checkpoint = SpeechCheckpoint & { seconds: number };
type Clip = {
  url: string;
  bytes: number;
  starts: number[];
  ends: number[];
  offsets: number[];
};
type Range = { fullText: string; start: number; end: number };
type Pending = { controller: AbortController; promise: Promise<Clip> };

/** Timestamped audio, retained across pauses/questions. No provider key reaches the browser. */
export class ElevenSpeech implements SpeechDriver {
  private audio?: HTMLAudioElement;
  private clips = new Map<string, Clip>();
  private pending = new Map<string, Pending>();
  private bytes = 0;
  private ranges = new Map<string, Range>();
  private groups = new WeakMap<object, Range[]>();
  private token = 0;
  private active?: {
    text: string;
    clip: Clip;
    from: number;
    to: number;
    charStart: number;
  };
  private timer?: ReturnType<typeof setInterval>;
  private watchdog?: ReturnType<typeof setTimeout>;

  private player() {
    return (this.audio ??= new Audio());
  }
  /** Call synchronously from the user's Play/Send gesture (important on mobile). */
  unlock() {
    const audio = this.player();
    if (audio.src) return;
    // One silent PCM sample: this unlocks the same element later used for narration.
    audio.src =
      "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQIAAACAgA==";
    void audio.play().catch(() => {});
  }
  checkpoint(): Checkpoint | undefined {
    if (!this.active || !this.audio) return;
    const { text, clip, from, charStart } = this.active;
    const seconds = this.audio.currentTime;
    let index = 0;
    while (index < clip.ends.length && clip.ends[index] <= seconds) index++;
    const start = clip.starts[index] ?? clip.ends.at(-1) ?? 0;
    const end = clip.ends[index] ?? start;
    const offset = Math.max(
      0,
      Math.min(
        text.length,
        (clip.offsets[index] ?? text.length + charStart) - charStart,
      ),
    );
    const next = Math.max(
      0,
      Math.min(
        text.length,
        (clip.offsets[index + 1] ?? text.length + charStart) - charStart,
      ),
    );
    const fraction =
      end > start
        ? Math.max(0, Math.min(1, (seconds - start) / (end - start)))
        : 0;
    return {
      seconds: Math.max(0, seconds - from),
      offset,
      progress: Math.min(
        0.999,
        (offset + fraction * (next - offset)) / text.length,
      ),
    };
  }
  stop() {
    this.token++;
    clearInterval(this.timer);
    clearTimeout(this.watchdog);
    if (this.audio) {
      this.audio.onended = this.audio.onerror = this.audio.onplaying = null;
      this.audio.pause();
    }
    this.active = undefined;
    // Keep bounded in-flight generation: rapid pause/resume reuses the SAME request.
    // clearCache/dispose abort it when its lesson is discarded.
  }
  clearCache() {
    this.stop();
    for (const item of this.pending.values()) item.controller.abort();
    this.pending.clear();
    this.ranges.clear();
    this.groups = new WeakMap();
    for (const clip of this.clips.values()) URL.revokeObjectURL(clip.url);
    this.clips.clear();
    this.bytes = 0;
    if (this.audio) {
      this.audio.removeAttribute("src");
      this.audio.load();
    }
  }
  dispose() {
    this.clearCache();
  }
  /** One natural, continuous utterance per lesson/answer; retain parent registrations. */
  prepare(narrations: string[], key?: object) {
    const fullText = narrations.join(" ");
    let start = 0;
    const ranges: Range[] = [];
    for (const text of narrations) {
      const range = { fullText, start, end: start + text.length };
      this.ranges.set(text, range);
      ranges.push(range);
      start += text.length + 1;
    }
    if (key) this.groups.set(key, ranges);
    // Bound registrations as well as audio across long chains of questions.
    while (this.ranges.size > 512)
      this.ranges.delete(this.ranges.keys().next().value!);
    this.prefetch(fullText);
  }
  /** Warm a registered lesson (deduplicated), or an individual narration. */
  prefetch(text: string) {
    if (this.pending.size >= 2) return;
    void this.clip(this.ranges.get(text)?.fullText ?? text).catch(() => {});
  }
  private clip(text: string): Promise<Clip> {
    const cached = this.clips.get(text);
    if (cached) {
      this.clips.delete(text);
      this.clips.set(text, cached);
      return Promise.resolve(cached);
    }
    const existing = this.pending.get(text);
    if (existing) return existing.promise;
    const controller = new AbortController();
    const promise = (async () => {
      const response = await fetch("/api/tutor/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Narration is unavailable. Please try again.",
        );
      if (controller.signal.aborted) throw new Error("Cancelled");
      const a = data.alignment;
      if (
        !a ||
        !Array.isArray(a.characters) ||
        !a.characters.length ||
        typeof data.audio_base64 !== "string"
      )
        throw new Error("Narration returned invalid audio. Please try again.");
      // Original alignment is preferred to normalized text so UTF-16 offsets stay correct.
      let offset = 0;
      const offsets = a.characters.map((character: string) => {
        const value = offset;
        offset += character.length;
        return value;
      });
      const raw = atob(data.audio_base64);
      const blob = new Blob(
        [Uint8Array.from(raw, (character) => character.charCodeAt(0))],
        { type: "audio/mpeg" },
      );
      const clip: Clip = {
        url: URL.createObjectURL(blob),
        bytes: blob.size,
        starts: a.character_start_times_seconds,
        ends: a.character_end_times_seconds,
        offsets,
      };
      this.clips.set(text, clip);
      this.bytes += clip.bytes;
      // LRU bound: enough for a typical lesson plus follow-up answers.
      while (this.clips.size > 64 || this.bytes > 12_000_000) {
        const oldest = [...this.clips.keys()].find(
          (key) => key !== text && this.clips.get(key) !== this.active?.clip,
        );
        if (!oldest) break;
        const old = this.clips.get(oldest)!;
        this.clips.delete(oldest);
        this.bytes -= old.bytes;
        URL.revokeObjectURL(old.url);
      }
      return clip;
    })().finally(() => {
      if (this.pending.get(text)?.controller === controller)
        this.pending.delete(text);
    });
    this.pending.set(text, { controller, promise });
    return promise;
  }
  speak(
    text: string,
    offset: number,
    rate: number,
    callbacks: Parameters<SpeechDriver["speak"]>[3],
    seconds?: number,
    identity?: { key: object; beat: number },
  ) {
    const range = (identity
      ? this.groups.get(identity.key)?.[identity.beat]
      : undefined) ??
      this.ranges.get(text) ?? { fullText: text, start: 0, end: text.length };
    const cached = this.clips.get(range.fullText);
    const previous = this.active;
    const canContinue =
      previous &&
      cached === previous.clip &&
      !seconds &&
      !offset &&
      Math.abs((this.audio?.currentTime ?? 0) - previous.to) < 0.25;
    if (canContinue) {
      this.token++;
      clearInterval(this.timer);
      clearTimeout(this.watchdog);
    } else this.stop();
    const token = this.token;
    const fail = (message: string) => {
      if (token !== this.token) return;
      const checkpoint = this.checkpoint();
      if (checkpoint) callbacks.progress(checkpoint);
      this.stop();
      callbacks.error(message);
    };
    void this.clip(range.fullText)
      .then(async (clip) => {
        if (token !== this.token) return;
        const audio = this.player();
        const first = Math.max(
          0,
          clip.offsets.findIndex((value) => value >= range.start),
        );
        const after = clip.offsets.findIndex((value) => value >= range.end + 1);
        const from = clip.starts[first] ?? 0;
        const to = after >= 0 ? clip.starts[after] : (clip.ends.at(-1) ?? 0);
        this.active = { text, clip, from, to, charStart: range.start };
        const continueHere = canContinue && Math.abs(from - previous.to) < 0.1;
        if (!continueHere) {
          audio.src = clip.url;
          const offsetIndex = clip.offsets.findIndex(
            (value) => value >= range.start + offset,
          );
          const start =
            seconds === undefined
              ? (clip.starts[Math.max(0, offsetIndex)] ?? from)
              : from + seconds;
          audio.currentTime = Math.max(from, Math.min(to, start));
        }
        audio.playbackRate = rate;
        audio.onplaying = () => {
          if (token !== this.token) return;
          clearTimeout(this.watchdog);
        };
        let finished = false;
        const finish = () => {
          if (token !== this.token || finished) return;
          finished = true;
          clearInterval(this.timer);
          clearTimeout(this.watchdog);
          callbacks.progress({
            offset: text.length,
            progress: 1,
            seconds: to - from,
          } as Checkpoint);
          callbacks.end();
          // Next beat starts synchronously; if there is no continuation, silence the clip.
          if (token === this.token) {
            audio.pause();
            this.active = undefined;
          }
        };
        audio.onended = finish;
        audio.onerror = () =>
          fail("Narration could not play. Press Resume to retry.");
        let lastTime = audio.currentTime;
        let lastMovement = Date.now();
        this.timer = setInterval(() => {
          if (token !== this.token) return;
          if (audio.currentTime >= to) {
            finish();
            return;
          }
          const checkpoint = this.checkpoint();
          if (!checkpoint) return;
          if (audio.currentTime !== lastTime) {
            lastTime = audio.currentTime;
            lastMovement = Date.now();
            callbacks.progress(checkpoint);
          } else if (Date.now() - lastMovement > 20_000)
            fail("Narration stalled. Press Resume to continue.");
        }, 40);
        if (!continueHere) {
          this.watchdog = setTimeout(
            () =>
              fail("Narration did not start. Press Resume to enable audio."),
            10_000,
          );
          try {
            await audio.play();
          } catch {
            fail(
              "Your browser blocked narration. Press Resume to enable audio.",
            );
          }
        }
      })
      .catch((error: unknown) =>
        fail(
          error instanceof Error
            ? error.message
            : "Narration is unavailable. Please try again.",
        ),
      );
  }
}
