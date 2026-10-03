import type { Thread } from "./types";

/** Derive ink from the checkpoint, so pause, seek and answer return agree. */
export function boardFrame(thread: Thread) {
  const { beats } = thread.lesson;
  const current = Math.min(thread.position.beat, beats.length - 1);
  let start = current;
  while (start > 0 && beats[start - 1].section === beats[current].section)
    start--;
  for (let i = start; i <= current; i++) {
    if (beats[i].visual.type === "clear") start = i + 1;
  }
  return beats.slice(start, current + 1).flatMap((beat, offset) => {
    const index = start + offset;
    const type = beat.visual.type;
    if (
      type === "hold" ||
      type === "clear" ||
      (type === "highlight" && index !== current)
    )
      return [];
    return [
      { beat, index, progress: index < current ? 1 : thread.position.progress },
    ];
  });
}
