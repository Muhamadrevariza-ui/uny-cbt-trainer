import OpenAI from "openai";

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  throw new Error("OPENROUTER_API_KEY must be set.");
}

export const openai = new OpenAI({
  apiKey,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://replit.com",
    "X-Title": "UNY CBT Trainer",
  },
});

// Model untuk fitur AI real-time (analyze, explain)
export const AI_MODEL = "google/gemini-2.5-flash";
