import OpenAI from "openai";

const isSetSecret = (value: string | undefined): value is string =>
  Boolean(value && value !== "replace_me");

const requestedProvider = process.env.AI_PROVIDER?.toLowerCase();
const veniceApiKey = process.env.VENICE_API_KEY;
const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

export const aiProvider =
  requestedProvider === "venice" || (!requestedProvider && isSetSecret(veniceApiKey))
    ? "venice"
    : "openai";

const apiKey = aiProvider === "venice" ? veniceApiKey : openaiApiKey;
const baseURL =
  aiProvider === "venice"
    ? (process.env.VENICE_BASE_URL ?? "https://api.venice.ai/api/v1")
    : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

export const hasAIConfig = Boolean(isSetSecret(apiKey) && baseURL);
export const hasOpenAIConfig = hasAIConfig;

export const openai = new OpenAI({
  apiKey: apiKey || "missing",
  baseURL,
});
