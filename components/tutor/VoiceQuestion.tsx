"use client";
import { recordingToWav } from "@/lib/tutor/pcm";

import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "idle" | "permission" | "recording" | "transcribing";
export function VoiceQuestion({
  disabled,
  contextKey,
  onStart,
  onTranscript,
  onBusy,
}: {
  disabled: boolean;
  contextKey: string;
  onStart: () => void;
  onTranscript: (text: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const generation = useRef(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const controller = useRef<AbortController | null>(null);
  const callbacks = useRef({ onStart, onTranscript, onBusy });
  useEffect(() => {
    callbacks.current = { onStart, onTranscript, onBusy };
  }, [onStart, onTranscript, onBusy]);
  const release = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);
  const cancel = useCallback(() => {
    generation.current++;
    controller.current?.abort();
    if (recorder.current?.state === "recording") recorder.current.stop();
    recorder.current = null;
    release();
    setPhase("idle");
    callbacks.current.onBusy(false);
  }, [release]);
  useEffect(() => {
    const fence = generation;
    const hide = () => {
      if (document.hidden) cancel();
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      fence.current++;
      controller.current?.abort();
      if (recorder.current?.state === "recording") recorder.current.stop();
      release();
      callbacks.current.onBusy(false);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [contextKey, cancel, release]);

  async function start() {
    if (disabled || phase !== "idle") return;
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError(
        "This browser cannot record audio. Use a current browser over HTTPS, or type your question.",
      );
      return;
    }
    const id = ++generation.current;
    setError("");
    setSeconds(0);
    setPhase("permission");
    callbacks.current.onBusy(true);
    callbacks.current.onStart();
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      if (id !== generation.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recording = new MediaRecorder(
        media,
        mimeType ? { mimeType } : undefined,
      );
      recorder.current = recording;
      const chunks: Blob[] = [];
      let size = 0;
      let ticks = 0;
      recording.ondataavailable = (event) => {
        if (id !== generation.current || !event.data.size) return;
        size += event.data.size;
        if (size > 4 * 1024 * 1024) {
          setError(
            "The recording is too large. Please ask a shorter question.",
          );
          cancel();
          return;
        }
        chunks.push(event.data);
      };
      recording.onerror = () => {
        if (id === generation.current) {
          setError("Recording failed. Please try again or type your question.");
          cancel();
        }
      };
      recording.onstop = async () => {
        if (id !== generation.current) return;
        release();
        setPhase("transcribing");
        const abort = new AbortController();
        controller.current = abort;
        const timeout = setTimeout(() => abort.abort(), 30000);
        try {
          const blob = new Blob(chunks, {
            type: recording.mimeType || chunks[0]?.type || "audio/webm",
          });
          if (blob.size < 100)
            throw new Error("The recording is too short. Please try again.");
          const wav = await recordingToWav(blob);
          if (id !== generation.current || abort.signal.aborted) return;
          const response = await fetch("/api/tutor/transcribe", {
            method: "POST",
            headers: { "Content-Type": "audio/wav" },
            body: wav,
            signal: abort.signal,
          });
          const data = await response.json().catch(() => {
            throw new Error(
              "The transcription connection ended. Please try again.",
            );
          });
          if (!response.ok || data.error)
            throw new Error(
              data.error || "Transcription failed. Please try again.",
            );
          if (typeof data.text !== "string")
            throw new Error("No transcript was returned. Please try again.");
          if (id === generation.current)
            callbacks.current.onTranscript(data.text);
        } catch (error) {
          if (id === generation.current)
            setError(
              error instanceof Error && error.name !== "AbortError"
                ? error.message
                : "Transcription timed out. Please try again or type your question.",
            );
        } finally {
          clearTimeout(timeout);
          if (id === generation.current) {
            setPhase("idle");
            callbacks.current.onBusy(false);
          }
        }
      };
      recording.start(250);
      setPhase("recording");
      timer.current = setInterval(() => {
        ticks++;
        setSeconds(ticks);
        if (ticks >= 60 && recording.state === "recording") recording.stop();
      }, 1000);
    } catch (error) {
      if (id !== generation.current) return;
      release();
      setPhase("idle");
      callbacks.current.onBusy(false);
      setError(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow microphone access, or type your question."
          : "The microphone is unavailable. Check your device, or type your question.",
      );
    }
  }
  return (
    <div className="voice-question">
      <div className="voice-actions">
        <button
          type="button"
          className="voice-button"
          disabled={phase === "idle" ? disabled : phase !== "recording"}
          onClick={() => {
            if (phase === "recording") {
              if (recorder.current?.state === "recording")
                recorder.current.stop();
            } else void start();
          }}
        >
          {phase === "recording"
            ? `Stop recording · ${seconds}s`
            : phase === "permission"
              ? "Allow microphone…"
              : phase === "transcribing"
                ? "Transcribing…"
                : "Speak your question"}
        </button>
        {phase !== "idle" && (
          <button type="button" className="voice-cancel" onClick={cancel}>
            Cancel recording
          </button>
        )}
      </div>
      <small aria-live="polite">
        {phase === "recording"
          ? "Listening. Stop when you finish. Maximum 60 seconds."
          : phase === "transcribing"
            ? "Turning your speech into an editable question…"
            : "Tap to record. Review the transcript before sending. Audio goes to ElevenLabs."}
      </small>
      {error && (
        <p className="voice-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
