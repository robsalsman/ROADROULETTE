import { Link, useParams } from "wouter";
import {
  useGetSave, getGetSaveQueryKey,
  useListSaveEvents, getListSaveEventsQueryKey,
  useGetCharacter, getGetCharacterQueryKey,
  useGetMission, getGetMissionQueryKey,
  useListLeaderboard, getListLeaderboardQueryKey,
  useCreateLeaderboardEntry,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trophy, AlertOctagon, RotateCcw, Home, Medal, Crown, Send } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

export default function Results() {
  const { saveId } = useParams();
  const [monologue, setMonologue] = useState("");
  const [monologueName, setMonologueName] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const monologueStarted = useRef(false);

  const { data: save } = useGetSave(Number(saveId), {
    query: { enabled: !!saveId, queryKey: getGetSaveQueryKey(Number(saveId)) },
  });
  const { data: events } = useListSaveEvents(Number(saveId), {
    query: { enabled: !!saveId, queryKey: getListSaveEventsQueryKey(Number(saveId)) },
  });
  const { data: character } = useGetCharacter(Number(save?.characterId), {
    query: { enabled: !!save?.characterId, queryKey: getGetCharacterQueryKey(Number(save?.characterId)) },
  });
  const { data: mission } = useGetMission(Number(save?.missionId), {
    query: { enabled: !!save?.missionId, queryKey: getGetMissionQueryKey(Number(save?.missionId)) },
  });

  const queryClient = useQueryClient();
  const { data: leaderboard } = useListLeaderboard({ limit: 10 }, {
    query: { queryKey: getListLeaderboardQueryKey({ limit: 10 }) },
  });
  const createEntry = useCreateLeaderboardEntry();
  const [playerName, setPlayerName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const nameInit = useRef(false);

  useEffect(() => {
    if (nameInit.current) return;
    const initial = save?.mode === "series" ? (save?.playerName ?? "") : (character?.name ?? "");
    if (initial) {
      nameInit.current = true;
      setPlayerName(initial);
    }
  }, [character?.name, save?.playerName, save?.mode]);

  const submitScore = async () => {
    if (!save || !mission || submitted || createEntry.isPending) return;
    const fallbackName = save.mode === "series" ? (save.playerName ?? "Tourist") : (character?.name ?? "Driver");
    const name = playerName.trim() || fallbackName;
    try {
      await createEntry.mutateAsync({
        data: {
          saveId: save.id,
          playerName: name.slice(0, 40),
          characterSlug: character?.slug ?? "jeremy",
          missionTitle: mission.title,
          score: save.score,
          distance: save.distanceTravelled,
        },
      });
      setSubmitted(true);
      await queryClient.invalidateQueries({ queryKey: getListLeaderboardQueryKey({ limit: 10 }) });
    } catch { /* surfaced via createEntry.isError */ }
  };

  // Stream the closing monologue once all data is available
  useEffect(() => {
    if (!save || !mission || !events || monologueStarted.current) return;
    monologueStarted.current = true;

    const isWin = save.status === "completed";
    const driverName = save.mode === "series" ? (save.playerName ?? "The tourist") : (character?.name ?? "The driver");
    const presenterSlug = character?.slug ?? "jeremy";
    const topEvents = events.slice(0, 3).map((e) => `${e.title}: ${e.description}`).join("; ");
    const context = `${driverName} has ${isWin ? "successfully completed" : "spectacularly failed"} the ${mission.title} through ${mission.location}. Key moments: ${topEvents || "the journey itself"}. Final score: ${save.score.toLocaleString()}. Funds remaining: £${save.funds.toLocaleString()}.`;

    setIsStreaming(true);
    (async () => {
      try {
        const res = await fetch("/api/banter/monologue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterSlug: presenterSlug, context }),
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
              if (data.done) break;
              if (data.text) {
                setMonologue((prev) => prev + data.text);
                if (data.name) setMonologueName(data.name);
              }
            } catch { /* skip */ }
          }
        }
      } catch { /* non-critical */ }
      finally {
        setIsStreaming(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save?.id, character?.id, mission?.id, events?.length]);

  if (!save || !mission) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isSeries = save.mode === "series";
  const driverName = isSeries ? (save.playerName ?? "The Tourist") : (character?.name ?? "The Driver");
  const presenterSlug = character?.slug ?? "jeremy";
  const presenterAvatar = presenterSlug === "richard" ? "/images/hammond.png" : `/images/${presenterSlug}.png`;
  const isWin = save.status === "completed";
  const perfectRounds = Math.round((save.score / (save.funds + 1)) * 10) % 3;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-10">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full border-4 ${isWin ? "border-primary bg-primary/10" : "border-destructive bg-destructive/10"}`}>
            {isWin
              ? <Trophy className="w-12 h-12 text-primary" />
              : <AlertOctagon className="w-12 h-12 text-destructive" />
            }
          </div>
          <div>
            <h1 className="text-5xl font-bold uppercase tracking-tighter mb-3">
              {isWin ? "Ambitious But Brilliant" : "A Catastrophic Failure"}
            </h1>
            <p className="text-xl text-muted-foreground">
              {isWin
                ? `${driverName} conquered ${mission.title}. Against all probability.`
                : `${driverName} did not make it. Somewhere in ${mission.location}, a car sits broken.`}
            </p>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-3 gap-4"
        >
          {[
            { label: "Final Score", value: save.score.toLocaleString(), highlight: true },
            { label: "Funds Left", value: `£${save.funds.toLocaleString()}` },
            { label: "Distance", value: `${save.distanceTravelled} km` },
          ].map(({ label, value, highlight }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-5 text-center">
              <p className="text-xs font-bold uppercase text-muted-foreground mb-2">{label}</p>
              <p className={`font-mono text-2xl font-bold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
            </div>
          ))}
        </motion.div>

        {/* Closing monologue */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-xl overflow-hidden"
        >
          <div className="px-6 py-4 border-b bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={presenterAvatar}
                alt={monologueName || "Presenter"}
                className="w-8 h-8 rounded-full object-cover border border-border"
              />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {monologueName || "Presenter"} — Closing Remarks
              </p>
            </div>
            {isStreaming && (
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 bg-primary rounded-full"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="px-6 py-5 min-h-[80px]">
            {monologue ? (
              <p className="text-lg leading-relaxed italic text-foreground/90">
                "{monologue}{isStreaming ? <span className="animate-pulse">|</span> : '"'}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm italic">
                {isStreaming ? "Composing closing remarks..." : "No comment."}
              </p>
            )}
          </div>
        </motion.div>

        {/* Journey recap */}
        {events && events.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="bg-card border border-border rounded-xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b bg-muted/30">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">The Journey</p>
            </div>
            <div className="divide-y divide-border">
              {events.map((ev, i) => (
                <motion.div
                  key={ev.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.05 }}
                  className="px-6 py-4 flex items-start gap-4"
                >
                  <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm uppercase mb-1">{ev.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{ev.description}</p>
                    {ev.fundsChange !== 0 && (
                      <p className={`font-mono text-xs font-bold mt-1 ${ev.fundsChange < 0 ? "text-red-400" : "text-green-400"}`}>
                        {ev.fundsChange > 0 ? "+" : ""}£{ev.fundsChange}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Global Leaderboard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-card border border-border rounded-xl overflow-hidden"
        >
          <div className="px-6 py-4 border-b bg-muted/30 flex items-center gap-2">
            <Crown className="w-4 h-4 text-primary" />
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Global Leaderboard</p>
          </div>

          {/* Submit row */}
          <div className="px-6 py-4 border-b border-border">
            {submitted ? (
              <p className="text-sm text-green-400 font-bold flex items-center gap-2">
                <Trophy className="w-4 h-4" /> Score submitted to the global leaderboard!
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <Input
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  maxLength={40}
                  placeholder="Your name"
                  data-testid="input-player-name"
                  className="flex-1"
                />
                <Button
                  onClick={submitScore}
                  disabled={createEntry.isPending}
                  data-testid="button-submit-score"
                  className="uppercase font-bold tracking-wide shrink-0"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {createEntry.isPending ? "Submitting…" : `Submit ${save.score.toLocaleString()}`}
                </Button>
              </div>
            )}
            {createEntry.isError && !submitted && (
              <p className="text-xs text-red-400 mt-2">Could not submit score. Please try again.</p>
            )}
          </div>

          {/* Board */}
          <div className="divide-y divide-border">
            {leaderboard && leaderboard.length > 0 ? (
              leaderboard.map((entry, i) => (
                <div
                  key={entry.id}
                  data-testid={`leaderboard-row-${i}`}
                  className="px-6 py-3 flex items-center gap-4"
                >
                  <div className="w-7 text-center shrink-0">
                    {i === 0 ? <Crown className="w-5 h-5 text-amber-400 mx-auto" />
                      : i === 1 ? <Medal className="w-5 h-5 text-zinc-300 mx-auto" />
                      : i === 2 ? <Medal className="w-5 h-5 text-amber-700 mx-auto" />
                      : <span className="font-mono text-sm text-muted-foreground">{i + 1}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{entry.playerName}</p>
                    <p className="text-xs text-muted-foreground truncate">{entry.missionTitle}</p>
                  </div>
                  <p className="font-mono font-bold text-primary text-sm shrink-0">{entry.score.toLocaleString()}</p>
                </div>
              ))
            ) : (
              <p className="px-6 py-5 text-sm text-muted-foreground italic">No scores yet. Be the first.</p>
            )}
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-4 justify-center pb-4"
        >
          <Link href="/character-select">
            <Button
              size="lg"
              data-testid="button-play-again"
              className="w-full sm:w-auto uppercase font-bold px-10 h-14 tracking-widest"
            >
              <RotateCcw className="mr-2 h-5 w-5" />
              Play Again
            </Button>
          </Link>
          <Link href="/">
            <Button
              size="lg"
              variant="outline"
              data-testid="button-main-menu"
              className="w-full sm:w-auto uppercase font-bold px-10 h-14 tracking-widest"
            >
              <Home className="mr-2 h-5 w-5" />
              Main Menu
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
