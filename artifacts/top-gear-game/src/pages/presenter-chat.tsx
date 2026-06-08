import { Link } from "wouter";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Trash2 } from "lucide-react";

type Presenter = "jeremy" | "richard" | "james";

interface PresenterInfo {
  slug: Presenter;
  name: string;
  avatar: string;
  blurb: string;
  greeting: string;
}

const PRESENTERS: PresenterInfo[] = [
  {
    slug: "jeremy",
    name: "Jeremy",
    avatar: "/images/jeremy.png",
    blurb: "Loud, opinionated, weirdly loyal.",
    greeting: "Right, you've texted me. This had better be good. What's going on?",
  },
  {
    slug: "richard",
    name: "Hammond",
    avatar: "/images/hammond.png",
    blurb: "Enthusiastic, warm, slightly accident-prone.",
    greeting: "Oh hello! Brilliant, a text. Go on then — what's happening with you?",
  },
  {
    slug: "james",
    name: "James",
    avatar: "/images/james.png",
    blurb: "Calm, dry, quietly knows everything.",
    greeting: "Ah, hello. I was just having a cup of tea. What's on your mind?",
  },
];

interface Msg {
  role: "user" | "assistant";
  content: string;
  ts: number;
}

const STORAGE_KEY = (slug: Presenter) => `tgrr-companion-${slug}`;
const ACTIVE_KEY = "tgrr-companion-active";

function loadThread(slug: Presenter): Msg[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(slug));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Msg[];
    }
  } catch { /* ignore */ }
  return [];
}

function getInitialActive(): Presenter {
  try {
    const a = localStorage.getItem(ACTIVE_KEY);
    if (a === "jeremy" || a === "richard" || a === "james") return a;
  } catch { /* ignore */ }
  return "jeremy";
}

type ThreadMap = Record<Presenter, Msg[]>;

export default function PresenterChat() {
  const [active, setActive] = useState<Presenter>(getInitialActive);
  // All threads held in one map keyed by presenter, so switching presenter never
  // reinterprets one presenter's messages under another's storage key.
  const [threads, setThreads] = useState<ThreadMap>(() => ({
    jeremy: loadThread("jeremy"),
    richard: loadThread("richard"),
    james: loadThread("james"),
  }));
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [draft, setDraft] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);

  const info = PRESENTERS.find((p) => p.slug === active)!;
  const messages = threads[active];

  // Persist active presenter.
  useEffect(() => {
    try { localStorage.setItem(ACTIVE_KEY, active); } catch { /* ignore */ }
  }, [active]);

  // Persist each thread under its own key whenever any thread changes.
  useEffect(() => {
    try {
      (Object.keys(threads) as Presenter[]).forEach((slug) => {
        localStorage.setItem(STORAGE_KEY(slug), JSON.stringify(threads[slug]));
      });
    } catch { /* ignore */ }
  }, [threads]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, draft]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busyRef.current) return;
    busyRef.current = true;
    setStreaming(true);
    setInput("");

    // Capture the presenter for the lifetime of this send; switching is blocked
    // while busy, but capturing keeps all state writes pinned to one thread.
    const presenter = active;
    const userMsg: Msg = { role: "user", content: text, ts: Date.now() };
    const history = [...threads[presenter], userMsg];
    setThreads((prev) => ({ ...prev, [presenter]: history }));
    setDraft("");

    try {
      const res = await fetch("/api/banter/companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presenter,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.body) throw new Error("no body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let reply = "";

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
            if (data.text) {
              reply += data.text;
              setDraft(reply);
            }
          } catch { /* skip */ }
        }
      }

      const finalReply = reply.trim();
      if (finalReply) {
        setThreads((prev) => ({
          ...prev,
          [presenter]: [...prev[presenter], { role: "assistant", content: finalReply, ts: Date.now() }],
        }));
      }
    } catch {
      setThreads((prev) => ({
        ...prev,
        [presenter]: [
          ...prev[presenter],
          { role: "assistant", content: "Sorry, my signal's gone. Try me again in a sec.", ts: Date.now() },
        ],
      }));
    } finally {
      setDraft("");
      setStreaming(false);
      busyRef.current = false;
    }
  }, [input, threads, active]);

  const clearThread = () => {
    if (busyRef.current) return;
    if (!window.confirm(`Clear your whole conversation with ${info.name}? This can't be undone.`)) return;
    setThreads((prev) => ({ ...prev, [active]: [] }));
  };

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-background">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-4 py-3 flex items-center gap-3">
        <Link href="/">
          <button className="text-muted-foreground hover:text-foreground transition-colors" data-testid="button-back-home">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <img src={info.avatar} alt={info.name} className="w-10 h-10 rounded-full object-cover border border-border" />
          <div className="min-w-0">
            <p className="font-bold leading-tight truncate">{info.name}</p>
            <p className="text-xs text-muted-foreground truncate">{streaming ? "typing…" : info.blurb}</p>
          </div>
        </div>
        <button
          onClick={clearThread}
          className="text-muted-foreground hover:text-destructive transition-colors p-2"
          title="Clear conversation"
          data-testid="button-clear-thread"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Presenter switcher */}
      <div className="shrink-0 flex gap-2 px-4 py-2 border-b border-border overflow-x-auto">
        {PRESENTERS.map((p) => (
          <button
            key={p.slug}
            onClick={() => !busyRef.current && setActive(p.slug)}
            disabled={busyRef.current}
            data-testid={`tab-presenter-${p.slug}`}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-bold whitespace-nowrap transition-colors disabled:opacity-50 ${
              active === p.slug
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <img src={p.avatar} alt={p.name} className="w-6 h-6 rounded-full object-cover" />
            {p.name}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {messages.length === 0 && !draft && (
          <div className="flex flex-col items-center justify-center text-center h-full gap-4 px-6">
            <img src={info.avatar} alt={info.name} className="w-20 h-20 rounded-full object-cover border-2 border-border" />
            <div>
              <p className="font-bold text-lg">Text {info.name}</p>
              <p className="text-sm text-muted-foreground max-w-xs mt-1">
                A private chat, just between you two. Talk about anything — it stays on this device and remembers your conversation until you clear it.
              </p>
            </div>
            <p className="text-sm italic text-foreground/80 max-w-sm">"{info.greeting}"</p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={`${m.ts}-${i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                data-testid={`message-${m.role}`}
                className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card border border-border rounded-bl-sm"
                }`}
              >
                {m.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {draft && (
          <div className="flex justify-start">
            <div className="max-w-[78%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed bg-card border border-border">
              {draft}
              <span className="animate-pulse">|</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border p-3 flex items-end gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={`Message ${info.name}…`}
          disabled={streaming}
          data-testid="input-message"
          className="flex-1"
        />
        <Button
          onClick={() => void send()}
          disabled={streaming || !input.trim()}
          size="icon"
          data-testid="button-send"
          className="shrink-0 h-10 w-10"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
