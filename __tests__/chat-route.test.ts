import { describe, it, expect, beforeEach, vi } from "vitest";
import { MAX_CHAT_MESSAGES, MAX_MESSAGE_CHARS } from "@/lib/chat-context";

vi.mock("@/lib/supabase-server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { problems: { findFirst: vi.fn() } },
}));
vi.mock("@/lib/openai", () => ({ getOpenAIClient: vi.fn() }));

import { POST } from "@/app/api/chat/route";
import { createClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { getOpenAIClient } from "@/lib/openai";

const mockedCreateClient = vi.mocked(createClient);
const mockedFindFirst = vi.mocked(prisma.problems.findFirst);
const mockedGetOpenAIClient = vi.mocked(getOpenAIClient);

const VALID_UUID = "11111111-1111-1111-1111-111111111111";
const OTHER_UUID = "22222222-2222-2222-2222-222222222222";

function makeReq(body: unknown) {
  return { json: async () => body } as never;
}

function authAs(user: unknown) {
  mockedCreateClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
  } as never);
}

const DB_PROBLEM = {
  title: "DB Title",
  scenario: "A cart rolls down a ramp.",
  goal: "Find the speed at the bottom.",
  final_answer: "v = sqrt(2 g h)",
  solution_flow: {
    steps: [
      {
        type: "principle",
        format: "mcq",
        label: "Principle",
        icon: "P",
        prompt: "Which law?",
        options: [
          { text: "Energy conservation", correct: true, feedback: "Yes." },
          { text: "Wrong", correct: false, feedback: "No." },
        ],
        tip: "tip",
      },
    ],
  },
};

function makeOpenAI(replyContent = "hello reply") {
  const create = vi.fn().mockResolvedValue({
    choices: [{ message: { content: replyContent } }],
  });
  mockedGetOpenAIClient.mockReturnValue({
    chat: { completions: { create } },
  } as never);
  return create;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/chat", () => {
  it("returns 401 when unauthenticated", async () => {
    authAs(null);
    const res = await POST(makeReq({ problemId: VALID_UUID, messages: [] }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when problemId missing", async () => {
    authAs({ id: "u1" });
    const res = await POST(
      makeReq({ messages: [{ role: "user", content: "hi" }] })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for a system-role message", async () => {
    authAs({ id: "u1" });
    const res = await POST(
      makeReq({
        problemId: VALID_UUID,
        messages: [{ role: "system", content: "evil" }],
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for oversized content", async () => {
    authAs({ id: "u1" });
    const res = await POST(
      makeReq({
        problemId: VALID_UUID,
        messages: [{ role: "user", content: "a".repeat(MAX_MESSAGE_CHARS + 1) }],
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty messages array", async () => {
    authAs({ id: "u1" });
    const res = await POST(makeReq({ problemId: VALID_UUID, messages: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 429 when user messages exceed cap", async () => {
    authAs({ id: "u1" });
    const messages = Array.from({ length: MAX_CHAT_MESSAGES + 1 }, () => ({
      role: "user",
      content: "hi",
    }));
    const res = await POST(makeReq({ problemId: VALID_UUID, messages }));
    expect(res.status).toBe(429);
  });

  it("returns 404 when problem not found", async () => {
    authAs({ id: "u1" });
    mockedFindFirst.mockResolvedValue(null as never);
    const res = await POST(
      makeReq({
        problemId: OTHER_UUID,
        messages: [{ role: "user", content: "hi" }],
      })
    );
    expect(res.status).toBe(404);
  });

  it("happy path returns 200 with reply and server-built system prompt", async () => {
    authAs({ id: "u1" });
    mockedFindFirst.mockResolvedValue(DB_PROBLEM as never);
    const create = makeOpenAI("hello reply");

    const clientMessages = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello there" },
      { role: "user", content: "follow up" },
    ];

    const res = await POST(
      makeReq({
        problemId: VALID_UUID,
        // bogus client context that must be ignored
        context: { title: "CLIENT FAKE TITLE" },
        stepResults: [{ index: 0, correct: true, studentAnswer: "Energy conservation" }],
        messages: clientMessages,
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ reply: "hello reply" });

    expect(create).toHaveBeenCalledTimes(1);
    const arg = create.mock.calls[0][0];
    expect(arg.model).toBe("gpt-4o");
    expect(arg.messages[0].role).toBe("system");
    expect(arg.messages[0].content).toContain("DB Title");
    // server owns the prompt: client-supplied bogus title is ignored
    expect(arg.messages[0].content).not.toContain("CLIENT FAKE TITLE");

    // exactly one leading system message, then the client user/assistant
    // messages preserved in order.
    expect(arg.messages.length).toBe(1 + clientMessages.length);
    expect(arg.messages.filter((m: { role: string }) => m.role === "system").length).toBe(1);
    expect(arg.messages.slice(1)).toEqual(clientMessages);
  });

  it("propagates Tier-0 wrong studentAnswer + DB correct answer into the system prompt", async () => {
    authAs({ id: "u1" });
    mockedFindFirst.mockResolvedValue(DB_PROBLEM as never);
    const create = makeOpenAI();

    await POST(
      makeReq({
        problemId: VALID_UUID,
        stepResults: [{ index: 0, correct: false, studentAnswer: "WRONG_ANSWER_XYZ" }],
        messages: [{ role: "user", content: "why?" }],
      })
    );

    const systemContent = create.mock.calls[0][0].messages[0].content;
    expect(systemContent).toContain("WRONG_ANSWER_XYZ");
    expect(systemContent).toContain("Energy conservation");
  });

  it("returns 500 when OpenAI throws", async () => {
    authAs({ id: "u1" });
    mockedFindFirst.mockResolvedValue(DB_PROBLEM as never);
    const create = vi.fn().mockRejectedValue(new Error("boom"));
    mockedGetOpenAIClient.mockReturnValue({
      chat: { completions: { create } },
    } as never);

    const res = await POST(
      makeReq({
        problemId: VALID_UUID,
        messages: [{ role: "user", content: "hi" }],
      })
    );
    expect(res.status).toBe(500);
  });

  it("returns 404 for a malformed (non-uuid) problemId without querying the DB", async () => {
    authAs({ id: "u1" });
    const res = await POST(
      makeReq({
        problemId: "not-a-uuid",
        messages: [{ role: "user", content: "hi" }],
      })
    );
    expect(res.status).toBe(404);
    expect(mockedFindFirst).not.toHaveBeenCalled();
  });

  it("returns 400 when stepResults is not an array", async () => {
    authAs({ id: "u1" });
    const res = await POST(
      makeReq({
        problemId: VALID_UUID,
        stepResults: { index: 0, correct: true, studentAnswer: "x" },
        messages: [{ role: "user", content: "hi" }],
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("stepResults must be an array");
  });

  it("returns 400 for a malformed stepResults entry", async () => {
    authAs({ id: "u1" });
    const res = await POST(
      makeReq({
        problemId: VALID_UUID,
        stepResults: [{ index: "zero", correct: "yes", studentAnswer: 5 }],
        messages: [{ role: "user", content: "hi" }],
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invalid stepResults entry");
  });
});
