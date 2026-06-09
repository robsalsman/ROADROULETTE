import { Router, type IRouter } from "express";
import { GenerateBanterBody } from "@workspace/api-zod";
import { aiProvider, hasAIConfig, openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const DEFAULT_TEXT_MODEL = aiProvider === "venice" ? "venice-uncensored" : "gpt-4o-mini";
const TEXT_MODEL =
  process.env.AI_PRESENTER_MODEL ??
  process.env.VENICE_MODEL ??
  process.env.OPENAI_MODEL ??
  DEFAULT_TEXT_MODEL;
const COMPANION_FALLBACK = "Sorry, my signal's gone. Try me again in a sec.";
const PROVIDER_OPTIONS =
  aiProvider === "venice"
    ? {
        venice_parameters: {
          include_venice_system_prompt: false,
        },
      }
    : {};
const IDENTITY_LEAK_PATTERN = /\b(venice|uncensored|ai model|language model|chatbot|virtual assistant|helpful assistant)\b/i;

const CHARACTER_VOICES: Record<string, string> = {
  jeremy: `You are Jeremy, a fictional bombastic British motoring-show presenter in a road-trip game. Use huge opinions, theatrical certainty, impatience with sensible cars, and affectionate insults about machinery. Prefer punchy exaggeration, speed, noise, disaster, and "this is either brilliant or catastrophic" energy. Never sound like a generic mechanic: open with a dramatic judgment, then give one practical instruction. Keep your response to 1-2 sentences maximum.`,
  richard: `You are Hammond, a fictional enthusiastic British motoring-show presenter in a road-trip game. Be warm, excitable, car-mad, slightly accident-prone, and weirdly fond of American muscle. React like every terrible idea might be brilliant if approached with enough optimism. Never sound like a generic mechanic: open with a breathless phrase like "Brilliant, terrifying, but brilliant" or "Right, this is exciting and bad", then give one practical instruction. Keep your response to 1-2 sentences maximum.`,
  james: `You are James, a fictional precise British motoring-show presenter in a road-trip game. Be measured, dry, technically minded, quietly amused, and mildly exasperated by chaos. Offer exact little observations, engineering logic, and understated jokes. Never sound like a generic mechanic: open with "Technically," or "First," and include one dry aside before one sensible instruction. Keep your response to 1-2 sentences maximum.`,
};

const CHARACTER_NAMES: Record<string, string> = {
  jeremy: "Jeremy",
  richard: "Hammond",
  james: "James",
};

// Richer "friend mode" personas for free-form 1-on-1 texting on any topic.
const COMPANION_VOICES: Record<string, string> = {
  jeremy: `You are Jeremy, a fictional blustery British motoring-game presenter texting the player privately. Your voice is loud, funny, theatrical, opinionated, impatient with dullness, and secretly loyal. Talk about anything the player brings up, not just cars. Tease affectionately, give dramatic but useful advice, ask natural follow-up questions, and remember earlier details. A Jeremy reply should feel oversized: quick verdict, ridiculous comparison, then useful direction. Use short casual texts with occasional mild British swearing. Never mention being an AI or a real person.`,
  richard: `You are Hammond, a fictional enthusiastic British motoring-game presenter texting the player privately. Your voice is warm, energetic, curious, supportive, a bit overexcited, and prone to treating danger as an adventure with a seatbelt. Talk about anything the player brings up, not just cars. Encourage them, ask friendly follow-up questions, and make small self-deprecating jokes about things going sideways. A Hammond reply should feel eager: optimistic gasp, supportive nudge, then one practical move. Prefer phrases like "Brilliant, terrifying, but brilliant" or "Right, this is exciting and bad." Never mention being an AI or a real person.`,
  james: `You are James, a fictional careful British motoring-game presenter texting the player privately. Your voice is calm, dry, thoughtful, technically curious, and quietly funny. Talk about anything the player brings up, not just cars. Listen patiently, offer measured perspective, ask gentle follow-up questions, and make precise observations without becoming stiff. A James reply should feel exact: calm diagnosis, dry aside, then one sensible instruction. Prefer starting with "Technically," "First," or "In mechanical terms," and include a small dry aside. Never mention being an AI or a real person.`,
};

const COMPANION_RECOVERY: Record<string, string> = {
  jeremy: "It's Jeremy. Obviously. Now, stop interrogating the telephone and tell me what catastrophic thing the car has done.",
  richard: "It's Hammond! Brilliant, the phone works. What's happening, and is anything currently on fire?",
  james: "It's James. The small glowing rectangle appears to be functioning, so let's use it wisely. What's the situation?",
};
const IDENTITY_QUESTION_PATTERN = /\b(who'?s there|who are you|who is this|are you there)\b|^(jeremy|richard|hammond|james)\??$/i;

// ── Generate banter (SSE) ─────────────────────────────────────────────────────
router.post("/banter/generate", async (req, res): Promise<void> => {
  const parsed = GenerateBanterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { context, characters, tone } = parsed.data;
  const activeChars = (characters ?? ["jeremy", "richard", "james"]).filter(
    (c: string) => CHARACTER_VOICES[c]
  );

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const toneInstruction = tone ? `The tone of the situation is: ${tone}.` : "";

  for (const charSlug of activeChars) {
    const systemPrompt = CHARACTER_VOICES[charSlug];
    const userPrompt = `Situation: ${context}. ${toneInstruction} React to this in character. One or two sentences only. Be funny, be British, be yourself.`;

    try {
      const stream = await openai.chat.completions.create({
      model: TEXT_MODEL,
      max_completion_tokens: 120,
      temperature: 0.9,
      ...PROVIDER_OPTIONS,
      messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      });

      let line = "";
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) line += content;
      }

      res.write(
        `data: ${JSON.stringify({ character: charSlug, name: CHARACTER_NAMES[charSlug], line: line.trim() })}\n\n`
      );
    } catch {
      res.write(
        `data: ${JSON.stringify({ character: charSlug, name: CHARACTER_NAMES[charSlug], line: "..." })}\n\n`
      );
    }
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

// ── Generate closing monologue (SSE, streams text tokens) ─────────────────────
router.post("/banter/monologue", async (req, res): Promise<void> => {
  const { characterSlug, context } = req.body as { characterSlug?: string; context?: string };

  if (!context) {
    res.status(400).json({ error: "context is required" });
    return;
  }

  const slug = characterSlug && CHARACTER_VOICES[characterSlug] ? characterSlug : "jeremy";
  const name = CHARACTER_NAMES[slug];

  const systemPrompt = `${CHARACTER_VOICES[slug]} You are now delivering the closing monologue at the end of a fictional motoring road-trip special. This is your moment to reflect on the journey with warmth, wit, and a faint trace of genuine feeling underneath the chaos. Two to three sentences. Make it sound like the end of a proper television programme.`;
  const userPrompt = `Deliver a closing monologue about this journey: ${context}`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await openai.chat.completions.create({
      model: TEXT_MODEL,
      max_completion_tokens: 200,
      temperature: 0.9,
      ...PROVIDER_OPTIONS,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ text: content, name })}\n\n`);
      }
    }
  } catch {
    res.write(`data: ${JSON.stringify({ text: "It was, on the whole, an adventure.", name })}\n\n`);
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

// ── Group chat: player sends, other two respond (SSE) ─────────────────────────
router.post("/banter/chat", async (req, res): Promise<void> => {
  const { message, playerCharacter, playerName: playerNameRaw, context } = req.body as {
    message?: string;
    playerCharacter?: string;
    playerName?: string;
    context?: string;
  };

  if (!message) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const allChars = ["jeremy", "richard", "james"];
  const responders = allChars.filter(c => c !== playerCharacter && CHARACTER_VOICES[c]);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const isPresenter = playerCharacter ? !!CHARACTER_NAMES[playerCharacter] : false;
  const playerName = (playerNameRaw && playerNameRaw.trim())
    ? playerNameRaw.trim().slice(0, 40)
    : (playerCharacter ? (CHARACTER_NAMES[playerCharacter] ?? playerCharacter) : "Player");
  const guestNote = isPresenter
    ? ""
    : `${playerName} is a guest who has joined you three on this adventure as a fourth driver — treat them as one of the gang. `;
  const ctxStr = context ? `Current situation: ${context} ` : "";

  for (const charSlug of responders) {
    const systemPrompt = CHARACTER_VOICES[charSlug];
    const userPrompt = `${ctxStr}${guestNote}${playerName} just sent this group text message: "${message}". Respond in character — 1-2 sentences, funny, British, very you. Address them by name if it feels natural. Don't repeat what they said.`;

    try {
      const stream = await openai.chat.completions.create({
        model: TEXT_MODEL,
        max_completion_tokens: 120,
        temperature: 0.9,
        ...PROVIDER_OPTIONS,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      });

      let line = "";
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) line += content;
      }

      res.write(
        `data: ${JSON.stringify({ character: charSlug, name: CHARACTER_NAMES[charSlug], line: line.trim() })}\n\n`
      );
    } catch {
      res.write(
        `data: ${JSON.stringify({ character: charSlug, name: CHARACTER_NAMES[charSlug], line: "..." })}\n\n`
      );
    }
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

// ── 1-on-1 companion chat: text a presenter about anything (SSE tokens) ────────
router.post("/banter/companion", async (req, res): Promise<void> => {
  const { presenter, messages } = req.body as {
    presenter?: string;
    messages?: Array<{ role?: string; content?: string }>;
  };

  const slug = presenter && COMPANION_VOICES[presenter] ? presenter : "jeremy";
  const name = CHARACTER_NAMES[slug];

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages is required" });
    return;
  }

  // Keep the last 30 turns for continuity while bounding token usage.
  const history = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-30)
    .filter((m) => m.role !== "assistant" || !IDENTITY_LEAK_PATTERN.test(m.content ?? ""))
    .map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: String(m.content).slice(0, 2000),
    }));

  if (history.length === 0) {
    res.status(400).json({ error: "messages is required" });
    return;
  }

  const latestUserMessage = [...history].reverse().find((message) => message.role === "user")?.content ?? "";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  if (IDENTITY_QUESTION_PATTERN.test(latestUserMessage.trim())) {
    res.write(`data: ${JSON.stringify({ text: COMPANION_RECOVERY[slug], name })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
    return;
  }

  try {
    if (!hasAIConfig) {
      throw new Error(
        aiProvider === "venice"
          ? "VENICE_API_KEY must be set for presenter chat"
          : "AI_INTEGRATIONS_OPENAI_API_KEY and AI_INTEGRATIONS_OPENAI_BASE_URL must be set for presenter chat",
      );
    }

    const stream = await openai.chat.completions.create({
      model: TEXT_MODEL,
      max_completion_tokens: 220,
      temperature: 0.9,
      ...PROVIDER_OPTIONS,
      messages: [
        {
          role: "system",
          content: `${COMPANION_VOICES[slug]} Keep each reply short, funny, and game-like: 1-3 sentences, like quick road-trip radio banter. Make the speaker obvious from voice alone; do not answer in a neutral assistant style.`,
        },
        {
          role: "user",
          content: `You are texting as ${name}. If asked who you are, answer as ${name}; never identify as Venice, an AI model, a chatbot, or an assistant.`,
        },
        ...history,
      ],
      stream: true,
    });

    let reply = "";
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        reply += content;
      }
    }

    const finalReply = reply.trim();
    if (!finalReply || IDENTITY_LEAK_PATTERN.test(finalReply)) {
      logger.warn(
        {
          provider: aiProvider,
          presenter: slug,
          model: TEXT_MODEL,
          leakedReply: finalReply,
        },
        "Presenter companion response failed identity guard",
      );
      res.write(`data: ${JSON.stringify({ text: COMPANION_RECOVERY[slug], name })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({ text: finalReply, name })}\n\n`);
    }
  } catch (err) {
    const error = err as {
      status?: number;
      code?: string;
      type?: string;
      message?: string;
    };
    logger.error(
      {
        err,
        provider: aiProvider,
        presenter: slug,
        model: TEXT_MODEL,
        openaiStatus: error.status,
        openaiCode: error.code,
        openaiType: error.type,
        openaiMessage: error.message,
        hasAIConfig,
      },
      "Presenter companion AI request failed",
    );
    res.write(`data: ${JSON.stringify({ text: COMPANION_FALLBACK, name })}\n\n`);
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
