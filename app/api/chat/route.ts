import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { getOpenAIClient } from "@/lib/openai";
import {
  buildSystemPrompt,
  type ChatProblemContext,
  type StepSummary,
  type ClientStepResult,
  MAX_CHAT_MESSAGES,
  CHAT_MAX_TOKENS,
  MAX_MESSAGE_CHARS,
  MAX_STUDENT_ANSWER_CHARS,
} from "@/lib/chat-context";
import { describeCorrectAnswer } from "@/lib/step-eval";
import { getStepFormat, type Step } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

interface ChatMessage {
  role: string;
  content: string;
}

export async function POST(req: NextRequest) {
  // 1. Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. Parse + validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    problemId,
    stepResults: rawStepResults,
    messages: rawMessages,
  } = (body ?? {}) as {
    problemId?: unknown;
    stepResults?: unknown;
    messages?: unknown;
  };

  if (typeof problemId !== "string" || problemId.length === 0) {
    return NextResponse.json({ error: "problemId is required" }, { status: 400 });
  }

  // A non-empty but malformed (non-uuid) id can't refer to a real problem, and
  // would make Postgres throw `22P02 invalid input syntax for type uuid`.
  if (!UUID_REGEX.test(problemId)) {
    return NextResponse.json({ error: "Problem not found" }, { status: 404 });
  }

  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return NextResponse.json({ error: "messages is required" }, { status: 400 });
  }

  if (rawMessages.length > 2 * MAX_CHAT_MESSAGES) {
    return NextResponse.json({ error: "Too many messages" }, { status: 400 });
  }

  const messages: ChatMessage[] = [];
  for (const m of rawMessages) {
    const role = (m as ChatMessage)?.role;
    const content = (m as ChatMessage)?.content;
    if (role !== "user" && role !== "assistant") {
      return NextResponse.json({ error: "invalid message role" }, { status: 400 });
    }
    if (
      typeof content !== "string" ||
      content.length === 0 ||
      content.length > MAX_MESSAGE_CHARS
    ) {
      return NextResponse.json({ error: "message content invalid" }, { status: 400 });
    }
    messages.push({ role, content });
  }

  if (messages.filter((m) => m.role === "user").length > MAX_CHAT_MESSAGES) {
    return NextResponse.json(
      { error: "Chat limit reached for this problem." },
      { status: 429 }
    );
  }

  // Validate stepResults: must be an array if present (default [] if missing).
  if (rawStepResults !== undefined && !Array.isArray(rawStepResults)) {
    return NextResponse.json({ error: "stepResults must be an array" }, { status: 400 });
  }
  const stepResults: ClientStepResult[] = [];
  if (Array.isArray(rawStepResults)) {
    for (const entry of rawStepResults as unknown[]) {
      const e = (entry ?? {}) as Partial<ClientStepResult>;
      if (
        typeof e.index !== "number" ||
        !Number.isInteger(e.index) ||
        typeof e.correct !== "boolean" ||
        typeof e.studentAnswer !== "string"
      ) {
        return NextResponse.json(
          { error: "invalid stepResults entry" },
          { status: 400 }
        );
      }
      stepResults.push({
        index: e.index,
        correct: e.correct,
        studentAnswer: e.studentAnswer.slice(0, MAX_STUDENT_ANSWER_CHARS),
      });
    }
  }

  // 3. Fetch canonical problem
  let problem;
  try {
    problem = await prisma.problems.findUnique({
      where: { id: problemId },
      select: {
        title: true,
        scenario: true,
        goal: true,
        final_answer: true,
        solution_flow: true,
      },
    });
  } catch (err) {
    console.error("Problem lookup failed", err);
    return NextResponse.json(
      { error: "Chat is unavailable right now. Please try again." },
      { status: 500 }
    );
  }
  if (!problem) {
    return NextResponse.json({ error: "Problem not found" }, { status: 404 });
  }

  // 4. Build server-side ChatProblemContext
  let parsedFlow: { steps?: Step[] };
  if (typeof problem.solution_flow === "string") {
    try {
      parsedFlow = JSON.parse(problem.solution_flow);
    } catch {
      parsedFlow = {};
    }
  } else {
    parsedFlow = (problem.solution_flow ?? {}) as { steps?: Step[] };
  }
  const flowSteps: Step[] = Array.isArray(parsedFlow?.steps) ? parsedFlow.steps : [];

  const steps: StepSummary[] = flowSteps.map((step, i) => {
    const match = stepResults.find((entry) => entry.index === i);
    return {
      label: step.label,
      icon: "",
      prompt: step.prompt,
      format: getStepFormat(step),
      correctAnswer: describeCorrectAnswer(step),
      tip: step.tip ?? "",
      studentAnswer: match ? match.studentAnswer : "(no answer)",
      correct: match ? match.correct : false,
    };
  });

  const ctx: ChatProblemContext = {
    title: problem.title,
    scenario: problem.scenario,
    goal: problem.goal,
    finalAnswer: problem.final_answer,
    steps,
  };

  // 5. Call OpenAI
  try {
    const completion = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      max_tokens: CHAT_MAX_TOKENS,
      messages: [
        { role: "system", content: buildSystemPrompt(ctx) },
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
    });
    const reply = completion.choices[0]?.message?.content ?? "";
    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Chat completion failed", err);
    return NextResponse.json(
      { error: "Chat is unavailable right now. Please try again." },
      { status: 500 }
    );
  }
}
