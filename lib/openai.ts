import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error(
        "OPENAI_API_KEY is not set. Add it to your .env.local file to enable problem generation."
      );
    }
    _client = new OpenAI({ apiKey: key });
  }
  return _client;
}
