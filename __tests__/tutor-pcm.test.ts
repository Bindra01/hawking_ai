import { describe, expect, it } from "vitest";
import { encodeQuestionWav, questionWavDuration } from "@/lib/tutor/pcm";

describe("bounded voice question WAV", () => {
  it("encodes canonical mono PCM16 with measurable duration", () => {
    expect(
      questionWavDuration(encodeQuestionWav(new Float32Array(16000))),
    ).toBe(1);
    expect(
      questionWavDuration(encodeQuestionWav(new Float32Array(16000 * 60))),
    ).toBe(60);
  });
  it("rejects too-long, silent-empty, compressed and deceptive headers", () => {
    expect(() => encodeQuestionWav(new Float32Array(16000 * 60 + 1))).toThrow();
    expect(() => questionWavDuration(new Uint8Array(400))).toThrow();
    const wav = encodeQuestionWav(new Float32Array(16000));
    const shortHeader = wav.slice();
    new DataView(shortHeader.buffer).setUint32(40, 10, true);
    expect(() => questionWavDuration(shortHeader)).toThrow();
    const lowRate = wav.slice();
    new DataView(lowRate.buffer).setUint32(24, 100, true);
    expect(() => questionWavDuration(lowRate)).toThrow();
    const compressed = wav.slice();
    new DataView(compressed.buffer).setUint16(20, 3, true);
    expect(() => questionWavDuration(compressed)).toThrow();
    const long = new Uint8Array(44 + 16000 * 2 * 61);
    long.set(wav.slice(0, 44));
    const view = new DataView(long.buffer);
    view.setUint32(4, long.length - 8, true);
    view.setUint32(40, long.length - 44, true);
    expect(() => questionWavDuration(long)).toThrow(/60 seconds/);
  });
});
