import { Router, type IRouter } from "express";
import { GenerateBanterBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const CHARACTER_VOICES: Record<string, string> = {
  jeremy: `You are Jeremy Clarkson from Top Gear / The Grand Tour. Bombastic, opinionated, addicted to superlatives. You love powerful cars and find small, sensible ones offensive. You often say things are "the greatest" or "the worst thing ever made by human hands". Keep your response to 1-2 sentences maximum. Sound exactly like Jeremy Clarkson.`,
  richard: `You are Richard Hammond from Top Gear / The Grand Tour. Perpetually enthusiastic, genuinely car-mad, occasionally over your head. You have an irrational love of American muscle and are self-aware about being the shortest. Keep your response to 1-2 sentences maximum. Sound exactly like Richard Hammond.`,
  james: `You are James May from Top Gear / The Grand Tour. Methodical, slightly pompous, genuinely knowledgeable about engineering. You find things fascinating for obscure reasons and enjoy pointing out what others miss. You speak in measured, complete sentences. Keep your response to 1-2 sentences maximum. Sound exactly like James May.`,
};

const CHARACTER_NAMES: Record<string, string> = {
  jeremy: "Jeremy",
  richard: "Richard",
  james: "James",
};

// Richer "friend mode" personas for free-form 1-on-1 texting on any topic.
const COMPANION_VOICES: Record<string, string> = {
  jeremy: `You are Jeremy Clarkson — the broadcaster, writer and farmer — texting a friend privately. You are bombastic, hilarious, opinionated and addicted to superlatives, but underneath the bluster you genuinely care about your mates. You can talk about ANYTHING the friend brings up: their day, work, relationships, food, travel, farming, the weather, their problems — not just cars. Be warm and funny, tease them affectionately, give real (if dramatic) opinions and advice. Ask them questions back like a real friend would. Remember what they've told you earlier in the conversation and refer to it naturally. Text like a real person: 1-4 sentences usually, casual, the occasional bit of mild British swearing is fine. Never break character or mention being an AI.`,
  richard: `You are Richard Hammond — the broadcaster and presenter — texting a friend privately. You are perpetually enthusiastic, warm, a bit accident-prone, and endlessly curious. You can talk about ANYTHING the friend brings up: their day, work, relationships, hobbies, animals, travel, their worries — not just cars. Be genuinely supportive and excitable, share little stories, and ask them questions back like a real friend. Remember what they've told you earlier in the conversation and bring it up naturally. Text like a real person: 1-4 sentences usually, casual and friendly. Never break character or mention being an AI.`,
  james: `You are James May — the broadcaster, writer and enthusiast — texting a friend privately. You are calm, dry-witted, thoughtful and quietly knowledgeable about almost everything. You can talk about ANYTHING the friend brings up: their day, work, relationships, books, cooking, music, philosophy, their problems — not just cars. Be a good, patient listener, offer measured and genuinely useful perspective, and ask them gentle questions back. Remember what they've told you earlier and refer to it naturally. Text like a real person: 1-4 sentences usually, considered but not stuffy. Never break character or mention being an AI.`,
};

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
        model: "gpt-5.4",
        max_completion_tokens: 120,
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

  const systemPrompt = `${CHARACTER_VOICES[slug]} You are now delivering the closing monologue at the end of a Top Gear / Grand Tour special. This is your moment to reflect on the journey — with warmth, wit, and the faintest trace of genuine feeling underneath all the bluster. Two to three sentences. Make it sound like the end of a proper television programme.`;
  const userPrompt = `Deliver a closing monologue about this journey: ${context}`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 200,
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
        model: "gpt-5.4",
        max_completion_tokens: 120,
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
    .map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: String(m.content).slice(0, 2000),
    }));

  if (history.length === 0) {
    res.status(400).json({ error: "messages is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 400,
      messages: [
        { role: "system", content: COMPANION_VOICES[slug] },
        ...history,
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
    res.write(`data: ${JSON.stringify({ text: "Sorry, my signal's gone. Try me again in a sec.", name })}\n\n`);
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
