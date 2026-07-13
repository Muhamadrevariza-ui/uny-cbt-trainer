import OpenAI from "openai";

// Prefer Cerebras → fallback to OpenRouter → fallback error
const cerebrasKey = process.env.CEREBRAS_API_KEY;
const openrouterKey = process.env.OPENROUTER_API_KEY;

let baseURL: string;
let apiKey: string;
export let AI_MODEL: string;

if (cerebrasKey) {
  apiKey = cerebrasKey;
  baseURL = "https://api.cerebras.ai/v1";
  AI_MODEL = "gemma-4-31b";
} else if (openrouterKey) {
  apiKey = openrouterKey;
  baseURL = "https://openrouter.ai/api/v1";
  AI_MODEL = "google/gemini-2.5-flash";
} else {
  throw new Error("Set CEREBRAS_API_KEY or OPENROUTER_API_KEY.");
}

export const openai = new OpenAI({ apiKey, baseURL });
