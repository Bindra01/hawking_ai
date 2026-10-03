import { encodeQuestionWav } from "@/lib/tutor/pcm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mockFetch = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  vi.stubEnv("Eleven_labs", "test-only-key");
  vi.stubEnv("ELEVENLABS_API_KEY", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});
async function route() {
  vi.resetModules();
  return (await import("@/app/api/tutor/transcribe/route")).POST;
}
function request(
  type = "audio/wav",
  body: BodyInit = encodeQuestionWav(new Float32Array(16000)),
) {
  return new Request("http://localhost/api/tutor/transcribe", {
    method: "POST",
    headers: { "Content-Type": type },
    body,
  });
}
describe("voice question transcription", () => {
  it("forwards audio securely and returns editable plain text", async () => {
    const POST = await route();
    mockFetch.mockResolvedValue(
      Response.json({ text: " Why does energy stay constant? " }),
    );
    const response = await POST(request("audio/wav"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      text: "Why does energy stay constant?",
    });
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.elevenlabs.io/v1/speech-to-text");
    expect(options.headers["xi-api-key"]).toBe("test-only-key");
    expect(options.body.get("model_id")).toBe("scribe_v2");
    expect(options.body.get("file").size).toBe(32044);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it.each(["audio/wav"])("supports %s recordings", async (type) => {
    const POST = await route();
    mockFetch.mockResolvedValue(Response.json({ text: "Why?" }));
    expect((await POST(request(type))).status).toBe(200);
  });
  it("rejects unsupported formats, empty recordings, and oversized bodies before provider use", async () => {
    const POST = await route();
    expect((await POST(request("text/plain"))).status).toBe(415);
    expect((await POST(request("audio/wav", new Uint8Array(20)))).status).toBe(
      400,
    );
    expect(
      (await POST(request("audio/wav", new Uint8Array(4 * 1024 * 1024 + 1))))
        .status,
    ).toBe(413);
    expect(mockFetch).not.toHaveBeenCalled();
  });
  it("rejects recordings over 60 seconds before any provider call", async () => {
    const POST = await route();
    const bytes = new Uint8Array(44 + 16000 * 2 * 61);
    bytes.set(encodeQuestionWav(new Float32Array(16000)).slice(0, 44));
    const view = new DataView(bytes.buffer);
    view.setUint32(4, bytes.length - 8, true);
    view.setUint32(40, bytes.length - 44, true);
    expect((await POST(request("audio/wav", bytes))).status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });
  it("cancels an unfinished upload at the shared deadline and releases the slot", async () => {
    const POST = await route();
    const expiry = new AbortController();
    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(expiry.signal);
    const cancelled = vi.fn();
    try {
      const pending = POST(
        new Request("http://localhost/api/tutor/transcribe", {
          method: "POST",
          headers: { "Content-Type": "audio/wav" },
          body: new ReadableStream({ cancel: cancelled }),
          duplex: "half",
        } as RequestInit),
      );
      expiry.abort();
      expect((await pending).status).toBe(408);
      expect(cancelled).toHaveBeenCalledOnce();
      expect(mockFetch).not.toHaveBeenCalled();
      timeout.mockRestore();
      mockFetch.mockResolvedValue(Response.json({ text: "Why?" }));
      expect((await POST(request())).status).toBe(200);
    } finally {
      timeout.mockRestore();
    }
  });
  it("shares the request deadline across upload and provider work", async () => {
    const POST = await route();
    const signals: AbortSignal[] = [];
    const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation(() => {
      const c = new AbortController();
      signals.push(c.signal);
      return c.signal;
    });
    try {
      mockFetch.mockResolvedValue(Response.json({ text: "Why?" }));
      await POST(request());
      expect(timeout.mock.calls.map((call) => call[0])).toEqual([25000, 10000]);
      const signal = mockFetch.mock.calls[0][1].signal as AbortSignal;
      expect(signal.aborted).toBe(false);
    } finally {
      timeout.mockRestore();
    }
  });
  it("handles absent credentials without leaking details", async () => {
    vi.stubEnv("Eleven_labs", "");
    const POST = await route();
    expect((await POST(request())).status).toBe(503);
    expect(mockFetch).not.toHaveBeenCalled();
  });
  it.each([401, 403, 429, 500])(
    "sanitizes provider error %i",
    async (status) => {
      const POST = await route();
      mockFetch.mockResolvedValue(
        new Response("provider private diagnostic", { status }),
      );
      const response = await POST(request());
      expect(response.status).toBe(status === 429 ? 429 : 502);
      expect(await response.text()).not.toContain("private");
    },
  );
  it.each(["", "a".repeat(601)])(
    "rejects unusable transcripts",
    async (text) => {
      const POST = await route();
      mockFetch.mockResolvedValue(Response.json({ text }));
      expect((await POST(request())).status).toBe(422);
    },
  );
  it("caps concurrent provider calls", async () => {
    const POST = await route();
    const resolvers: ((value: Response) => void)[] = [];
    mockFetch.mockImplementation(
      () => new Promise((resolve) => resolvers.push(resolve)),
    );
    const first = POST(request());
    const second = POST(request());
    await vi.waitFor(() => expect(resolvers).toHaveLength(2));
    expect((await POST(request())).status).toBe(429);
    resolvers.forEach((resolve) => resolve(Response.json({ text: "Why?" })));
    expect((await first).status).toBe(200);
    expect((await second).status).toBe(200);
  });
});
