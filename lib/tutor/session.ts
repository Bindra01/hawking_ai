import type { Lesson, Thread, TutorStatus } from "./types";
import type { SpeechDriver } from "./speech";

export type SessionSnapshot = {
  active: Thread | null;
  stack: Thread[];
  status: TutorStatus;
  rate: number;
  error: string;
};
const initial = (): SessionSnapshot => ({
  active: null,
  stack: [],
  status: "ready",
  rate: 0.9,
  error: "",
});
const thread = (lesson: Lesson): Thread => ({
  lesson,
  position: { beat: 0, offset: 0, progress: 0 },
});
export class TutorSession {
  private state = initial();
  private listeners = new Set<() => void>();
  private generation = 0;
  private autoPlay = true;
  constructor(private speech: SpeechDriver) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<SessionSnapshot>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private stop() {
    this.generation++;
    this.speech.stop();
  }
  load(lesson: Lesson) {
    this.autoPlay = true;
    this.stop();
    this.update({
      active: thread(lesson),
      stack: [],
      status: "ready",
      error: "",
    });
  }
  reset() {
    this.autoPlay = true;
    this.stop();
    this.update({ ...initial(), rate: this.state.rate });
  }
  dispose() {
    this.stop();
  }
  setRate(rate: number) {
    if (![0.75, 0.9, 1, 1.15].includes(rate)) return;
    const playing = ["playing", "answering"].includes(this.state.status);
    if (playing) this.pause();
    this.update({ rate });
    if (playing) this.play();
  }
  play() {
    const active = this.state.active;
    if (
      !active ||
      ["generating_answer", "paused_for_question", "done"].includes(
        this.state.status,
      )
    )
      return;
    this.autoPlay = true;
    this.stop();
    this.update({
      status: this.state.stack.length ? "answering" : "playing",
      error: "",
    });
    this.speakBeat();
  }
  pause() {
    this.autoPlay = false;
    if (!["playing", "answering"].includes(this.state.status)) return;
    this.stop();
    this.update({ status: "paused" });
  }
  beginQuestion() {
    if (
      !this.state.active ||
      ["paused_for_question", "generating_answer", "done"].includes(
        this.state.status,
      )
    )
      return;
    this.stop();
    this.update({
      stack: [...this.state.stack, this.state.active],
      status: "paused_for_question",
      error: "",
    });
  }
  generatingAnswer() {
    if (this.state.status === "paused_for_question") {
      this.autoPlay = true;
      this.update({ status: "generating_answer", error: "" });
    }
  }
  answer(lesson: Lesson) {
    if (this.state.status !== "generating_answer") return;
    this.update({ active: thread(lesson), status: "paused" });
    if (this.autoPlay) this.play();
  }
  answerFailed(message: string) {
    this.update({ status: "paused_for_question", error: message });
  }
  returnToLesson() {
    const saved = this.state.stack.at(-1);
    if (!saved) return;
    this.stop();
    this.update({
      active: saved,
      stack: this.state.stack.slice(0, -1),
      status: "paused",
      error: "",
    });
    if (this.autoPlay) this.play();
  }
  private speakBeat() {
    const active = this.state.active;
    if (!active) return;
    const beat = active.lesson.beats[active.position.beat];
    if (!beat) {
      if (this.state.stack.length) this.returnToLesson();
      else this.update({ status: "done" });
      return;
    }
    const generation = this.generation;
    this.speech.speak(beat.narration, active.position.offset, this.state.rate, {
      progress: (checkpoint) => {
        if (generation !== this.generation) return;
        this.update({
          active: {
            ...active,
            position: {
              ...active.position,
              offset: checkpoint.offset,
              progress: Math.max(active.position.progress, checkpoint.progress),
            },
          },
        });
      },
      end: () => {
        if (generation !== this.generation) return;
        this.update({
          active: {
            ...active,
            position: {
              beat: active.position.beat + 1,
              offset: 0,
              progress: 0,
            },
          },
        });
        this.speakBeat();
      },
      error: (message) => {
        if (generation !== this.generation) return;
        this.update({ status: "error", error: message });
      },
    });
  }
}
