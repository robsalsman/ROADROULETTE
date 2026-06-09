import OpenAI from "openai";

const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

export const hasOpenAIConfig = Boolean(
  apiKey && apiKey !== "replace_me" && baseURL,
);

export const openai = new OpenAI({
  apiKey: apiKey || "missing",
  baseURL,
});
