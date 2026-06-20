"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import MathText from "./MathText";
import {
  buildStarters,
  MAX_CHAT_MESSAGES,
  type ChatProblemContext,
  type ClientStepResult,
} from "@/lib/chat-context";

interface ProblemChatProps {
  problemId: string;
  context: ChatProblemContext;
  onClose: () => void;
}

type ChatMessage = { role: "user" | "assistant"; content: string };

export default function ProblemChat({ problemId, context, onClose }: ProblemChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const starters = buildStarters(context);
  const stepResults: ClientStepResult[] = context.steps.map((s, i) => ({
    index: i,
    correct: s.correct,
    studentAnswer: s.studentAnswer,
  }));

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const userMessageCount = messages.filter((m) => m.role === "user").length;
  const atLimit = userMessageCount >= MAX_CHAT_MESSAGES;
  const sendDisabled = loading || input.trim() === "" || atLimit;

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const next: ChatMessage[] = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId, stepResults, messages: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Something went wrong.");
        return;
      }
      const data = await res.json();
      const reply =
        data.reply && data.reply.trim()
          ? data.reply
          : "I couldn't generate a reply — please try rephrasing.";
      setMessages([...next, { role: "assistant" as const, content: reply }]);
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="problem-chat-title"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 32 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "#131327",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          margin: "0 auto",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: "2px solid #2a2a40",
            flexShrink: 0,
          }}
        >
          <span
            id="problem-chat-title"
            style={{ color: "#e5e5e5", fontWeight: 800, fontSize: 16 }}
          >
            Ask about this problem
          </span>
          <button
            onClick={onClose}
            aria-label="Close chat"
            style={{
              background: "transparent",
              border: "none",
              color: "#afafbf",
              fontSize: 20,
              cursor: "pointer",
              lineHeight: 1,
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Message list */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%",
                background: m.role === "user" ? "#7c3aed" : "#1a1a2e",
                border: m.role === "user" ? "none" : "2px solid #2a2a40",
                color: m.role === "user" ? "#fff" : "#e5e5e5",
                borderRadius: 16,
                padding: "10px 14px",
                fontSize: 14,
                lineHeight: 1.45,
              }}
            >
              <MathText text={m.content} />
            </div>
          ))}

          {/* Starter chips */}
          {messages.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {starters.map((starter) => (
                <button
                  key={starter.id}
                  onClick={() => sendMessage(starter.message)}
                  style={{
                    textAlign: "left",
                    background: "#1a1a2e",
                    border: "2px solid #2a2a40",
                    color: "#e5e5e5",
                    borderRadius: 14,
                    padding: "10px 14px",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {starter.label}
                </button>
              ))}
            </div>
          )}

          {/* Typing indicator */}
          {loading && (
            <div
              style={{
                alignSelf: "flex-start",
                background: "#1a1a2e",
                border: "2px solid #2a2a40",
                color: "#afafbf",
                borderRadius: 16,
                padding: "10px 14px",
                fontSize: 14,
              }}
            >
              …
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ color: "#ff4b4b", fontSize: 13, fontWeight: 600 }}>{error}</div>
          )}
        </div>

        {/* Input row */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: "12px 16px",
            borderTop: "2px solid #2a2a40",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <input
              ref={inputRef}
              type="text"
              aria-label="Ask about this problem"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={atLimit}
              placeholder="Type your question…"
              style={{
                flex: 1,
                background: "#1a1a2e",
                border: "2px solid #2a2a40",
                color: "#e5e5e5",
                borderRadius: 14,
                padding: "10px 14px",
                fontSize: 14,
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={sendDisabled}
              style={{
                background: "#7c3aed",
                color: "#fff",
                border: "none",
                borderRadius: 14,
                padding: "10px 18px",
                fontSize: 14,
                fontWeight: 800,
                cursor: sendDisabled ? "not-allowed" : "pointer",
                opacity: sendDisabled ? 0.5 : 1,
              }}
            >
              Send
            </button>
          </div>
          {atLimit && (
            <span style={{ color: "#afafbf", fontSize: 12 }}>
              Chat limit reached for this problem.
            </span>
          )}
        </form>
      </div>
    </motion.div>
  );
}
