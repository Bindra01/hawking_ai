# ElevenLabs voice for Physics Studio

The tutor uses ElevenLabs narration instead of browser speech synthesis. Typed questions remain available. Spoken questions use an explicit record/stop/review flow, not an always-on microphone.

## Configuration

Set `ELEVENLABS_API_KEY` on the server. The existing `Eleven_labs` secret name is also supported. The key needs Text to Speech and Speech to Text access. Never use a `NEXT_PUBLIC_` key.

Optional narration settings:
- `ELEVENLABS_VOICE_ID` (default George: `JBFqnCBsd6RMkjVDRZzb`).
- `ELEVENLABS_TTS_MODEL` (default `eleven_flash_v2_5`).

Transcription uses `scribe_v2` with English as the language hint. Restart the development server after adding or changing credentials. Production deployment requires the same server-only credentials; the session preview does not update production.

## Tap-to-speak

1. Create and play a lesson.
2. Select **Speak your question**. The tutor pauses before requesting microphone access.
3. Allow the microphone, then speak.
4. Select **Stop recording**. Recording also stops after 60 seconds.
5. Review or edit the transcript in the question field.
6. Select **Let’s work it out** to submit. Transcription never sends the question automatically.

Cancel discards the recording/transcription. Returning to the lesson or changing topics discards late results. Hiding the tab stops recording. Tracks stop on completion, cancellation, errors, and unmount. If permission is denied or recording fails, the student can type instead.

## Privacy and limits

The browser sends audio to the app's server, which forwards it to ElevenLabs for transcription. Audio and transcripts are not written to application storage or logged. ElevenLabs processing and retention remain subject to its account settings and terms; this app does not claim provider zero retention.

The upload endpoint accepts WebM, Ogg, MP4/M4A, MP3, and WAV audio, up to 4 MB. Questions are limited to 600 transcript characters. Per-process transcription limits are two concurrent requests and ten per minute. These are prototype guards, not distributed protection. Configure provider spending caps and shared abuse controls before public rollout.

## Playback

ElevenLabs timestamps anchor the whiteboard to actual audio playback. The session saves audio time alongside the teaching beat and visual progress. Pause, typed or spoken questions, rate changes, and return-to-lesson reuse cached audio instead of requesting new speech for each resume.

Browsers can still require a user click to enable audio. An autoplay failure displays a retry message rather than silently switching to a browser voice. Microphone capture requires HTTPS or localhost.
