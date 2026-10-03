import { describe, expect, it } from "vitest";
import { TutorSession } from "@/lib/tutor/session";
import type { SpeechDriver } from "@/lib/tutor/speech";
import type { Lesson } from "@/lib/tutor/types";
class FakeSpeech implements SpeechDriver {
  calls: {
    text: string;
    offset: number;
    rate: number;
    seconds?: number;
    callbacks: Parameters<SpeechDriver["speak"]>[3];
  }[] = [];
  stopped = 0;
  speak(
    text: string,
    offset: number,
    rate: number,
    callbacks: Parameters<SpeechDriver["speak"]>[3],
    seconds?: number,
  ) {
    this.calls.push({ text, offset, rate, callbacks, seconds });
  }
  stop() {
    this.stopped++;
  }
  get latest() {
    return this.calls.at(-1)!;
  }
}
const lesson = (title = "Work"): Lesson => ({
  title,
  beats: ["Push a box along a floor.", "Work transfers energy."].map(
    (narration) => ({
      narration,
      section: "Intuition",
      visual: {
        type: "write_text",
        text: narration,
        x: 40,
        y: 70,
        color: "ink",
      },
    }),
  ),
});
function setup() {
  const speech = new FakeSpeech();
  const session = new TutorSession(speech);
  session.load(lesson());
  session.play();
  return { speech, session };
}
describe("tutor session", () => {
  it("captures the exact audio time synchronously at interruption and restores it", () => {
    const { session, speech } = setup();
    const driver = speech as FakeSpeech & {
      checkpoint: SpeechDriver["checkpoint"];
    };
    driver.checkpoint = () => ({ seconds: 1.234, offset: 4, progress: 0.25 });
    session.beginQuestion();
    driver.checkpoint = () => undefined;
    expect(session.getSnapshot().stack[0].position.seconds).toBe(1.234);
    session.generatingAnswer();
    session.answer(lesson("Answer"));
    speech.latest.callbacks.end();
    speech.latest.callbacks.end();
    expect(speech.latest.seconds).toBe(1.234);
  });
  it("resumes a saved mid-beat checkpoint after the answer without replaying old beats", () => {
    const { speech, session } = setup();
    speech.latest.callbacks.end();
    speech.latest.callbacks.progress({ offset: 5, progress: 0.3 });
    session.beginQuestion();
    expect(session.getSnapshot().status).toBe("paused_for_question");
    const saved = session.getSnapshot().stack[0];
    session.generatingAnswer();
    session.answer(lesson("Answer"));
    speech.latest.callbacks.end();
    speech.latest.callbacks.end();
    expect(session.getSnapshot().active?.lesson.title).toBe("Work");
    expect(session.getSnapshot().active?.position).toEqual(saved.position);
    expect(speech.latest.offset).toBe(5);
    expect(speech.latest.text).toBe("Work transfers energy.");
    expect(session.getSnapshot().stack).toHaveLength(0);
  });
  it("ignores callbacks from canceled speech during an interruption", () => {
    const { speech, session } = setup();
    const stale = speech.latest.callbacks;
    session.beginQuestion();
    stale.progress({ offset: 20, progress: 0.9 });
    stale.end();
    expect(session.getSnapshot().active?.position.beat).toBe(0);
    expect(session.getSnapshot().active?.position.progress).toBe(0);
  });
  it("freezes and resumes ordinary pause and rate change", () => {
    const { speech, session } = setup();
    speech.latest.callbacks.progress({ offset: 5, progress: 0.2 });
    session.pause();
    session.setRate(0.75);
    session.play();
    expect(speech.latest.offset).toBe(5);
    expect(speech.latest.rate).toBe(0.75);
  });
  it("can retry failed answers or cancel without losing the checkpoint", () => {
    const { session, speech } = setup();
    speech.latest.callbacks.progress({ offset: 7, progress: 0.4 });
    session.beginQuestion();
    session.generatingAnswer();
    session.answerFailed("Failed");
    expect(session.getSnapshot().status).toBe("paused_for_question");
    session.returnToLesson();
    expect(speech.latest.offset).toBe(7);
    expect(session.getSnapshot().error).toBe("");
  });
  it("supports nested interruption and rejects stale answer after reset", () => {
    const { session } = setup();
    session.beginQuestion();
    session.generatingAnswer();
    session.answer(lesson("Answer"));
    session.beginQuestion();
    expect(session.getSnapshot().stack).toHaveLength(2);
    session.reset();
    session.answer(lesson("Late answer"));
    expect(session.getSnapshot().active).toBeNull();
  });
  it("completes and can load a new session", () => {
    const { session, speech } = setup();
    speech.latest.callbacks.end();
    speech.latest.callbacks.end();
    expect(session.getSnapshot().status).toBe("done");
    session.load(lesson("Energy"));
    expect(session.getSnapshot().status).toBe("ready");
    expect(session.getSnapshot().active?.position.beat).toBe(0);
  });
  it("keeps an arriving answer paused after the tab is hidden", () => {
    const { session, speech } = setup();
    session.beginQuestion();
    session.generatingAnswer();
    session.pause();
    const count = speech.calls.length;
    session.answer(lesson("Answer"));
    expect(session.getSnapshot().status).toBe("paused");
    expect(speech.calls).toHaveLength(count);
    session.play();
    expect(session.getSnapshot().status).toBe("answering");
  });
  it("returns through nested answers to the original checkpoint", () => {
    const { session, speech } = setup();
    speech.latest.callbacks.progress({ offset: 8, progress: 0.4 });
    session.beginQuestion();
    session.generatingAnswer();
    session.answer(lesson("First answer"));
    speech.latest.callbacks.progress({ offset: 3, progress: 0.1 });
    session.beginQuestion();
    session.generatingAnswer();
    session.answer(lesson("Follow-up"));
    speech.latest.callbacks.end();
    speech.latest.callbacks.end();
    expect(session.getSnapshot().active?.lesson.title).toBe("First answer");
    expect(speech.latest.offset).toBe(3);
    speech.latest.callbacks.end();
    speech.latest.callbacks.end();
    expect(session.getSnapshot().active?.lesson.title).toBe("Work");
    expect(speech.latest.offset).toBe(8);
  });
});
