export type SpeechCheckpoint = { offset: number; progress: number };
export interface SpeechDriver {
  speak(text: string, offset: number, rate: number, callbacks: {
    progress: (checkpoint: SpeechCheckpoint) => void;
    end: () => void;
    error: (message: string) => void;
  }): void;
  stop(): void;
}

/** Replace this adapter to use timestamped audio without changing session state. */
export class BrowserSpeech implements SpeechDriver {
  private token = 0;
  private timer?: ReturnType<typeof setInterval>;
  private watchdog?: ReturnType<typeof setTimeout>;
  stop() {
    this.token++;
    clearInterval(this.timer);
    clearTimeout(this.watchdog);
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  }
  speak(text: string, offset: number, rate: number, callbacks: Parameters<SpeechDriver["speak"]>[3]) {
    this.stop();
    const token = this.token;
    if (!window.speechSynthesis) {
      callbacks.error("This browser cannot play narration. Try Chrome, Edge, or Safari with a speech voice installed.");
      return;
    }
    const remaining = text.slice(offset).trimStart();
    const base = text.length - remaining.length;
    if (!remaining) { callbacks.end(); return; }
    const utterance = new SpeechSynthesisUtterance(remaining);
    utterance.rate = rate;
    utterance.lang = "en-US";
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find(v => v.lang.startsWith("en") && v.localService) ?? voices.find(v => v.lang.startsWith("en")) ?? null;
    let start = 0;
    let lastBoundary = 0;
    let anchor = 0;
    let lastProgress = base / text.length;
    const charsPerMs = 12 * rate / 1000;
    const emit = (index: number, spokenEnd: number) => {
      if (token !== this.token) return;
      lastProgress = Math.max(lastProgress, Math.min(.98, (base + index) / text.length));
      callbacks.progress({ offset: Math.min(text.length, base + spokenEnd), progress: lastProgress });
    };
    const wordStart = (index: number) => {
      const prefix = remaining.slice(0, index);
      return prefix.search(/\S*$/);
    };
    let hasBoundaries = false;
    this.watchdog = setTimeout(() => {
      if (token === this.token) { this.stop(); callbacks.error("Narration did not start. Check your browser voices, then press Resume."); }
    }, 8000);
    utterance.onstart = () => {
      if (token !== this.token) return;
      clearTimeout(this.watchdog);
      start = lastBoundary = performance.now();
      emit(Math.min(1, remaining.length), 0);
      this.timer = setInterval(() => {
        const now = performance.now();
        // Boundaries re-anchor this estimate. Without them, use elapsed speech time.
        const boundaryEnd = anchor + (remaining.slice(anchor).match(/^\S*\s*/)?.[0].length ?? 0);
        const ceiling = hasBoundaries ? boundaryEnd : remaining.length - 1;
        const estimate = Math.min(ceiling, anchor + (now - lastBoundary) * charsPerMs);
        const index = Math.floor(estimate);
        emit(estimate, hasBoundaries ? anchor : wordStart(index));
        if (now - start > Math.max(20000, remaining.length / charsPerMs * 3)) {
          this.stop(); callbacks.error("Narration stopped responding. Press Resume to continue.");
        }
      }, 40);
    };
    utterance.onboundary = event => {
      if (token !== this.token || event.name !== "word") return;
      hasBoundaries = true;
      anchor = event.charIndex;
      lastBoundary = performance.now();
      emit(anchor, anchor);
    };
    utterance.onend = () => {
      if (token !== this.token) return;
      clearInterval(this.timer); clearTimeout(this.watchdog);
      callbacks.progress({ offset: text.length, progress: 1 });
      callbacks.end();
    };
    utterance.onerror = event => {
      if (token !== this.token) return;
      this.stop();
      callbacks.error(event.error === "not-allowed" ? "Your browser blocked narration. Press Resume to enable audio." : "Narration is unavailable. Check your browser voice settings, then press Resume.");
    };
    window.speechSynthesis.speak(utterance);
  }
}
