import { useEffect, useRef } from "react";
import { boardFrame } from "@/lib/tutor/board";
import { INK, type Thread, type Visual } from "@/lib/tutor/types";

function endpoint(v: Visual, progress: number) {
  if (v.type === "hold" || v.type === "clear" || v.type === "highlight")
    return null;
  if (v.type !== "draw_diagram")
    return {
      x:
        v.x +
        Math.min(v.text.length, Math.ceil(v.text.length * progress)) *
          (v.type === "write_equation" ? 19 : 13),
      y: v.y,
    };
  if (v.shape === "circle")
    return {
      x: v.x + v.radius * Math.cos(progress * Math.PI * 2),
      y: v.y + v.radius * Math.sin(progress * Math.PI * 2),
    };
  return { x: v.x + (v.x2 - v.x) * progress, y: v.y + (v.y2 - v.y) * progress };
}
function Mark({ visual: v, progress }: { visual: Visual; progress: number }) {
  if (v.type === "hold" || v.type === "clear") return null;
  const color = INK[v.color];
  if (v.type === "highlight")
    return (
      <circle
        cx={v.x}
        cy={v.y}
        r={v.radius}
        fill={color}
        fillOpacity=".08"
        stroke={color}
        strokeWidth="3"
        strokeDasharray="6 5"
      />
    );
  if (v.type !== "draw_diagram") {
    return (
      <text
        x={v.x}
        y={v.y}
        fill={color}
        fontSize={v.type === "write_equation" ? 32 : 23}
        fontFamily={
          v.type === "write_equation"
            ? "Georgia, serif"
            : "'Comic Sans MS', 'Segoe Print', cursive"
        }
      >
        {v.text.slice(0, Math.ceil(v.text.length * progress))}
      </text>
    );
  }
  const end = endpoint(v, progress);
  if (v.shape === "circle")
    return (
      <circle
        cx={v.x}
        cy={v.y}
        r={v.radius}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        pathLength="1"
        strokeDasharray={`${progress} 1`}
      />
    );
  const angle = Math.atan2(v.y2 - v.y, v.x2 - v.x);
  return (
    <g stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round">
      <line x1={v.x} y1={v.y} x2={end!.x} y2={end!.y} />
      {v.shape === "arrow" && progress > 0.92 && (
        <path
          d={`M ${v.x2 - 11 * Math.cos(angle - 0.45)} ${v.y2 - 11 * Math.sin(angle - 0.45)} L ${v.x2} ${v.y2} L ${v.x2 - 11 * Math.cos(angle + 0.45)} ${v.y2 - 11 * Math.sin(angle + 0.45)}`}
        />
      )}
    </g>
  );
}
export function Whiteboard({
  thread,
  writing,
}: {
  thread: Thread | null;
  writing: boolean;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const position = thread?.position;
  const current =
    thread?.lesson.beats[
      Math.min(position?.beat ?? 0, thread.lesson.beats.length - 1)
    ];
  const frame = thread ? boardFrame(thread) : [];
  const cursor =
    current && position ? endpoint(current.visual, position.progress) : null;
  // Emphasis has no writing pen, but must remain visible on a narrow board.
  const highlight =
    current?.visual.type === "highlight" &&
    (position?.beat ?? 0) < (thread?.lesson.beats.length ?? 0)
      ? current.visual
      : null;
  const focus = highlight ?? cursor;
  const hasFocus = focus !== null;
  const focusX = focus?.x ?? 0;
  const focusY = focus?.y ?? 0;
  const focusRadius = highlight?.radius ?? 0;
  useEffect(() => {
    const container = viewport.current;
    if (
      !container ||
      !writing ||
      !hasFocus ||
      container.scrollWidth <= container.clientWidth
    )
      return;
    const scale = container.scrollWidth / 800;
    if (
      focusRadius &&
      (focusX - focusRadius) * scale >= container.scrollLeft &&
      (focusX + focusRadius) * scale <=
        container.scrollLeft + container.clientWidth &&
      (focusY - focusRadius) * scale >= container.scrollTop &&
      (focusY + focusRadius) * scale <=
        container.scrollTop + container.clientHeight
    )
      return;
    container.scrollTo({
      left: Math.max(
        0,
        focusX * scale - container.clientWidth * (focusRadius ? 0.5 : 0.65),
      ),
      top: Math.max(0, focusY * scale - container.clientHeight * 0.5),
      behavior: "instant",
    });
  }, [focusX, focusY, focusRadius, writing, hasFocus]);
  return (
    <div className="tutor-board">
      <div className="board-label">
        <span>{current?.section ?? "A little curiosity goes a long way"}</span>
        <span>LIVE WHITEBOARD</span>
      </div>
      {!thread ? (
        <div className="board-empty">
          <div className="orbit-art" aria-hidden="true">
            <span>F</span>
            <i />
            <b>→</b>
          </div>
          <h2>Let’s make physics click.</h2>
          <p>
            Pick a topic. Watch the idea take shape.
            <br />
            Ask whenever something doesn’t add up.
          </p>
          <span className="board-note">One idea at a time.</span>
        </div>
      ) : (
        <div
          ref={viewport}
          className="board-viewport"
          tabIndex={0}
          role="region"
          aria-label="Scrollable whiteboard. Pause narration to pan freely."
        >
          <svg
            viewBox="0 0 800 460"
            role="img"
            aria-label={`Whiteboard: ${current?.section}`}
          >
            {frame.map(({ beat, index, progress }) => (
              <Mark key={index} visual={beat.visual} progress={progress} />
            ))}
            {cursor && writing && (
              <g
                transform={`translate(${cursor.x},${cursor.y})`}
                aria-hidden="true"
              >
                <circle r="13" fill="#168575" opacity=".1" />
                <circle r="4" fill="#168575" />
                <path
                  d="M 3 -3 L 15 -15"
                  stroke="#168575"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </g>
            )}
          </svg>
        </div>
      )}
      {thread && (
        <div className="board-pan-hint">
          The board follows the pen. Pause to pan and explore.
        </div>
      )}
    </div>
  );
}
