import { INK, type Thread, type Visual } from "@/lib/tutor/types";

function endpoint(v: Visual, progress: number) {
  if (v.type !== "draw_diagram") return { x: v.x + Math.min(v.text.length, Math.ceil(v.text.length * progress)) * (v.type === "write_equation" ? 19 : 13), y: v.y };
  if (v.shape === "circle") return { x: v.x + v.radius * Math.cos(progress * Math.PI * 2), y: v.y + v.radius * Math.sin(progress * Math.PI * 2) };
  return { x: v.x + (v.x2 - v.x) * progress, y: v.y + (v.y2 - v.y) * progress };
}
function Mark({ visual: v, progress }: { visual: Visual; progress: number }) {
  const color = INK[v.color];
  if (v.type !== "draw_diagram") {
    return <text x={v.x} y={v.y} fill={color} fontSize={v.type === "write_equation" ? 32 : 23} fontFamily={v.type === "write_equation" ? "Georgia, serif" : "'Comic Sans MS', 'Segoe Print', cursive"}>{v.text.slice(0, Math.ceil(v.text.length * progress))}</text>;
  }
  const end = endpoint(v, progress);
  if (v.shape === "circle") return <circle cx={v.x} cy={v.y} r={v.radius} fill="none" stroke={color} strokeWidth="2.5" pathLength="1" strokeDasharray={`${progress} 1`} />;
  const angle = Math.atan2(v.y2 - v.y, v.x2 - v.x);
  return <g stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round"><line x1={v.x} y1={v.y} x2={end.x} y2={end.y} />{v.shape === "arrow" && progress > .92 && <path d={`M ${v.x2 - 11 * Math.cos(angle - .45)} ${v.y2 - 11 * Math.sin(angle - .45)} L ${v.x2} ${v.y2} L ${v.x2 - 11 * Math.cos(angle + .45)} ${v.y2 - 11 * Math.sin(angle + .45)}`} />}</g>;
}
export function Whiteboard({ thread, writing }: { thread: Thread | null; writing: boolean }) {
  const position = thread?.position;
  const current = thread?.lesson.beats[Math.min(position?.beat ?? 0, thread.lesson.beats.length - 1)];
  let start = position?.beat ?? 0;
  if (thread) { start = Math.min(start, thread.lesson.beats.length - 1); while (start > 0 && thread.lesson.beats[start - 1].section === current?.section) start--; }
  const visible = thread?.lesson.beats.slice(start, (position?.beat ?? 0) + 1) ?? [];
  const cursor = current && position ? endpoint(current.visual, position.progress) : null;
  return <div className="tutor-board">
    <div className="board-label"><span>{current?.section ?? "A little curiosity goes a long way"}</span><span>LIVE WHITEBOARD</span></div>
    {!thread ? <div className="board-empty"><div className="orbit-art" aria-hidden="true"><span>F</span><i /><b>→</b></div><h2>Let’s make physics click.</h2><p>Pick a topic. Watch the idea take shape.<br />Ask whenever something doesn’t add up.</p><span className="board-note">One idea at a time.</span></div> : <svg viewBox="0 0 800 460" role="img" aria-label={`Whiteboard: ${current?.section}`}>
      {visible.map((beat, i) => <Mark key={`${start + i}-${beat.narration}`} visual={beat.visual} progress={start + i < (position?.beat ?? 0) ? 1 : position?.progress ?? 0} />)}
      {cursor && writing && <g transform={`translate(${cursor.x},${cursor.y})`} aria-hidden="true"><circle r="13" fill="#168575" opacity=".1" /><circle r="4" fill="#168575" /><path d="M 3 -3 L 15 -15" stroke="#168575" strokeWidth="4" strokeLinecap="round" /></g>}
    </svg>}
  </div>;
}
