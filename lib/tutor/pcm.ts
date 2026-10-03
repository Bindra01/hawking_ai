export const QUESTION_SAMPLE_RATE = 16000;
export const MAX_QUESTION_SECONDS = 60;

/** Canonical mono PCM16 WAV: the server can bound paid duration from byte count. */
export function encodeQuestionWav(
  samples: Float32Array,
): Uint8Array<ArrayBuffer> {
  if (
    !samples.length ||
    samples.length > QUESTION_SAMPLE_RATE * MAX_QUESTION_SECONDS
  )
    throw new Error("Keep voice questions under one minute.");
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const tag = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++)
      bytes[offset + i] = text.charCodeAt(i);
  };
  tag(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, QUESTION_SAMPLE_RATE, true);
  view.setUint32(28, QUESTION_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  tag(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) => {
    const value = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * 2, value < 0 ? value * 32768 : value * 32767, true);
  });
  return bytes;
}
export function questionWavDuration(bytes: Uint8Array): number {
  if (bytes.length < 44) throw new Error("Invalid audio recording.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (start: number, length: number) =>
    String.fromCharCode(...bytes.slice(start, start + length));
  if (
    tag(0, 4) !== "RIFF" ||
    tag(8, 4) !== "WAVE" ||
    tag(12, 4) !== "fmt " ||
    tag(36, 4) !== "data" ||
    view.getUint32(4, true) !== bytes.length - 8 ||
    view.getUint32(16, true) !== 16 ||
    view.getUint16(20, true) !== 1 ||
    view.getUint16(22, true) !== 1 ||
    view.getUint32(24, true) !== QUESTION_SAMPLE_RATE ||
    view.getUint32(28, true) !== QUESTION_SAMPLE_RATE * 2 ||
    view.getUint16(32, true) !== 2 ||
    view.getUint16(34, true) !== 16 ||
    view.getUint32(40, true) !== bytes.length - 44 ||
    (bytes.length - 44) % 2
  )
    throw new Error("Invalid audio recording.");
  const seconds = (bytes.length - 44) / (QUESTION_SAMPLE_RATE * 2);
  if (seconds < 0.1 || seconds > MAX_QUESTION_SECONDS)
    throw new Error("Record between 0.1 and 60 seconds.");
  return seconds;
}

export async function recordingToWav(blob: Blob): Promise<Blob> {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    if (
      !Number.isFinite(decoded.duration) ||
      decoded.duration < 0.1 ||
      decoded.duration > 61
    )
      throw new Error("Keep voice questions under one minute.");
    const frames = Math.min(
      Math.ceil(decoded.duration * QUESTION_SAMPLE_RATE),
      QUESTION_SAMPLE_RATE * MAX_QUESTION_SECONDS,
    );
    const offline = new OfflineAudioContext(1, frames, QUESTION_SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const resampled = await offline.startRendering();
    return new Blob([encodeQuestionWav(resampled.getChannelData(0))], {
      type: "audio/wav",
    });
  } finally {
    await context.close();
  }
}
