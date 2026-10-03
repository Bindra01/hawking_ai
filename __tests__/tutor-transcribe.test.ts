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
function request(type = "audio/webm", body: BodyInit = new Uint8Array(400)) {
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
    const response = await POST(request("audio/webm;codecs=opus"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      text: "Why does energy stay constant?",
    });
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.elevenlabs.io/v1/speech-to-text");
    expect(options.headers["xi-api-key"]).toBe("test-only-key");
    expect(options.body.get("model_id")).toBe("scribe_v2");
    expect(options.body.get("file").size).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it.each(["audio/mp4", "audio/ogg", "audio/wav", "audio/mpeg"])(
    "supports %s recordings",
    async (type) => {
      const POST = await route();
      mockFetch.mockResolvedValue(Response.json({ text: "Why?" }));
      expect((await POST(request(type))).status).toBe(200);
    },
  );
  it("rejects unsupported formats, empty recordings, and oversized bodies before provider use", async () => {
    const POST = await route();
    expect((await POST(request("text/plain"))).status).toBe(415);
    expect((await POST(request("audio/webm", new Uint8Array(20)))).status).toBe(
      400,
    );
    expect(
      (await POST(request("audio/webm", new Uint8Array(4 * 1024 * 1024 + 1))))
        .status,
    ).toBe(413);
    expect(mockFetch).not.toHaveBeenCalled();
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
