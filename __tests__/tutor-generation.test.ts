import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { generateLesson, TUTOR_SYSTEM_PROMPT } from "@/lib/tutor/generate";
import {
  readBoundedBody,
  expandEquationBeats,
  prepareLesson,
  validateLesson,
  validateRequest,
} from "@/lib/tutor/validate";
import type { Lesson } from "@/lib/tutor/types";

// Synthetic fixture only: never a shipped fallback lesson or a paid provider call.
function lesson(answer = false): Lesson {
  return {
    title: "Test topic",
    beats: Array.from({ length: answer ? 4 : 16 }, (_, i) => ({
      section: `Page ${Math.floor(i / 4) + 1}`,
      narration:
        "Imagine a gentle push moving this object forward while we carefully observe its changing motion together.",
      visual: {
        type: "write_text",
        text: `Mark ${i}`,
        x: 60,
        y: 80 + (i % 4) * 60,
        color: "ink",
      },
    })),
  };
}
function provider(value: unknown, stop = "end_turn") {
  return new Response(
    JSON.stringify({
      content: [
        {
          type: "text",
          text: typeof value === "string" ? value : JSON.stringify(value),
        },
      ],
      stop_reason: stop,
    }),
    { status: 200 },
  );
}
const mockFetch = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-only-key");
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("tutor validation", () => {
  it("accepts bounded arbitrary topics and optional context", () => {
    expect(
      validateRequest({
        topic: "  superconductivity  ",
        question: "Why?",
        context: "Earlier beat",
      }).topic,
    ).toBe("superconductivity");
  });
  it.each([
    null,
    [],
    {},
    { topic: " " },
    { topic: "a".repeat(201) },
    { topic: "x", question: 4 },
    { topic: "x", context: "x".repeat(4001) },
  ])("rejects invalid request %j", (value) => {
    expect(() => validateRequest(value)).toThrow();
  });
  it("enforces different lesson and answer word budgets", () => {
    expect(validateLesson(lesson()).beats).toHaveLength(16);
    expect(validateLesson(lesson(true), true).beats).toHaveLength(4);
    expect(() => validateLesson(lesson(), true)).toThrow();
    expect(() => validateLesson(lesson(true))).toThrow();
    const short = lesson();
    short.beats.forEach((b) => {
      b.narration = "Too short.";
    });
    expect(() => validateLesson(short)).toThrow(/words/);
  });
  it.each([
    { type: "svg", text: "<script/>" },
    { type: "write_text", text: "a".repeat(46), x: 35, y: 60, color: "ink" },
    { type: "write_text", text: "One\nTwo", x: 35, y: 60, color: "ink" },
    { type: "write_text", text: "far too wide", x: 720, y: 60, color: "ink" },
    { type: "write_text", text: "a", x: NaN, y: 60, color: "ink" },
    { type: "write_text", text: "a", x: 35, y: 411, color: "ink" },
    { type: "write_text", text: "a", x: 35, y: 60, color: "red" },
    {
      type: "draw_diagram",
      shape: "circle",
      x: 35,
      y: 60,
      x2: 35,
      y2: 60,
      radius: 60,
      color: "ink",
    },
    {
      type: "draw_diagram",
      shape: "line",
      x: 35,
      y: 60,
      x2: 35,
      y2: 60,
      radius: 0,
      color: "ink",
    },
  ])("rejects malformed or off-board visual %j", (visual) => {
    const value = lesson();
    expect(() =>
      validateLesson({
        ...value,
        beats: [{ ...value.beats[0], visual }, ...value.beats.slice(1)],
      }),
    ).toThrow();
  });

  it.each(["W = F × d", "1 J = 1 N·m", "10 × 2 = 20 J"])(
    "rejects complete equation %s in either text mode",
    (text) => {
      for (const type of ["write_text", "write_equation"] as const) {
        const value = lesson();
        value.beats[0].visual = { type, text, x: 60, y: 80, color: "ink" };
        expect(() => validateLesson(value)).toThrow(/term by term/);
      }
    },
  );
  it("budgets model beats before equation expansion, not after", () => {
    const source = lesson();
    source.beats = Array.from({ length: 36 }, () => ({
      section: "Equation",
      narration: "One two three four five six seven",
      visual: {
        type: "write_equation" as const,
        text: "W = F × d",
        x: 60,
        y: 90,
        color: "teal" as const,
      },
    }));
    expect(prepareLesson(source).beats).toHaveLength(180);
    source.beats.push(source.beats[0]);
    expect(() => prepareLesson(source)).toThrow(/beat count/);
  });
  it("normalizes complete equations without changing spoken words or term order", () => {
    const source = lesson();
    source.beats[0].visual = {
      type: "write_equation",
      text: "W = F × d",
      x: 60,
      y: 90,
      color: "teal",
    };
    const result = validateLesson(expandEquationBeats(source));
    expect(
      result.beats
        .slice(0, 5)
        .map((b) => ("text" in b.visual ? b.visual.text : "")),
    ).toEqual(["W", "=", "F", "×", "d"]);
    expect(
      result.beats
        .slice(0, 5)
        .map((b) => b.narration)
        .join(" "),
    ).toBe(source.beats[0].narration);
    expect(result.beats.slice(0, 5).every((b) => b.visual.y === 90)).toBe(true);
  });
  it("accepts equation terms and individual diagram primitives", () => {
    const value = lesson();
    value.beats[0].visual = {
      type: "write_equation",
      text: "F",
      x: 60,
      y: 150,
      color: "teal",
    };
    value.beats[1].visual = {
      type: "write_equation",
      text: "=",
      x: 95,
      y: 150,
      color: "teal",
    };
    value.beats[2].visual = {
      type: "draw_diagram",
      shape: "arrow",
      x: 60,
      y: 250,
      x2: 200,
      y2: 250,
      radius: 0,
      color: "amber",
    };
    value.beats[3].visual = {
      type: "draw_diagram",
      shape: "circle",
      x: 300,
      y: 250,
      x2: 300,
      y2: 250,
      radius: 30,
      color: "ink",
    };
    expect(validateLesson(value)).toEqual(value);
  });
  it("rejects reusing an earlier page and oversized beats", () => {
    const value = lesson();
    value.beats[8].section = value.beats[0].section;
    expect(() => validateLesson(value)).toThrow(/contiguous/);
    expect(() =>
      validateLesson({ ...lesson(), beats: Array(37).fill(lesson().beats[0]) }),
    ).toThrow(/count/);
  });
  it("cancels a stalled body when its deadline signal aborts", async () => {
    const controller = new AbortController();
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ cancel });
    const reading = readBoundedBody(stream, 30, controller.signal);
    controller.abort();
    await expect(reading).rejects.toMatchObject({ status: 504 });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("caps streamed bytes without relying on Content-Length", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array(20));
        c.enqueue(new Uint8Array(20));
        c.close();
      },
    });
    await expect(readBoundedBody(stream, 30)).rejects.toMatchObject({
      status: 413,
    });
  });
});

describe("mocked Claude generation", () => {
  it("generates a main lesson with explicit pedagogy and configurable model", async () => {
    vi.stubEnv("ANTHROPIC_MODEL", "test-model");
    mockFetch.mockResolvedValue(provider(lesson()));
    expect(await generateLesson({ topic: "wave particle duality" })).toEqual(
      lesson(),
    );
    const options = mockFetch.mock.calls[0][1]!;
    const body = JSON.parse(options.body as string);
    expect(body.model).toBe("test-model");
    expect(body.messages[0].content).toContain("MAIN LESSON");
    expect(body.system).toContain("common misconception");
    expect(TUTOR_SYSTEM_PROMPT).toContain("term by term");
    expect(TUTOR_SYSTEM_PROMPT).toContain("240–280");
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
  it("generates a scoped answer with context and default model", async () => {
    vi.stubEnv("ANTHROPIC_MODEL", "");
    mockFetch.mockResolvedValue(provider(lesson(true)));
    await generateLesson({
      topic: "waves",
      question: "Why?",
      context: "We drew a crest",
    });
    const body = JSON.parse(mockFetch.mock.calls[0][1]!.body as string);
    expect(body.model).toBe("claude-sonnet-4-6");
    expect(body.messages[0].content).toContain("QUESTION ANSWER");
    expect(body.messages[0].content).toContain("We drew a crest");
  });
  it.each(["not JSON", { title: "bad", beats: [] }])(
    "repairs one malformed output",
    async (bad) => {
      mockFetch
        .mockResolvedValueOnce(provider(bad))
        .mockResolvedValueOnce(provider(lesson()));
      expect(await generateLesson({ topic: "energy" })).toEqual(lesson());
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const body = JSON.parse(mockFetch.mock.calls[1][1]!.body as string);
      expect(body.messages).toHaveLength(3);
      expect(body.messages[2].content).toContain("Repair");
    },
  );
  it("repairs truncated output once and tolerates a single code fence", async () => {
    mockFetch
      .mockResolvedValueOnce(provider(lesson(), "max_tokens"))
      .mockResolvedValueOnce(
        provider("```json\n" + JSON.stringify(lesson()) + "\n```"),
      );
    expect(await generateLesson({ topic: "energy" })).toEqual(lesson());
  });
  it("never retries schema repair indefinitely or leaks bad output", async () => {
    mockFetch.mockImplementation(async () =>
      provider("provider-secret-invalid-json"),
    );
    await expect(generateLesson({ topic: "energy" })).rejects.toMatchObject({
      status: 502,
      message: "The tutor could not prepare a clear lesson. Please try again.",
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
  it.each([401, 429, 500])(
    "returns safe errors for provider HTTP %i",
    async (status) => {
      mockFetch.mockResolvedValue(
        new Response("private provider error", { status }),
      );
      await expect(generateLesson({ topic: "energy" })).rejects.toMatchObject({
        status: status === 429 ? 503 : 502,
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    },
  );
  it("handles malformed provider envelopes and excessive response bytes", async () => {
    mockFetch.mockResolvedValueOnce(new Response("null"));
    await expect(generateLesson({ topic: "energy" })).rejects.toMatchObject({
      status: 502,
    });
    mockFetch.mockResolvedValueOnce(new Response("a".repeat(96_001)));
    await expect(generateLesson({ topic: "energy" })).rejects.toMatchObject({
      status: 502,
    });
  });
  it("does not call the provider without a key or with invalid inputs", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    await expect(generateLesson({ topic: "energy" })).rejects.toMatchObject({
      status: 503,
    });
    await expect(generateLesson({ topic: "" })).rejects.toMatchObject({
      status: 400,
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
  it("maps cancellation to a safe timeout", async () => {
    const controller = new AbortController();
    controller.abort();
    mockFetch.mockRejectedValue(new DOMException("Aborted", "AbortError"));
    await expect(
      generateLesson({ topic: "energy" }, controller.signal),
    ).rejects.toMatchObject({ status: 504 });
  });
});

describe("POST /api/tutor", () => {
  async function route() {
    vi.resetModules();
    return (await import("@/app/api/tutor/route")).POST;
  }
  function request(body: unknown, headers: Record<string, string> = {}) {
    return new Request("http://localhost/api/tutor", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  }
  it("returns the lesson directly with no-store", async () => {
    const POST = await route();
    mockFetch.mockResolvedValue(provider(lesson()));
    const response = await POST(request({ topic: "energy" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(lesson());
  });
  it("rejects oversized declared and actual bodies before generation", async () => {
    const POST = await route();
    expect(
      (await POST(request({ topic: "energy" }, { "content-length": "24001" })))
        .status,
    ).toBe(413);
    expect((await POST(request({ topic: "a".repeat(24_001) }))).status).toBe(
      413,
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON, unsupported content types and invalid fields", async () => {
    const POST = await route();
    expect(
      (
        await POST(
          new Request("http://localhost/api/tutor", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{",
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await POST(
          request({ topic: "energy" }, { "content-type": "text/plain" }),
        )
      ).status,
    ).toBe(415);
    expect((await POST(request({ topic: "" }))).status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });
  it("limits ten requests per process per minute", async () => {
    const POST = await route();
    for (let i = 0; i < 10; i++)
      expect((await POST(request({ topic: "" }))).status).toBe(400);
    const response = await POST(request({ topic: "energy" }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
  });
  it("caps simultaneous requests and releases slots after failures", async () => {
    const POST = await route();
    const pending: ((response: Response) => void)[] = [];
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          pending.push(resolve);
        }),
    );
    const first = POST(request({ topic: "energy" }));
    const second = POST(request({ topic: "energy" }));
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    expect((await POST(request({ topic: "energy" }))).status).toBe(429);
    pending.forEach((resolve) =>
      resolve(new Response("private", { status: 500 })),
    );
    expect((await first).status).toBe(502);
    expect((await second).status).toBe(502);
    mockFetch.mockResolvedValue(provider(lesson()));
    expect((await POST(request({ topic: "energy" }))).status).toBe(200);
  });
  it("streams heartbeats while generation waits and returns parseable lesson JSON", async () => {
    const POST = await route();
    vi.useFakeTimers();
    let resolve!: (response: Response) => void;
    mockFetch.mockImplementation(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    );
    const response = await POST(
      request(
        { topic: "energy" },
        { accept: "application/x-tutor-stream+json" },
      ),
    );
    const reader = response.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toBe(" ");
    await vi.advanceTimersByTimeAsync(5000);
    const heartbeat = await reader.read();
    expect(new TextDecoder().decode(heartbeat.value)).toBe(" ");
    vi.useRealTimers();
    resolve(provider(lesson()));
    let output = "";
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      output += new TextDecoder().decode(chunk.value);
    }
    expect(JSON.parse(output)).toEqual(lesson());
  });
  it("returns safe error payloads after streaming headers and validates before streaming", async () => {
    const POST = await route();
    const headers = { accept: "application/x-tutor-stream+json" };
    expect((await POST(request({ topic: "" }, headers))).status).toBe(400);
    mockFetch.mockResolvedValue(
      new Response("secret provider error", { status: 500 }),
    );
    const response = await POST(request({ topic: "energy" }, headers));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      error: "The tutor service is temporarily unavailable. Please try again.",
    });
  });
  it("aborts generation when the stream consumer cancels", async () => {
    const POST = await route();
    let signal!: AbortSignal;
    mockFetch.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          signal = init!.signal!;
          signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const response = await POST(
      request(
        { topic: "energy" },
        { accept: "application/x-tutor-stream+json" },
      ),
    );
    await response.body!.cancel();
    expect(signal.aborted).toBe(true);
  });
});
