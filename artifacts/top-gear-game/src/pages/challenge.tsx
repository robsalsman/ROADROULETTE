import { useLocation, useParams } from "wouter";
import { useGetSave, getGetSaveQueryKey, useUpdateSave, useGetMission, getGetMissionQueryKey, useGetCharacter, getGetCharacterQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect, useCallback } from "react";
import { Flag } from "lucide-react";

type ChallengePhase = "briefing" | "bantering" | "ready" | "playing" | "result";
type RoundResult = "perfect" | "good" | "ok" | "miss";

type BanterLine = { character: string; name: string; line: string };

const ROUND_RESULTS: Record<RoundResult, { label: string; color: string; multiplier: number }> = {
  perfect: { label: "PERFECT", color: "text-green-400", multiplier: 1.0 },
  good: { label: "GOOD", color: "text-amber-400", multiplier: 0.7 },
  ok: { label: "OK", color: "text-orange-400", multiplier: 0.4 },
  miss: { label: "MISS", color: "text-red-500", multiplier: 0.0 },
};

const TOTAL_ROUNDS = 3;
const TRACK_PERCENT = 100; // cursor moves 0-100

function BanterBubble({ line }: { line: BanterLine }) {
  const avatar = line.character === "richard" ? "/images/hammond.png" : `/images/${line.character}.png`;
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex gap-3 items-start"
    >
      <img src={avatar} alt={line.name} className="w-8 h-8 rounded-full border border-border shrink-0 object-cover" />
      <div className="bg-card border border-border rounded-xl px-4 py-3 text-sm leading-relaxed max-w-[85%]">
        <span className="block text-xs font-bold uppercase mb-1 opacity-60">{line.name}</span>
        {line.line}
      </div>
    </motion.div>
  );
}

export default function Challenge() {
  const { saveId } = useParams();
  const [, setLocation] = useLocation();

  const [phase, setPhase] = useState<ChallengePhase>("briefing");
  const [banter, setBanter] = useState<BanterLine[]>([]);
  const [isBantering, setIsBantering] = useState(false);

  // Mini-game state
  const [round, setRound] = useState(1);
  const [scores, setScores] = useState<RoundResult[]>([]);
  const [lastResult, setLastResult] = useState<RoundResult | null>(null);
  const [cursorPos, setCursorPos] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [zoneCenter] = useState(50); // green zone always at 50%

  // Refs for animation
  const posRef = useRef(0);
  const dirRef = useRef(1);
  const animFrameRef = useRef<number | null>(null);
  const speedRef = useRef(0.4);

  const { data: save } = useGetSave(Number(saveId), {
    query: { enabled: !!saveId, queryKey: getGetSaveQueryKey(Number(saveId)) },
  });
  const { data: mission } = useGetMission(Number(save?.missionId), {
    query: { enabled: !!save?.missionId, queryKey: getGetMissionQueryKey(Number(save?.missionId)) },
  });
  const { data: character } = useGetCharacter(Number(save?.characterId), {
    query: { enabled: !!save?.characterId, queryKey: getGetCharacterQueryKey(Number(save?.characterId)) },
  });
  const updateSave = useUpdateSave();

  // Character stats affect the mini-game:
  // mechanical → green zone width (wider = easier)
  // confidence → cursor speed (higher = faster = harder)
  const charStats = character?.stats as { confidence: number; mechanical: number; navigation: number } | undefined;
  const zoneHalf = charStats ? 6 + charStats.mechanical * 0.8 : 10; // 7-15% half-width
  const cursorSpeed = charStats ? 0.25 + (charStats.confidence - 1) * 0.035 : 0.4; // 0.28-0.56

  // Auto-stream banter when the page loads
  useEffect(() => {
    if (!save || !mission || !character || phase !== "briefing") return;
    const challenge = mission.challenges?.[0];
    if (!challenge) return;

    const context = `${character.name} is about to attempt the Final Challenge: "${challenge.title}". The challenge: ${challenge.description}. They have £${save.funds} remaining and their car is battered but still running. The other two presenters are watching.`;

    setIsBantering(true);
    setPhase("bantering");

    (async () => {
      try {
        const res = await fetch("/api/banter/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            context,
            characters: ["jeremy", "richard", "james"],
            tone: "excited",
          }),
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
              if (data.character && data.line) setBanter((prev) => [...prev, data as BanterLine]);
            } catch { /* skip */ }
          }
        }
      } catch { /* non-critical */ }
      finally {
        setIsBantering(false);
        setPhase("ready");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save?.id, mission?.id, character?.id]);

  // Start animation loop
  const startAnimation = useCallback(() => {
    speedRef.current = cursorSpeed;
    posRef.current = 0;
    dirRef.current = 1;
    setIsAnimating(true);

    const tick = () => {
      posRef.current += dirRef.current * speedRef.current;
      if (posRef.current >= TRACK_PERCENT) {
        posRef.current = TRACK_PERCENT;
        dirRef.current = -1;
      } else if (posRef.current <= 0) {
        posRef.current = 0;
        dirRef.current = 1;
      }
      // Gradually speed up
      speedRef.current = Math.min(speedRef.current + 0.001, cursorSpeed * 1.8);
      setCursorPos(posRef.current);
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }, [cursorSpeed]);

  const stopAnimation = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsAnimating(false);
  }, []);

  useEffect(() => () => stopAnimation(), [stopAnimation]);

  const handleStartRound = useCallback(() => {
    setLastResult(null);
    startAnimation();
  }, [startAnimation]);

  const handleFloorIt = useCallback(() => {
    if (!isAnimating) return;
    stopAnimation();
    const pos = posRef.current;
    const dist = Math.abs(pos - zoneCenter);

    let result: RoundResult;
    if (dist <= zoneHalf * 0.4) result = "perfect";
    else if (dist <= zoneHalf) result = "good";
    else if (dist <= zoneHalf * 1.8) result = "ok";
    else result = "miss";

    setLastResult(result);
    setScores((prev) => [...prev, result]);

    if (round < TOTAL_ROUNDS) {
      setRound((r) => r + 1);
    } else {
      setPhase("result");
    }
  }, [isAnimating, stopAnimation, zoneCenter, zoneHalf, round]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.code === "Space" && phase === "playing" && isAnimating) {
      e.preventDefault();
      handleFloorIt();
    }
  }, [phase, isAnimating, handleFloorIt]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleComplete = useCallback(async (roundScores: RoundResult[]) => {
    if (!save) return;
    const perfectCount = roundScores.filter((s) => s === "perfect").length;
    const goodCount = roundScores.filter((s) => s === "good").length;
    const totalMult = roundScores.reduce((acc, s) => acc + ROUND_RESULTS[s].multiplier, 0) / TOTAL_ROUNDS;
    const won = totalMult >= 0.35; // Need at least one good result

    const finalScore = Math.round(save.funds * (0.5 + totalMult * 1.5));

    try {
      await updateSave.mutateAsync({
        id: save.id,
        data: {
          status: won ? "completed" : "failed",
          score: finalScore,
        },
      });
      setLocation(`/results/${save.id}`);
    } catch {
      toast({ title: "Failed to save result", variant: "destructive" });
    }
  }, [save, updateSave, setLocation]);

  useEffect(() => {
    if (phase === "result" && scores.length === TOTAL_ROUNDS) {
      const timer = setTimeout(() => handleComplete(scores), 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [phase, scores, handleComplete]);

  if (!save || !mission || !character) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const challenge = mission.challenges?.[0];
  const zoneLeft = zoneCenter - zoneHalf;
  const zoneWidth = zoneHalf * 2;

  return (
    <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden bg-zinc-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(251,191,36,0.08)_0%,_transparent_70%)] pointer-events-none" />

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-2xl w-full space-y-6 relative z-10"
      >
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-full px-4 py-1.5">
            <Flag className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Final Challenge</span>
          </div>
          <h1 className="text-4xl font-bold uppercase tracking-tighter">
            {challenge?.title ?? "The Final Race"}
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-xl mx-auto">
            {challenge?.description ?? "Floor it to the finish line."}
          </p>
          <div className="flex justify-center gap-8 pt-2">
            <div className="text-center">
              <p className="text-xs uppercase font-bold text-muted-foreground">Funds</p>
              <p className="font-mono text-xl font-bold text-green-400">£{save.funds.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-xs uppercase font-bold text-muted-foreground">Round</p>
              <p className="font-mono text-xl font-bold">{Math.min(round, TOTAL_ROUNDS)} / {TOTAL_ROUNDS}</p>
            </div>
          </div>
        </div>

        {/* Banter */}
        <AnimatePresence>
          {(phase === "bantering" || phase === "ready") && banter.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card/80 border border-border rounded-xl p-5 space-y-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Pre-race trash talk</p>
                {isBantering && (
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
              {banter.map((b, i) => <BanterBubble key={i} line={b} />)}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mini-game */}
        <AnimatePresence mode="wait">
          {phase === "ready" && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <div className="bg-card border border-border rounded-xl p-6 space-y-4 mb-6">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Stop the cursor <strong className="text-foreground">inside the green zone</strong> by clicking{" "}
                  <strong className="text-foreground">FLOOR IT</strong> or pressing{" "}
                  <strong className="text-foreground">Space</strong>. The zone width depends on your mechanical skill. The speed gets faster every pass.
                </p>
                <p className="text-xs text-muted-foreground">
                  Zone width: {Math.round(zoneHalf * 2)}% &nbsp;|&nbsp; Your mechanical: {charStats?.mechanical}/10
                </p>
              </div>
              <Button
                size="lg"
                data-testid="button-start-challenge"
                className="h-16 px-12 text-lg font-bold uppercase tracking-widest"
                onClick={() => { setPhase("playing"); handleStartRound(); }}
              >
                Start Challenge
              </Button>
            </motion.div>
          )}

          {phase === "playing" && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Round dots */}
              <div className="flex justify-center gap-3">
                {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => {
                  const score = scores[i];
                  return (
                    <div
                      key={i}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${
                        score
                          ? score === "perfect" || score === "good"
                            ? "border-green-500 bg-green-500/20 text-green-400"
                            : score === "ok"
                            ? "border-amber-500 bg-amber-500/20 text-amber-400"
                            : "border-red-500 bg-red-500/20 text-red-400"
                          : i === round - 1
                          ? "border-primary bg-primary/20"
                          : "border-border"
                      }`}
                    >
                      {score ? (score === "perfect" ? "P" : score === "good" ? "G" : score === "ok" ? "O" : "X") : i + 1}
                    </div>
                  );
                })}
              </div>

              {/* Last result flash */}
              <AnimatePresence>
                {lastResult && (
                  <motion.div
                    key={`result-${round}`}
                    initial={{ opacity: 0, scale: 1.3 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className={`text-center text-3xl font-bold uppercase tracking-widest ${ROUND_RESULTS[lastResult].color}`}
                  >
                    {ROUND_RESULTS[lastResult].label}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* The track */}
              <div className="relative h-16 bg-zinc-900 border-2 border-zinc-700 rounded-xl overflow-hidden select-none">
                {/* Green zone */}
                <div
                  className="absolute top-0 bottom-0 bg-green-500/25 border-l-2 border-r-2 border-green-500/60"
                  style={{ left: `${zoneLeft}%`, width: `${zoneWidth}%` }}
                />
                {/* Zone label */}
                <div
                  className="absolute top-1 text-green-400 text-xs font-bold uppercase"
                  style={{ left: `${zoneCenter}%`, transform: "translateX(-50%)" }}
                >
                  SWEET SPOT
                </div>
                {/* Cursor car */}
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs shadow-lg shadow-primary/40"
                  style={{ left: `calc(${cursorPos}% - 16px)` }}
                >
                  CAR
                </motion.div>
              </div>

              {/* Floor It button */}
              {isAnimating && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Button
                    size="lg"
                    data-testid="button-floor-it"
                    onClick={handleFloorIt}
                    className="w-full h-20 text-2xl font-bold uppercase tracking-widest shadow-xl hover:scale-[1.02] transition-transform"
                  >
                    FLOOR IT!
                  </Button>
                </motion.div>
              )}

              {/* Next round prompt (between rounds) */}
              {!isAnimating && lastResult && round <= TOTAL_ROUNDS && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Button
                    size="lg"
                    data-testid="button-next-round"
                    variant="outline"
                    onClick={handleStartRound}
                    className="w-full h-14 text-base font-bold uppercase tracking-widest"
                  >
                    Round {round} — Go Again
                  </Button>
                </motion.div>
              )}
            </motion.div>
          )}

          {phase === "result" && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4"
            >
              <p className="text-3xl font-bold uppercase tracking-tight">
                {scores.filter((s) => s === "perfect" || s === "good").length >= 2
                  ? "Brilliant. Against All Odds."
                  : scores.filter((s) => s === "miss").length === TOTAL_ROUNDS
                  ? "That Was Terrible"
                  : "Not Your Best Work"}
              </p>
              <div className="flex justify-center gap-4">
                {scores.map((s, i) => (
                  <div key={i} className={`text-lg font-bold uppercase ${ROUND_RESULTS[s].color}`}>
                    {ROUND_RESULTS[s].label}
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground animate-pulse">Calculating final score...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
