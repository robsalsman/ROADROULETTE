import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { EventChoice, RoadEventTemplate } from "@/data/roadEvents";
import { inventoryItemName } from "@/data/campaign";

interface ChatMessage {
  id: string;
  character: string;
  name: string;
  text: string;
  isPlayer: boolean;
  isTyping?: boolean;
}

interface ChatStats {
  condition: number;
  fuel: number;
  progressPct: number;
}

interface GroupChatProps {
  playerCharacter: string;
  playerName: string;
  gameContext?: string;
  stats?: ChatStats;
  reactTo?: { id: string; context: string; tone?: string } | null;
  adventureEvent?: RoadEventTemplate | null;
  resolvingAdventure?: boolean;
  saveId?: string | number;
  onAdventureChoice?: (choice: EventChoice) => void;
  getAdventureChoiceDisabledReason?: (choice: EventChoice) => string | null;
  onPlayerMessage?: () => void;
}

const AVATARS: Record<string, string> = {
  jeremy: "/images/jeremy.png",
  richard: "/images/hammond.png",
  james: "/images/james.png",
};

const CHAR_COLORS: Record<string, string> = {
  jeremy: "border-orange-500/60 bg-orange-500/10",
  richard: "border-blue-500/60 bg-blue-500/10",
  james: "border-green-500/60 bg-green-500/10",
};

const RISK_COLORS: Record<EventChoice["risk"], string> = {
  safe: "border-blue-500/50 hover:border-blue-400 hover:bg-blue-500/10",
  risky: "border-amber-500/50 hover:border-amber-400 hover:bg-amber-500/10",
  mad: "border-red-500/50 hover:border-red-400 hover:bg-red-500/10",
};

const RISK_BADGE: Record<EventChoice["risk"], string> = {
  safe: "bg-blue-500/20 text-blue-300",
  risky: "bg-amber-500/20 text-amber-300",
  mad: "bg-red-500/20 text-red-300",
};

const PRESENTER_NAMES: Record<string, string> = {
  jeremy: "Jeremy",
  richard: "Hammond",
  james: "James",
};

const ALL_CHARS = ["jeremy", "richard", "james"];
const TONES = ["smug", "competitive", "sarcastic", "excited", "exasperated"];

// Spontaneous "sparks" the characters riff on when nothing is happening.
const SPARKS = [
  "Make a spontaneous idle group-chat remark — a wager, a wind-up, or an absurd observation about the journey. Keep it short.",
  "Propose a ridiculous bet about who will break down or arrive last. Keep it short.",
  "Brag about your own car and insult one of the others' choices. Keep it short.",
  "Complain about something trivial and British in the middle of nowhere. Keep it short.",
  "Make a wildly overconfident prediction about the rest of the trip. Keep it short.",
  "Wind up one of the other two about their driving. Keep it short.",
];

// Generic cheeky player reply options (the player IS one of the hosts).
const GENERIC_OPTIONS = [
  "I reckon my car will outlast both of yours. £50 says so.",
  "This is, without question, the finest machine ever made.",
  "Has anyone actually looked at a map recently?",
  "I'm not lost. The road is simply wrong.",
  "Whose idea was this, exactly?",
  "I've decided to name my car. It's called 'Victory'.",
  "We should absolutely race to the next checkpoint.",
  "Anyone else's car making that noise? No? Just me, then.",
  "I may have made a small and expensive mistake.",
  "I refuse to stop and ask for directions. On principle.",
  "Last one to the top buys dinner.",
  "Honestly, how hard can it possibly be?",
  "I'm going to need a bigger engine. And a smaller conscience.",
  "Right, that's it, I'm overtaking.",
];

const STORAGE_KEY = (id: string | number) => `tgrr-groupchat-${id}`;

function choicePromptFor(event: RoadEventTemplate) {
  if (event.type === "navigation") return "Choose the route";
  if (event.type === "forward") return "Choose the next push";
  return "Handle the road event";
}

const WELCOME: ChatMessage = {
  id: "welcome",
  character: "james",
  name: "James",
  text: "Right then. Group text is active. Do try to keep the messages to actual emergencies and not just pictures of interesting clouds.",
  isPlayer: false,
};

function loadMessages(saveId?: string | number): ChatMessage[] {
  if (saveId == null) return [WELCOME];
  try {
    const raw = localStorage.getItem(STORAGE_KEY(saveId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Never restore stale typing indicators.
        return (parsed as ChatMessage[]).filter((m) => !m.isTyping);
      }
    }
  } catch { /* ignore */ }
  return [WELCOME];
}

function pickOptions(stats?: ChatStats): string[] {
  const pool = [...GENERIC_OPTIONS];
  const situational: string[] = [];
  if (stats) {
    if (stats.condition < 35) situational.push("Something just fell off. Possibly important.");
    if (stats.fuel < 25) situational.push("Are we... are we actually going to run out of fuel?");
    if (stats.progressPct > 70) situational.push("We're genuinely going to make it, aren't we?");
    if (stats.condition > 80 && stats.fuel > 60) situational.push("This is going suspiciously well.");
  }
  // shuffle pool
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const generic = pool.slice(0, situational.length > 0 ? 3 : 4);
  return [...situational.slice(0, 1), ...generic];
}

export default function GroupChat({
  playerCharacter,
  playerName,
  gameContext,
  stats,
  reactTo,
  adventureEvent,
  resolvingAdventure = false,
  saveId,
  onAdventureChoice,
  getAdventureChoiceDisabledReason,
  onPlayerMessage,
}: GroupChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessages(saveId));
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [loadedSaveId, setLoadedSaveId] = useState(saveId);
  const [introducedEventId, setIntroducedEventId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Latest values held in refs so the proactive timer stays stable.
  const ctxRef = useRef(gameContext ?? "");
  const playerCharRef = useRef(playerCharacter);
  const playerNameRef = useRef(playerName);
  const busyRef = useRef(false);
  const onPlayerMessageRef = useRef(onPlayerMessage);
  useEffect(() => { onPlayerMessageRef.current = onPlayerMessage; }, [onPlayerMessage]);
  const lastReactId = useRef<string | null>(null);
  const pendingReactRef = useRef<{ id: string; context: string; tone?: string } | null>(null);
  const drainReactRef = useRef<() => void>(() => {});

  useEffect(() => { ctxRef.current = gameContext ?? ""; }, [gameContext]);
  useEffect(() => { playerCharRef.current = playerCharacter; }, [playerCharacter]);
  useEffect(() => { playerNameRef.current = playerName; }, [playerName]);

  // When the active save changes in place (without a full remount), synchronously
  // reset chat state so one mission's history can never be written under another
  // save's storage key. This runs during render before any persist effect.
  if (saveId !== loadedSaveId) {
    setLoadedSaveId(saveId);
    setMessages(loadMessages(saveId));
    setInput("");
    setSending(false);
    setIntroducedEventId(null);
    lastReactId.current = null;
    pendingReactRef.current = null;
    busyRef.current = false;
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Persist the running conversation per save so it survives reloads / tab
  // switches and stays continuous for the whole mission.
  useEffect(() => {
    if (saveId == null) return;
    try {
      const persistable = messages.filter((m) => !m.isTyping).slice(-80);
      localStorage.setItem(STORAGE_KEY(saveId), JSON.stringify(persistable));
    } catch { /* ignore */ }
  }, [messages, saveId]);

  const respondersFor = (player: string) =>
    ALL_CHARS.filter((c) => c !== player);

  useEffect(() => {
    if (!adventureEvent || introducedEventId === adventureEvent.id) return;
    setIntroducedEventId(adventureEvent.id);
    const speakers = adventureEvent.choices.map((choice, index) => (
      choice.proposer ?? (["jeremy", "richard", "james"][index] as "jeremy" | "richard" | "james")
    ));
    const intro: ChatMessage[] = [
      {
        id: `event-${adventureEvent.id}`,
        character: "player",
        name: "Road",
        text: adventureEvent.situation,
        isPlayer: false,
      },
      ...adventureEvent.choices.map((choice, index) => {
        const character = speakers[index] ?? "james";
        return {
          id: `event-${adventureEvent.id}-${choice.id}`,
          character,
          name: PRESENTER_NAMES[character] ?? character,
          text: choice.flavor,
          isPlayer: false,
        };
      }),
    ];
    setMessages((prev) => [...prev.slice(-50), ...intro]);
  }, [adventureEvent, introducedEventId]);

  // Shared SSE streamer for both /banter/chat and /banter/generate.
  const streamBanter = useCallback(
    async (endpoint: string, body: unknown, involved: string[]) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setSending(true);

      const typingMsgs: ChatMessage[] = involved.map((c) => ({
        id: `typing-${c}`,
        character: c,
        name: c.charAt(0).toUpperCase() + c.slice(1),
        text: "...",
        isPlayer: false,
        isTyping: true,
      }));
      setMessages((prev) => [...prev.slice(-50), ...typingMsgs]);

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.body) throw new Error("no body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) continue;
            try {
              const data = JSON.parse(line.slice(5).trim());
              if (data.done) continue;
              if (data.character && data.line) {
                setMessages((prev) => {
                  const withoutTyping = prev.filter(
                    (m) => m.id !== `typing-${data.character}`,
                  );
                  return [
                    ...withoutTyping.slice(-50),
                    {
                      id: `resp-${data.character}-${Date.now()}-${Math.random()}`,
                      character: data.character,
                      name: data.name,
                      text: data.line,
                      isPlayer: false,
                    },
                  ];
                });
              }
            } catch {
              /* skip malformed */
            }
          }
        }
      } catch {
        /* network error — drop typing below */
      } finally {
        setMessages((prev) => prev.filter((m) => !m.isTyping));
        busyRef.current = false;
        setSending(false);
        // A queued decision reaction may have arrived while we were busy.
        drainReactRef.current();
      }
    },
    [],
  );

  // Deliver a queued decision/event reaction once the streamer is free.
  const drainReact = useCallback(() => {
    const pending = pendingReactRef.current;
    if (!pending || busyRef.current) return;
    pendingReactRef.current = null;
    lastReactId.current = pending.id;
    const responders = respondersFor(playerCharRef.current).slice(0, 1);
    void streamBanter(
      "/api/banter/generate",
      {
        context: `${ctxRef.current} ${pending.context} Give a fresh, unique reaction — do not repeat earlier comments.`,
        characters: responders,
        tone: pending.tone ?? "reactive",
      },
      responders,
    );
  }, [streamBanter]);

  useEffect(() => { drainReactRef.current = drainReact; }, [drainReact]);

  // Player sends a message — from a tapped option or free text.
  const sendPlayerMessage = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || busyRef.current) return;
      const player = playerCharRef.current;
      setMessages((prev) => [
        ...prev.slice(-50),
        {
          id: `player-${Date.now()}`,
          character: player,
          name: playerNameRef.current,
          text,
          isPlayer: true,
        },
      ]);
      onPlayerMessageRef.current?.();
      void streamBanter(
        "/api/banter/chat",
        { message: text, playerCharacter: player, playerName: playerNameRef.current, context: ctxRef.current },
        respondersFor(player),
      );
    },
    [streamBanter],
  );

  // Proactive, character-initiated chatter on a timer.
  useEffect(() => {
    const fireChatter = () => {
      if (busyRef.current || document.hidden || adventureEvent) return;
      const responders = respondersFor(playerCharRef.current);
      if (responders.length === 0) return;
      // 1 speaker most of the time, occasionally 2 for a back-and-forth.
      const shuffled = [...responders].sort(() => Math.random() - 0.5);
      const speakers = Math.random() < 0.3 ? shuffled.slice(0, 2) : shuffled.slice(0, 1);
      const spark = SPARKS[Math.floor(Math.random() * SPARKS.length)];
      const tone = TONES[Math.floor(Math.random() * TONES.length)];
      void streamBanter(
        "/api/banter/generate",
        { context: `${ctxRef.current} ${spark}`, characters: speakers, tone },
        speakers,
      );
    };

    const kickoff = setTimeout(fireChatter, 240000);
    const interval = setInterval(fireChatter, 240000);
    return () => {
      clearTimeout(kickoff);
      clearInterval(interval);
    };
  }, [streamBanter, adventureEvent]);

  // React to a specific decision/event/drive from the game. Queue it and drain
  // immediately if free, otherwise the streamer drains it when it finishes.
  useEffect(() => {
    if (!reactTo || reactTo.id === lastReactId.current) return;
    pendingReactRef.current = reactTo;
    drainReact();
  }, [reactTo, drainReact]);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="shrink-0 border-b border-border px-4 py-3 flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-primary" />
        <span className="text-sm font-bold uppercase tracking-wide">Group Chat</span>
        <span className="text-xs text-muted-foreground ml-auto">WhatsApp for Idiots</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-2 ${msg.isPlayer ? "flex-row-reverse" : "flex-row"}`}
            >
              {AVATARS[msg.character] ? (
                <img
                  src={AVATARS[msg.character]}
                  alt={msg.name}
                  className="w-8 h-8 rounded-full border border-border object-cover shrink-0 self-end"
                />
              ) : (
                <div className="w-8 h-8 rounded-full border border-amber-500 bg-amber-500/20 text-amber-300 text-xs font-black flex items-center justify-center shrink-0 self-end">
                  {(msg.name || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div className={`max-w-[80%] ${msg.isPlayer ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                <span className="text-[10px] font-bold uppercase text-muted-foreground px-1">{msg.name}</span>
                <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed border ${
                  msg.isPlayer
                    ? "bg-primary/20 border-primary/40 text-foreground rounded-br-none"
                    : `${CHAR_COLORS[msg.character] ?? "border-border bg-card"} text-foreground rounded-bl-none`
                }`}>
                  {msg.isTyping ? (
                    <span className="flex gap-1 items-center py-0.5">
                      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:300ms]" />
                    </span>
                  ) : msg.text}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {adventureEvent && (
          <motion.div
            key={`choices-${adventureEvent.id}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-primary/40 bg-primary/5 p-3 space-y-2"
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">{choicePromptFor(adventureEvent)}</p>
              <h3 className="text-sm font-black uppercase leading-tight">{adventureEvent.title}</h3>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {adventureEvent.choices.map((choice, index) => {
                const presenter = choice.proposer ?? (["jeremy", "richard", "james"][index] as "jeremy" | "richard" | "james");
                const disabledReason = getAdventureChoiceDisabledReason?.(choice) ?? null;
                const effectBits = [
                  choice.timeEffectHours != null ? `${choice.timeEffectHours}h` : null,
                  choice.distanceEffect ? `${choice.distanceEffect > 0 ? "+" : ""}${choice.distanceEffect}km` : null,
                  choice.fundsEffect ? `${choice.fundsEffect > 0 ? "+" : ""}£${choice.fundsEffect}` : null,
                  choice.damageEffect ? `${choice.damageEffect > 0 ? "+" : ""}${choice.damageEffect}% car` : null,
                  choice.fuelEffect ? `${choice.fuelEffect > 0 ? "+" : ""}${choice.fuelEffect}% fuel` : null,
                  choice.foodEffect ? `${choice.foodEffect > 0 ? "+" : ""}${choice.foodEffect} food` : null,
                  choice.partsEffect ? `${choice.partsEffect > 0 ? "+" : ""}${choice.partsEffect} parts` : null,
                  choice.itemRewardId ? `gain ${inventoryItemName(choice.itemRewardId)}` : null,
                  choice.consumedItemId ? `use ${inventoryItemName(choice.consumedItemId)}` : null,
                ].filter(Boolean);
                return (
                  <button
                    key={choice.id}
                    disabled={resolvingAdventure || sending || !!disabledReason}
                    onClick={() => onAdventureChoice?.(choice)}
                    className={`w-full text-left px-3 py-2 rounded-lg border bg-card/70 text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed ${RISK_COLORS[choice.risk]}`}
                  >
                    <div className="flex items-start gap-2">
                      {AVATARS[presenter] && (
                        <img
                          src={AVATARS[presenter]}
                          alt={PRESENTER_NAMES[presenter]}
                          className="w-7 h-7 rounded-full border border-border object-cover shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold leading-snug">{choice.label}</p>
                          <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${RISK_BADGE[choice.risk]}`}>
                            {choice.risk}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-[10px] mt-0.5">
                          {disabledReason ?? choice.flavor}
                        </p>
                        {effectBits.length > 0 && (
                          <p className="mt-1 text-[9px] font-mono uppercase tracking-wide text-muted-foreground/80">
                            {effectBits.join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {resolvingAdventure && (
              <p className="text-center text-xs text-muted-foreground animate-pulse">The road is answering...</p>
            )}
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Optional free text. Main gameplay choices live in the adventure card above. */}
      <div className="shrink-0 border-t border-border px-3 py-3 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">
          {adventureEvent ? "Choose a move above to continue" : sending ? "Sending..." : "Optional group message"}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const text = input;
            setInput("");
            sendPlayerMessage(text);
          }}
          className="flex items-center gap-2 pt-1"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Or type your own message…"
            disabled={sending || !!adventureEvent}
            data-testid="input-groupchat"
            className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-border bg-background text-xs leading-snug outline-none focus:border-primary/60 disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={sending || !!adventureEvent || !input.trim()}
            data-testid="button-groupchat-send"
            className="shrink-0 flex items-center justify-center w-9 h-9 rounded-xl border border-primary/40 bg-primary/20 text-primary hover:bg-primary/30 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
