# Physics Studio prototype

Open `/tutor` for the public, session-only physics tutor. Existing learning, login, and admin routes stay unchanged. The tutor needs no database or Supabase credentials.

## Run

```sh
npm ci
# Set ANTHROPIC_API_KEY in your shell or .env.local (server only).
npm run dev -- --hostname 0.0.0.0
```

Optional: `ANTHROPIC_MODEL` overrides `claude-sonnet-4-6`. For a proxied development preview, set `NEXT_ALLOWED_DEV_ORIGINS` to the exact preview hostname (comma-separated for multiple hosts). Never prefix the API key with `NEXT_PUBLIC_`.

```sh
npx vitest run
npx tsc --noEmit
npm run build
```

## Lesson and question flow

1. Enter any physics topic or choose a seed topic. Claude generates JSON beats with 240–280 spoken words and separate, narrated visual marks.
2. Press Play after generation. This explicit click enables audio on browsers that block asynchronous autoplay.
3. The speech adapter starts progressive SVG drawing only when speech starts. Word events anchor drawing timing. Elapsed-time estimates provide a fallback when the browser does not emit boundaries.
4. Typing a question stops narration and freezes the lesson. The session stores its beat, speech offset, and visual progress.
5. Submit the question. A separate answer board uses the same renderer and speech adapter. The main lesson checkpoint stays immutable.
6. A question during an answer creates another saved checkpoint. Answers unwind in reverse order, then return to the main lesson.
7. The answer ends and restores the main board and checkpoint automatically. Cancel, skip answer, retry, pause, rate changes, and new lessons invalidate old speech callbacks and requests.

Changing sections creates a fresh board. Equation terms share a row, so the formula accumulates while each term is explained. Shapes are restricted primitives; model output never becomes raw HTML or SVG markup.

## Browser limitations

Use a browser with an installed English Web Speech voice. No paid TTS, microphone, or audio/video export is used. Voice quality and boundary support vary by browser and operating system. Missing voices and blocked playback produce a recoverable error; the app does not silently draw an entire lesson without speech.

Web Speech does not expose sample-accurate playback position. A cancelled utterance resumes at its latest word checkpoint, not at the interrupted syllable. Completed beats never replay, and the board does not rewind. The interrupted word can repeat; browsers without word events use an estimated word checkpoint. Exact sample-level resume cannot be guaranteed with this browser API. The adapter in `lib/tutor/speech.ts` isolates this limitation for a future timestamped speech implementation.

Lessons target about two minutes at the default 0.9× pace; actual duration depends on the selected browser voice. The current sentence appears as a caption for accessibility, separate from progressively drawn board content.

## Server limits

`POST /api/tutor` accepts `{topic, question?, context?}` and returns `{title, beats}`. It validates request size, output schema, coordinate bounds, section continuity, and narration length. A malformed lesson gets one repair attempt within the same 80-second deadline. Responses and errors are not cached. The browser requests `Accept: application/x-tutor-stream+json`: this mode flushes JSON whitespace immediately and every five seconds so preview proxies do not close an idle connection while Claude works. The final body contains the lesson or a safe `{error}` object; after headers are sent, errors use HTTP 200 and callers must check `error`. Requests without that Accept header retain ordinary JSON/status behavior. Provider responses, prompts, and credentials are not logged.

The anonymous endpoint has an in-process guard of two concurrent requests and ten requests per minute. This is **not distributed abuse protection**: serverless instances have separate budgets. Before a broad public launch, add a shared limiter and configure a provider spend cap. Do not treat this prototype as an unlimited public service.

## Verification scope

Unit tests cover generation with mocked provider responses and playback with a fake speech driver. One real Claude generation verified provider connectivity and returned Work and Energy (18 beats, 276 words). That response exposed complete equations inside text beats. The final validator now rejects these and requests a repair; the stricter final prompt and validator were tested with fixtures, not another paid call. Other topic tests must use fixtures unless additional live calls are explicitly authorized. Browser speech testing requires an operating-system voice; mocked speech cannot establish perceived audio/visual synchronization.

### Generation reliability follow-up

Whole equations are normalized into adjacent term beats before rendering. The original model response keeps its 12–36 beat budget; normalization can increase visual beat count without adding spoken words. Main lessons still target 240–280 words, but validation accepts up to 340 to avoid discarding useful lessons for small duration overruns. Actual lessons can exceed two minutes. Safe constraint diagnostics contain no generated lesson content. Public streamed generation was verified with a 321-word Work lesson after 49.9 seconds.

### Energy duration correction

Duration targets must not act as exact schema limits. Generated lessons target 240–280 words, but production preparation accepts 120–600 words (answers: 20–180). Shape, layout, per-beat, response-byte, and original beat-count limits remain enforced. The active lesson displays an approximate duration based on narration length and selected pace. Lessons can exceed two minutes; actual voice timing varies.
