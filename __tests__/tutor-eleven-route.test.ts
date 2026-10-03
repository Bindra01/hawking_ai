import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
let POST: typeof import("@/app/api/tutor/speech/route").POST;
const body = {
  audio_base64: "YWJj",
  alignment: {
    characters: ["a"],
    character_start_times_seconds: [0],
    character_end_times_seconds: [1],
  },
};
const request = (
  data: unknown = { text: "A force moves a box." },
  headers = { "Content-Type": "application/json" },
) =>
  new Request("http://localhost/api/tutor/speech", {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("ELEVENLABS_API_KEY", "test-key");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(body)),
  );
  ({ POST } = await import("@/app/api/tutor/speech/route"));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("ElevenLabs speech proxy", () => {
  it("returns timestamp audio with private server credentials and no-store", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(body);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain("/with-timestamps?output_format=mp3_44100_128");
    expect((init?.headers as Record<string, string>)["xi-api-key"]).toBe(
      "test-key",
    );
    expect(JSON.parse(init?.body as string).model_id).toBe("eleven_flash_v2_5");
  });
  it("accepts its advertised maximum in a fresh rate window", async () => {
    expect((await POST(request({ text: "x".repeat(12000) }))).status).toBe(200);
  });
  it("accepts complete lesson audio beyond three minutes", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        ...body,
        alignment: {
          ...body.alignment,
          character_start_times_seconds: [240],
          character_end_times_seconds: [241],
        },
      }),
    );
    expect((await POST(request({ text: "x".repeat(5000) }))).status).toBe(200);
  });
  it.each([
    null,
    {},
    { text: "" },
    { text: 8 },
    { text: "x".repeat(12001) },
    { text: "a\u0000" },
  ])("rejects invalid input without spending", async (data) => {
    expect((await POST(request(data))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects invalid JSON, unsupported types and both oversized body forms", async () => {
    expect(
      (
        await POST(
          new Request("http://localhost", {
            method: "POST",
            body: "{",
            headers: { "Content-Type": "application/json" },
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (await POST(request({}, { "Content-Type": "text/plain" }))).status,
    ).toBe(415);
    expect(
      (
        await POST(
          request({}, {
            "Content-Type": "application/json",
            "Content-Length": "24001",
          } as never),
        )
      ).status,
    ).toBe(413);
    expect((await POST(request({ text: "x".repeat(25000) }))).status).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not expose provider details or credentials", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("secret upstream diagnostic", { status: 401 }),
    );
    const result = await POST(request());
    expect(result.status).toBe(502);
    expect(await result.text()).not.toContain("secret");
  });
  it("returns configuration errors before provider calls", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    vi.stubEnv("Eleven_labs", "");
    expect((await POST(request())).status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    { ...body, audio_base64: "invalid!" },
    { ...body, alignment: null },
    {
      ...body,
      alignment: { ...body.alignment, character_end_times_seconds: [] },
    },
    {
      ...body,
      alignment: { ...body.alignment, character_start_times_seconds: [2] },
    },
  ])("rejects malformed provider audio/timestamps", async (value) => {
    vi.mocked(fetch).mockResolvedValue(Response.json(value));
    expect((await POST(request())).status).toBe(502);
  });
  it("caps total characters before provider spending", async () => {
    for (let i = 0; i < 3; i++)
      expect((await POST(request({ text: "x".repeat(4000) }))).status).toBe(
        200,
      );
    const response = await POST(request({ text: "one more" }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("bounds concurrent anonymous spending and releases failed slots", async () => {
    const resolvers: ((response: Response) => void)[] = [];
    vi.mocked(fetch).mockImplementation(
      () => new Promise((resolve) => resolvers.push(resolve)),
    );
    const pending = [POST(request()), POST(request()), POST(request())];
    while (resolvers.length < 3)
      await new Promise((resolve) => setTimeout(resolve, 1));
    expect((await POST(request())).status).toBe(429);
    resolvers.forEach((resolve) => resolve(Response.json(body)));
    await Promise.all(pending);
    vi.mocked(fetch).mockResolvedValue(Response.json(body));
    expect((await POST(request())).status).toBe(200);
  });
});
