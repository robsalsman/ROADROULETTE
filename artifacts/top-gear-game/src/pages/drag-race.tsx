import { Link } from "wouter";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Flag, Gauge, RotateCcw, Settings2, Trophy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { garageApi, defaultGarageTuning, type GarageTuning, type OwnedVehicle } from "@/services/garageApi";
import { opponentsForVehicle, simulateDragRace, timingScore, type DragOpponent, type DragRaceResult } from "@/game/dragRaceEngine";
import { deriveVehiclePerformance } from "@/data/vehiclePerformance";
import { vehicleTopDownSprite } from "@/data/vehicles";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const GARAGE_QUERY_KEY = ["garage"];

const DRAG_DIFFICULTY = {
  launchNeedleSeconds: 2.6,
  shiftNeedleSeconds: 2.15,
  launchTarget: 0.72,
  shiftTarget: 0.68,
  perfectWindow: 0.07,
  goodWindow: 0.18,
  lateWindow: 0.3,
  countdownMs: 2600,
  raceDistanceMeters: 402,
  maxRaceSeconds: 16,
  shiftGears: [2, 3, 4],
  beginnerReactionGraceMs: 260,
  speedScale: 0.92,
};

type RacePhase = "staging" | "countdown" | "launching" | "racing" | "result";
type TimingGrade = "too-early" | "good" | "perfect" | "late" | "missed";

type RaceRuntime = {
  playerMeters: number;
  opponentMeters: number;
  playerSpeed: number;
  opponentSpeed: number;
  rpm: number;
  gear: number;
  shiftIndex: number;
  elapsedMs: number;
  playerFinishedMs: number | null;
  opponentFinishedMs: number | null;
};

const initialRuntime: RaceRuntime = {
  playerMeters: 0,
  opponentMeters: 0,
  playerSpeed: 0,
  opponentSpeed: 0,
  rpm: 2800,
  gear: 1,
  shiftIndex: 0,
  elapsedMs: 0,
  playerFinishedMs: null,
  opponentFinishedMs: null,
};

function formatTime(ms: number): string {
  return `${(ms / 1000).toFixed(3)}s`;
}

function selectVehicle(vehicles: OwnedVehicle[], key: string | null): OwnedVehicle | undefined {
  return vehicles.find((vehicle) => vehicle.canonicalVehicleKey === key)
    ?? vehicles.find((vehicle) => vehicle.isActive)
    ?? vehicles[0];
}

function zoneForNeedle(value: number, target: number): TimingGrade {
  const delta = value - target;
  const abs = Math.abs(delta);
  if (abs <= DRAG_DIFFICULTY.perfectWindow) return "perfect";
  if (abs <= DRAG_DIFFICULTY.goodWindow) return "good";
  if (delta < 0) return "too-early";
  if (abs <= DRAG_DIFFICULTY.lateWindow) return "late";
  return "missed";
}

function feedbackFor(kind: "launch" | "shift", grade: TimingGrade): string {
  if (kind === "launch") {
    if (grade === "perfect") return "Perfect launch";
    if (grade === "too-early") return "Wheelspin";
    if (grade === "late" || grade === "missed") return "Bogged launch";
    return "Clean launch";
  }
  if (grade === "perfect") return "Perfect shift";
  if (grade === "good") return "Good shift";
  return "Missed shift";
}

function timingLabel(grade: TimingGrade): string {
  if (grade === "too-early") return "Too Early";
  if (grade === "good") return "Good";
  if (grade === "perfect") return "Perfect";
  if (grade === "late") return "Late";
  return "Missed";
}

function gradeClass(grade: TimingGrade): string {
  if (grade === "perfect") return "border-green-400 bg-green-500/20 text-green-100";
  if (grade === "good") return "border-amber-400 bg-amber-500/20 text-amber-100";
  if (grade === "late") return "border-orange-400 bg-orange-500/20 text-orange-100";
  return "border-red-400 bg-red-500/20 text-red-100";
}

function opponentSpriteName(opponent: DragOpponent): string {
  if (opponent.key.includes("midnight")) return "Dodge Challenger SRT Demon";
  if (opponent.key.includes("runway")) return "Ford Mustang GT";
  return "Volkswagen Golf GTI";
}

export default function DragRace() {
  const queryClient = useQueryClient();
  const searchParams = new URLSearchParams(window.location.search);
  const requestedVehicle = searchParams.get("vehicle");

  const garageQuery = useQuery({
    queryKey: GARAGE_QUERY_KEY,
    queryFn: garageApi.getGarage,
  });

  const garage = garageQuery.data;
  const vehicle = selectVehicle(garage?.vehicles ?? [], requestedVehicle);
  const opponents = useMemo(() => opponentsForVehicle(vehicle ? { ...vehicle, tuning: vehicle.tuning ?? defaultGarageTuning } : undefined), [vehicle]);
  const [opponentKey, setOpponentKey] = useState(opponents[0]?.key ?? "service-road-sleeper");
  const opponent = opponents.find((item) => item.key === opponentKey) ?? opponents[0];
  const [tuning, setTuning] = useState<GarageTuning>(vehicle?.tuning ?? defaultGarageTuning);
  const [phase, setPhase] = useState<RacePhase>("staging");
  const [needle, setNeedle] = useState(0.35);
  const [launchScore, setLaunchScore] = useState<number | null>(null);
  const [shiftScores, setShiftScores] = useState<number[]>([]);
  const [reactionMs, setReactionMs] = useState<number | null>(null);
  const [runtime, setRuntime] = useState<RaceRuntime>(initialRuntime);
  const [feedback, setFeedback] = useState<string>("Stage both cars and wait for green.");
  const [result, setResult] = useState<DragRaceResult | null>(null);
  const [countdownStep, setCountdownStep] = useState(0);

  const countdownStartedAt = useRef<number | null>(null);
  const greenAt = useRef<number | null>(null);
  const raceStartedAt = useRef<number | null>(null);
  const lastFrameAt = useRef<number | null>(null);
  const launchScoreRef = useRef<number | null>(null);
  const shiftScoresRef = useRef<number[]>([]);
  const runtimeRef = useRef<RaceRuntime>(initialRuntime);
  const savedResultRef = useRef(false);

  const saveTuningMutation = useMutation({
    mutationFn: ({ selected, nextTuning }: { selected: OwnedVehicle; nextTuning: GarageTuning }) =>
      garageApi.saveTuning(selected.canonicalVehicleKey, nextTuning, 0),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GARAGE_QUERY_KEY }),
  });

  const raceMutation = useMutation({
    mutationFn: (payload: DragRaceResult & { selected: OwnedVehicle; opponent: DragOpponent }) =>
      garageApi.completeDragRace({
        canonicalVehicleKey: payload.selected.canonicalVehicleKey,
        opponentKey: payload.opponent.key,
        opponentName: payload.opponent.name,
        elapsedMs: payload.elapsedMs,
        opponentElapsedMs: payload.opponentElapsedMs,
        trapSpeed: payload.trapSpeed,
        won: payload.won,
        rewardCredits: payload.rewardCredits,
        breakdown: payload.breakdown,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GARAGE_QUERY_KEY }),
  });

  useEffect(() => {
    if (vehicle) setTuning(vehicle.tuning ?? defaultGarageTuning);
  }, [vehicle?.canonicalVehicleKey]);

  useEffect(() => {
    if (!opponents.some((item) => item.key === opponentKey)) {
      setOpponentKey(opponents[0]?.key ?? "service-road-sleeper");
    }
  }, [opponents, opponentKey]);

  useEffect(() => {
    launchScoreRef.current = launchScore;
  }, [launchScore]);

  useEffect(() => {
    shiftScoresRef.current = shiftScores;
  }, [shiftScores]);

  useEffect(() => {
    runtimeRef.current = runtime;
  }, [runtime]);

  useEffect(() => {
    if (phase !== "launching" && phase !== "racing") return;
    let raf = 0;
    const started = performance.now();
    const seconds = phase === "launching" ? DRAG_DIFFICULTY.launchNeedleSeconds : DRAG_DIFFICULTY.shiftNeedleSeconds;
    const target = phase === "launching" ? DRAG_DIFFICULTY.launchTarget : DRAG_DIFFICULTY.shiftTarget;
    const tick = (now: number) => {
      const progress = ((now - started) / (seconds * 1000)) % 1;
      const triangle = progress < 0.5 ? progress * 2 : 2 - progress * 2;
      setNeedle(triangle);
      if (phase === "launching") {
        setFeedback(`Launch: ${timingLabel(zoneForNeedle(triangle, target))}`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    if (phase !== "countdown") return;
    let raf = 0;
    countdownStartedAt.current = performance.now();
    greenAt.current = null;
    const tick = (now: number) => {
      const elapsed = now - (countdownStartedAt.current ?? now);
      const step = Math.min(3, Math.floor(elapsed / (DRAG_DIFFICULTY.countdownMs / 4)));
      setCountdownStep(step);
      if (elapsed >= DRAG_DIFFICULTY.countdownMs) {
        greenAt.current = performance.now();
        setPhase("launching");
        setFeedback("Green! Launch!");
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const finishRace = useCallback(async (finalRuntime: RaceRuntime) => {
    if (!vehicle || savedResultRef.current) return;
    savedResultRef.current = true;
    const finalLaunchScore = launchScoreRef.current ?? 0.45;
    const finalShiftScore = shiftScoresRef.current.length > 0
      ? shiftScoresRef.current.reduce((total, score) => total + score, 0) / shiftScoresRef.current.length
      : 0.45;
    const finalReactionMs = reactionMs ?? DRAG_DIFFICULTY.beginnerReactionGraceMs;
    const simulated = simulateDragRace({
      vehicle: { ...vehicle, tuning },
      opponent,
      launchScore: finalLaunchScore,
      shiftScore: finalShiftScore,
      reactionMs: finalReactionMs,
    });
    const visualElapsedMs = finalRuntime.playerFinishedMs ?? simulated.elapsedMs;
    const visualOpponentMs = finalRuntime.opponentFinishedMs ?? simulated.opponentElapsedMs;
    const trapSpeed = Math.max(60, Math.round(finalRuntime.playerSpeed * 2.237));
    const final: DragRaceResult = {
      ...simulated,
      elapsedMs: Math.round((visualElapsedMs + simulated.elapsedMs) / 2),
      opponentElapsedMs: Math.round((visualOpponentMs + simulated.opponentElapsedMs) / 2),
      trapSpeed,
      won: visualElapsedMs <= visualOpponentMs,
      rewardCredits: visualElapsedMs <= visualOpponentMs ? opponent.rewardCredits : 0,
    };
    setResult(final);
    setPhase("result");
    setFeedback(final.won ? "Win light!" : "Opponent got there first.");
    await raceMutation.mutateAsync({ ...final, selected: vehicle, opponent }).catch(() => {
      toast({ title: "Race result not saved", variant: "destructive" });
    });
  }, [opponent, raceMutation, reactionMs, tuning, vehicle]);

  useEffect(() => {
    if (phase !== "racing" || !vehicle || !opponent) return;
    let raf = 0;
    lastFrameAt.current = performance.now();
    raceStartedAt.current = raceStartedAt.current ?? performance.now();
    const vehiclePerformance = deriveVehiclePerformance(vehicle, vehicle.upgrades);
    const powerFactor = Math.min(2.2, Math.max(0.75, vehiclePerformance.horsepower / 360));
    const gripFactor = Math.min(1.35, Math.max(0.65, vehiclePerformance.traction / 6.5));
    const conditionFactor = Math.max(0.65, vehicle.condition / 100);
    const launch = launchScoreRef.current ?? 0.5;
    const opponentPower = 0.8 + opponent.power / 10;
    const opponentGrip = 0.85 + opponent.traction / 15;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - (lastFrameAt.current ?? now)) / 1000);
      lastFrameAt.current = now;
      const elapsedMs = now - (raceStartedAt.current ?? now);
      const shiftAverage = shiftScoresRef.current.length > 0
        ? shiftScoresRef.current.reduce((total, score) => total + score, 0) / shiftScoresRef.current.length
        : 0.75;
      const next = { ...runtimeRef.current };
      const playerLaunchBoost = 0.72 + launch * 0.56;
      const playerShiftBoost = 0.72 + shiftAverage * 0.36;
      const gearRatio = 1.08 - Math.min(0.34, (next.gear - 1) * 0.1);
      const playerAccel = (8.6 * powerFactor * gripFactor * conditionFactor * playerLaunchBoost * playerShiftBoost * gearRatio)
        - next.playerSpeed * 0.045;
      const opponentAccel = (8.25 * opponentPower * opponentGrip * (0.9 + opponent.consistency / 40))
        - next.opponentSpeed * 0.048;

      if (next.playerFinishedMs == null) {
        next.playerSpeed = Math.max(0, next.playerSpeed + playerAccel * dt * DRAG_DIFFICULTY.speedScale);
        next.playerMeters = Math.min(DRAG_DIFFICULTY.raceDistanceMeters, next.playerMeters + next.playerSpeed * dt);
        if (next.playerMeters >= DRAG_DIFFICULTY.raceDistanceMeters) next.playerFinishedMs = elapsedMs;
      }
      if (next.opponentFinishedMs == null) {
        next.opponentSpeed = Math.max(0, next.opponentSpeed + opponentAccel * dt * DRAG_DIFFICULTY.speedScale);
        next.opponentMeters = Math.min(DRAG_DIFFICULTY.raceDistanceMeters, next.opponentMeters + next.opponentSpeed * dt);
        if (next.opponentMeters >= DRAG_DIFFICULTY.raceDistanceMeters) next.opponentFinishedMs = elapsedMs;
      }

      const gearProgress = Math.min(1, (next.playerSpeed % 24) / 24);
      next.rpm = Math.round(3000 + gearProgress * 5200);
      next.elapsedMs = elapsedMs;
      setRuntime(next);
      runtimeRef.current = next;

      const finished = next.playerFinishedMs != null && next.opponentFinishedMs != null;
      const timedOut = elapsedMs > DRAG_DIFFICULTY.maxRaceSeconds * 1000;
      if (finished || timedOut) {
        void finishRace(next);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [finishRace, opponent, phase, vehicle]);

  const startRace = async () => {
    if (!vehicle) return;
    setTuning(vehicle.tuning ?? defaultGarageTuning);
    await saveTuningMutation.mutateAsync({ selected: vehicle, nextTuning: tuning }).catch(() => undefined);
    savedResultRef.current = false;
    setResult(null);
    setLaunchScore(null);
    setShiftScores([]);
    setReactionMs(null);
    setNeedle(0.35);
    setRuntime(initialRuntime);
    runtimeRef.current = initialRuntime;
    raceStartedAt.current = null;
    setCountdownStep(0);
    setFeedback("Watch the tree.");
    setPhase("countdown");
  };

  const launch = () => {
    if (phase !== "launching") return;
    const grade = zoneForNeedle(needle, DRAG_DIFFICULTY.launchTarget);
    const score = timingScore(needle, DRAG_DIFFICULTY.launchTarget);
    const now = performance.now();
    const rawReaction = greenAt.current ? now - greenAt.current : DRAG_DIFFICULTY.beginnerReactionGraceMs;
    const reaction = Math.max(0, Math.round(rawReaction));
    const speedPenalty = grade === "too-early" ? 0.45 : grade === "late" || grade === "missed" ? 0.25 : grade === "perfect" ? 1.8 : 1.1;
    setLaunchScore(score);
    setReactionMs(reaction);
    setRuntime((current) => {
      const next = { ...current, playerSpeed: speedPenalty, opponentSpeed: 0.95, rpm: 4200 };
      runtimeRef.current = next;
      return next;
    });
    raceStartedAt.current = now;
    setFeedback(feedbackFor("launch", grade));
    setPhase("racing");
  };

  const shift = () => {
    if (phase !== "racing") return;
    const current = runtimeRef.current;
    if (current.shiftIndex >= DRAG_DIFFICULTY.shiftGears.length) return;
    const grade = zoneForNeedle(needle, DRAG_DIFFICULTY.shiftTarget);
    const score = timingScore(needle, DRAG_DIFFICULTY.shiftTarget);
    setShiftScores((scores) => [...scores, score]);
    setRuntime((prior) => {
      const nextGear = DRAG_DIFFICULTY.shiftGears[prior.shiftIndex] ?? prior.gear + 1;
      const speedDelta = grade === "perfect" ? 4.8 : grade === "good" ? 2.6 : grade === "late" ? -1.4 : -4.2;
      const next = {
        ...prior,
        gear: nextGear,
        shiftIndex: prior.shiftIndex + 1,
        playerSpeed: Math.max(3, prior.playerSpeed + speedDelta),
        rpm: grade === "perfect" ? 6100 : grade === "good" ? 5600 : 3900,
      };
      runtimeRef.current = next;
      return next;
    });
    setFeedback(feedbackFor("shift", grade));
  };

  const resetRace = () => {
    setPhase("staging");
    setResult(null);
    setLaunchScore(null);
    setShiftScores([]);
    setReactionMs(null);
    setNeedle(0.35);
    setRuntime(initialRuntime);
    runtimeRef.current = initialRuntime;
    setFeedback("Stage both cars and wait for green.");
    savedResultRef.current = false;
  };

  const updateTuning = (key: keyof GarageTuning, value: number) => {
    setTuning((current) => ({ ...current, [key]: value }));
  };

  if (garageQuery.isLoading) {
    return <div className="flex-1 p-8 text-muted-foreground">Loading drag strip...</div>;
  }

  if (!vehicle) {
    return (
      <div className="flex-1 p-6 md:p-12">
        <div className="mx-auto max-w-3xl rounded-md border border-dashed border-border bg-muted/20 p-10 text-center">
          <p className="mb-4 text-xl font-black uppercase">No Garage Vehicle</p>
          <p className="mb-6 text-muted-foreground">Quick Drag onboarding and starter vehicle selection are pending the economy approval step.</p>
          <Link href="/garage">
            <Button className="uppercase font-bold">Open Garage</Button>
          </Link>
        </div>
      </div>
    );
  }

  const vehiclePerformance = deriveVehiclePerformance(vehicle, vehicle.upgrades);
  const playerProgress = Math.min(1, runtime.playerMeters / DRAG_DIFFICULTY.raceDistanceMeters);
  const opponentProgress = Math.min(1, runtime.opponentMeters / DRAG_DIFFICULTY.raceDistanceMeters);
  const currentGrade = zoneForNeedle(needle, phase === "launching" ? DRAG_DIFFICULTY.launchTarget : DRAG_DIFFICULTY.shiftTarget);
  const playerSprite = vehicleTopDownSprite(vehicle.name, vehicle.power, vehicle.offRoad);
  const opponentName = opponentSpriteName(opponent);
  const opponentSprite = vehicleTopDownSprite(opponentName, opponent.power, opponent.traction);
  const nextShiftGear = DRAG_DIFFICULTY.shiftGears[runtime.shiftIndex];
  const canShift = phase === "racing" && nextShiftGear != null && runtime.playerFinishedMs == null;
  const speedMph = Math.round(runtime.playerSpeed * 2.237);
  const rewardLabel = `Reward CR ${opponent.rewardCredits}`;

  return (
    <div className="flex-1 bg-background p-3 md:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-primary">Race Night</p>
            <h1 className="text-3xl font-black uppercase tracking-tight md:text-4xl">Drag Strip</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/garage">
              <Button variant="outline" className="uppercase font-bold">
                <ArrowLeft className="mr-2 h-4 w-4" /> Garage
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="uppercase font-bold">Main Menu</Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
          <Card className="overflow-hidden border-2 border-primary/30">
            <CardHeader className="bg-black/40">
              <CardTitle className="flex flex-wrap items-center justify-between gap-2 uppercase">
                <span className="flex items-center gap-2"><Flag className="h-5 w-5 text-primary" /> Quarter Mile</span>
                <span className="font-mono text-sm text-primary">{Math.round(runtime.playerMeters)}m / {DRAG_DIFFICULTY.raceDistanceMeters}m</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-3 md:p-5">
              <div className="relative h-[430px] overflow-hidden rounded-md border border-zinc-700 bg-zinc-950 sm:h-[500px]">
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />
                <div className="absolute left-[8%] top-0 h-full w-1 bg-white/80" />
                <div className="absolute right-[8%] top-0 h-full w-2 bg-[repeating-linear-gradient(0deg,#fff_0_10px,#111827_10px_20px)]" />
                <div className="absolute left-[8%] right-[8%] top-[30%] border-t border-dashed border-amber-300/60" />
                <div className="absolute left-[8%] right-[8%] top-[60%] border-t border-dashed border-amber-300/60" />
                <div className="absolute left-[8%] right-[8%] top-[45%] border-t border-white/10" />
                <div className="absolute left-[7%] top-2 text-[10px] font-black uppercase tracking-widest text-white/70">Start</div>
                <div className="absolute right-[6%] top-2 text-[10px] font-black uppercase tracking-widest text-white/70">Finish</div>

                <div className="absolute left-4 top-4 rounded-md border border-zinc-700 bg-black/70 p-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((light) => (
                      <span
                        key={light}
                        className={cn(
                          "h-5 w-5 rounded-full border border-zinc-600",
                          phase === "countdown" && countdownStep > light ? "bg-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.8)]" : "bg-zinc-800",
                        )}
                      />
                    ))}
                    <span
                      className={cn(
                        "h-5 w-5 rounded-full border border-zinc-600",
                        (phase === "launching" || phase === "racing" || phase === "result") ? "bg-green-400 shadow-[0_0_18px_rgba(74,222,128,0.8)]" : "bg-zinc-800",
                      )}
                    />
                  </div>
                </div>

                {["Wheelspin", "Bogged launch", "Missed shift"].includes(feedback) && (
                  <div className="absolute left-[12%] top-[28%] h-16 w-28 rounded-full bg-white/20 blur-xl" />
                )}
                {["Perfect launch", "Perfect shift"].includes(feedback) && (
                  <div className="absolute left-[12%] top-[28%] rounded-full border border-green-300/70 px-3 py-1 text-xs font-black uppercase text-green-100">
                    {feedback}
                  </div>
                )}

                <div
                  className="absolute top-[23%] w-16 transition-transform duration-75 will-change-transform sm:w-20"
                  style={{ left: `calc(8% + ${playerProgress * 84}% - 32px)` }}
                >
                  <img src={playerSprite} alt={vehicle.name} className="h-24 w-16 rotate-90 object-contain drop-shadow-[0_10px_12px_rgba(0,0,0,0.55)] sm:h-28 sm:w-20" draggable={false} />
                  <p className="mt-1 truncate rounded bg-black/70 px-1 py-0.5 text-center text-[9px] font-black uppercase text-white">{vehicle.name}</p>
                </div>

                <div
                  className="absolute top-[53%] w-16 transition-transform duration-75 will-change-transform sm:w-20"
                  style={{ left: `calc(8% + ${opponentProgress * 84}% - 32px)` }}
                >
                  <img src={opponentSprite} alt={opponent.name} className="h-24 w-16 rotate-90 object-contain drop-shadow-[0_10px_12px_rgba(0,0,0,0.55)] sm:h-28 sm:w-20" draggable={false} />
                  <p className="mt-1 truncate rounded bg-black/70 px-1 py-0.5 text-center text-[9px] font-black uppercase text-white">{opponent.name}</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  ["Speed", `${speedMph} mph`],
                  ["Gear", runtime.gear.toString()],
                  ["RPM", runtime.rpm.toLocaleString()],
                  ["RT", reactionMs == null ? "--" : `${reactionMs}ms`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-border bg-muted/20 p-2">
                    <p className="text-[10px] font-black uppercase text-muted-foreground">{label}</p>
                    <p className="font-mono text-base font-black md:text-xl">{value}</p>
                  </div>
                ))}
              </div>

              {(phase === "launching" || phase === "racing") && (
                <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between text-xs font-black uppercase">
                    <span>{phase === "launching" ? "Launch timing" : nextShiftGear ? `Shift to ${nextShiftGear}` : "Run it out"}</span>
                    <span className={cn("rounded border px-2 py-1", gradeClass(currentGrade))}>{timingLabel(currentGrade)}</span>
                  </div>
                  <div className="relative h-9 overflow-hidden rounded-full bg-zinc-900">
                    <div className="absolute left-0 top-0 flex h-full w-full text-[9px] font-black uppercase">
                      <div className="flex flex-1 items-center justify-center bg-red-500/20 text-red-100">Too Early</div>
                      <div className="flex flex-1 items-center justify-center bg-amber-500/20 text-amber-100">Good</div>
                      <div className="flex flex-1 items-center justify-center bg-green-500/25 text-green-100">Perfect</div>
                      <div className="flex flex-1 items-center justify-center bg-orange-500/20 text-orange-100">Late</div>
                    </div>
                    <div className="absolute top-0 h-full w-2 rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.9)]" style={{ left: `calc(${needle * 100}% - 4px)` }} />
                  </div>
                </div>
              )}

              <div className="rounded-md border border-border bg-card p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">Feedback</p>
                <p className="text-lg font-black uppercase">{feedback}</p>
              </div>

              {phase === "staging" && (
                <Button size="lg" className="h-16 w-full text-xl font-black uppercase" onClick={startRace} data-testid="button-start-drag-race">
                  <Zap className="mr-2 h-6 w-6" /> Stage Race
                </Button>
              )}
              {phase === "countdown" && (
                <Button size="lg" className="h-16 w-full text-xl font-black uppercase" disabled>
                  Watch The Tree
                </Button>
              )}
              {phase === "launching" && (
                <Button size="lg" className="h-20 w-full text-2xl font-black uppercase" onClick={launch} data-testid="button-launch-drag-race">
                  Launch
                </Button>
              )}
              {phase === "racing" && (
                <Button size="lg" className="h-20 w-full text-2xl font-black uppercase" onClick={shift} disabled={!canShift} data-testid="button-shift-drag-race">
                  {canShift ? `Shift To ${nextShiftGear}` : "Flat Out"}
                </Button>
              )}
              {phase === "result" && result && (
                <div className={cn("rounded-md border p-5", result.won ? "border-green-500/50 bg-green-500/10" : "border-red-500/50 bg-red-500/10")}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase text-muted-foreground">Finish Line</p>
                      <p className="text-3xl font-black uppercase">{result.won ? "You Won" : "You Lost"}</p>
                    </div>
                    <Trophy className={cn("h-10 w-10", result.won ? "text-green-400" : "text-red-400")} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
                    <div><p className="text-muted-foreground">Your ET</p><p className="font-mono text-xl font-black">{formatTime(result.elapsedMs)}</p></div>
                    <div><p className="text-muted-foreground">Opponent</p><p className="font-mono text-xl font-black">{formatTime(result.opponentElapsedMs)}</p></div>
                    <div><p className="text-muted-foreground">Trap Speed</p><p className="font-mono text-xl font-black">{result.trapSpeed} mph</p></div>
                    <div><p className="text-muted-foreground">Reaction</p><p className="font-mono text-xl font-black">{result.breakdown.reactionMs}ms</p></div>
                    <div><p className="text-muted-foreground">Payout</p><p className="font-mono text-xl font-black">+{result.rewardCredits}</p></div>
                  </div>
                  <Button variant="outline" className="mt-4 w-full uppercase font-bold" onClick={resetRace}>
                    <RotateCcw className="mr-2 h-4 w-4" /> Race Again
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 uppercase">
                  <Gauge className="h-5 w-5 text-primary" /> Staged Cars
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-md border border-border bg-muted/20 p-3">
                  <p className="text-xs font-black uppercase text-muted-foreground">You</p>
                  <p className="font-black uppercase">{vehicle.year} {vehicle.name}</p>
                  <p className="text-xs text-muted-foreground">HP {vehiclePerformance.horsepower.toLocaleString()} - {vehiclePerformance.drivetrain} - Grip {vehiclePerformance.traction.toFixed(1)}</p>
                </div>
                <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3">
                  <p className="text-xs font-black uppercase text-red-300">Opponent</p>
                  <p className="font-black uppercase">{opponent.name}</p>
                  <p className="text-xs text-muted-foreground">Power {opponent.power}/10 - Traction {opponent.traction}/10 - {rewardLabel}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 uppercase">
                  <Settings2 className="h-5 w-5 text-primary" /> Tuning
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  ["launchRpm", "Launch RPM", 2500, 7200],
                  ["shiftRpm", "Shift RPM", 3500, 8500],
                  ["gearing", "Gearing", 0, 100],
                  ["tireSetup", "Tire Setup", 0, 100],
                ].map(([key, label, min, max]) => (
                  <label key={key as string} className="block space-y-1">
                    <div className="flex justify-between text-xs font-black uppercase">
                      <span>{label}</span>
                      <span>{tuning[key as keyof GarageTuning]}</span>
                    </div>
                    <input
                      type="range"
                      min={min as number}
                      max={max as number}
                      value={tuning[key as keyof GarageTuning]}
                      className="w-full accent-amber-500"
                      disabled={phase !== "staging"}
                      onChange={(event) => updateTuning(key as keyof GarageTuning, Number(event.target.value))}
                    />
                  </label>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 uppercase">
                  <Zap className="h-5 w-5 text-primary" /> Opponent
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {opponents.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    disabled={phase !== "staging"}
                    onClick={() => setOpponentKey(item.key)}
                    className={cn(
                      "w-full rounded-md border p-3 text-left transition-colors disabled:opacity-60",
                      item.key === opponentKey ? "border-primary bg-primary/10" : "border-border bg-muted/20 hover:border-primary/60",
                    )}
                  >
                    <div className="flex justify-between gap-3">
                      <span className="font-black uppercase">{item.name}</span>
                      <span className="font-mono font-bold">CR {item.rewardCredits}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Power {item.power}/10 - Traction {item.traction}/10 - Consistency {item.consistency}/10</p>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
