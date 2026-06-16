import { Link, useLocation } from "wouter";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Car, Flag, Gauge, MessageSquare, RotateCcw, Settings2, Zap } from "lucide-react";
import { getListSavesQueryKey, useListSaves } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { garageApi, defaultGarageTuning, factoryGarageTuning, type GarageTuning, type OwnedVehicle } from "@/services/garageApi";
import { opponentsForVehicle, simulateDragRace, type DragOpponent, type DragRaceResult } from "@/game/dragRaceEngine";
import { deriveVehiclePerformance, suspensionTuningProfile, tuningProjection, type VehiclePerformance } from "@/data/vehiclePerformance";
import { finalDriveForGearing } from "@/data/gearing";
import { recordVehicleService, saveTuningPreset, summarizeVehicleFile, tuningSlotIds, type TuningSlotId } from "@/data/vehicleFiles";
import { vehicleTopDownSprite, vehicleTrackTopDownSprite } from "@/data/vehicles";
import { latestActiveSeriesSave, recordCareerDragRace } from "@/data/activeCareer";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { driverScopedQueryKey } from "@/data/driverIdentity";

const DRAG_DIFFICULTY = {
  countdownMs: 2600,
  raceDistanceMeters: 402,
  maxRaceSeconds: 32,
  shiftGears: [2, 3, 4],
  shiftWindowMeters: [52, 145, 255],
  shiftWindowPaddingMeters: 18,
  shiftReadyRpm: 6200,
  redlineRpm: 8200,
  dangerRpm: 8050,
  beginnerReactionGraceMs: 260,
  speedScale: 1.55,
  idleRpm: 1100,
  stagedRpm: 2800,
};

const RED_LIGHT_LIMIT = 3;
const RED_LIGHT_DAMAGE = 2;
const MANUAL_REWARD_BONUS_RATE = 0.25;
const MANUAL_XP_BONUS = 20;
const PERFECT_SCORE_THRESHOLD = 0.9;
const BASE_SPEED_LIMIT_RATE = 0.84;
const PERFECT_LAUNCH_SPEED_LIMIT_RATE = 1;
const PERFECT_SHIFT_SPEED_LIMIT_BONUS = 0.05;
const MAX_SKILL_SPEED_LIMIT_RATE = 1.15;
const TRACK_START_PCT = 20;
const TRACK_FINISH_PCT = 94;
const TRACK_RACE_WIDTH_PCT = TRACK_FINISH_PCT - TRACK_START_PCT;
const TRACK_STAGING_GAP_PCT = 4.5;

type RacePhase = "staging" | "countdown" | "launching" | "racing" | "result";
type RaceTransmission = "automatic" | "manual";
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
  overRevMs: number;
  badShiftCount: number;
  nitrousShots: number;
  nitrousBoostMs: number;
  nitrousMs: number;
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
  overRevMs: 0,
  badShiftCount: 0,
  nitrousShots: 0,
  nitrousBoostMs: 0,
  nitrousMs: 0,
};

function formatTime(ms: number): string {
  return `${(ms / 1000).toFixed(3)}s`;
}

function selectVehicle(vehicles: OwnedVehicle[], key: string | null): OwnedVehicle | undefined {
  return vehicles.find((vehicle) => vehicle.canonicalVehicleKey === key)
    ?? vehicles.find((vehicle) => vehicle.isActive)
    ?? vehicles[0];
}

function feedbackFor(kind: "launch" | "shift", grade: TimingGrade): string {
  if (kind === "launch") {
    if (grade === "perfect") return "Perfect launch";
    if (grade === "too-early") return "Bogged launch";
    if (grade === "late" || grade === "missed") return "Wheelspin";
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

function scoreForRpm(rpm: number, target: number): number {
  return Math.max(0, 1 - Math.abs(rpm - target) / 2600);
}

function gradeForRpm(rpm: number, target: number): TimingGrade {
  const delta = rpm - target;
  const abs = Math.abs(delta);
  if (abs <= 260) return "perfect";
  if (abs <= 900) return "good";
  if (delta < 0) return "too-early";
  if (abs <= 1500) return "late";
  return "missed";
}

function gradeClass(grade: TimingGrade): string {
  if (grade === "perfect") return "border-green-400 bg-green-500/20 text-green-100";
  if (grade === "good") return "border-amber-400 bg-amber-500/20 text-amber-100";
  if (grade === "late") return "border-orange-400 bg-orange-500/20 text-orange-100";
  return "border-red-400 bg-red-500/20 text-red-100";
}

function opponentSpriteName(opponent: DragOpponent): string {
  if (opponent.vehicleName) return opponent.vehicleName;
  if (opponent.key.includes("midnight")) return "Dodge Challenger SRT Demon";
  if (opponent.key.includes("runway")) return "Ford Mustang GT";
  return "Volkswagen Golf GTI";
}

function rating100(value: number): number {
  return Math.max(1, Math.min(100, Math.round(value * 10)));
}

function transmissionMode(name: string): "automatic" | "manual" {
  return /audi|mclaren|p1|laferrari|ferrari|porsche 918|chiron|veyron|rimac|lamborghini|tesla|lexus|mercedes|amg|range rover|rolls|bentley/i.test(name)
    ? "automatic"
    : "manual";
}

function mechanicalDamageFor(runtime: RaceRuntime, launchScore: number, shiftScores: number[]): number {
  const launchDamage = launchScore < 0.18 ? 4 : launchScore < 0.35 ? 2 : 0;
  const shiftDamage = shiftScores.filter((score) => score < 0.3).length * 3 + runtime.badShiftCount * 2;
  const overRevDamage = Math.floor(runtime.overRevMs / 550) * 2;
  const nitrousDamage = Math.floor(runtime.nitrousMs / 1400);
  return Math.min(34, launchDamage + shiftDamage + overRevDamage + nitrousDamage);
}

function faultFor(result: DragRaceResult): string | null {
  if (result.breakdown.fault === "false-start") return `Third red light. You lose the pot after ${result.breakdown.redLightStrikes ?? RED_LIGHT_LIMIT} strikes.`;
  if (result.breakdown.fault === "engine-risk") return "Engine damage from holding it near redline.";
  if (result.breakdown.fault === "missed-shifts") return "Missed shifts cost time and hurt the driveline.";
  return null;
}

function gaugeNeedleRotation(value: number, max: number): number {
  return -132 + Math.max(0, Math.min(1, value / max)) * 264;
}

function realisticTrapSpeed(result: DragRaceResult, runtimeSpeedMph: number): number {
  if (result.breakdown.fault === "false-start") return 0;
  const etSeconds = Math.max(6.4, result.elapsedMs / 1000);
  const powerTrap = 250 * Math.cbrt(result.breakdown.horsepower / Math.max(1, result.breakdown.weight));
  const etTrap = 402 / etSeconds * 2.237 * 1.23;
  const modeledTrap = powerTrap * 0.72 + etTrap * 0.28;
  const conditionFactor = 1 - Math.max(0, result.breakdown.conditionPenalty) / 600;
  const blended = runtimeSpeedMph * 0.75 + modeledTrap * 0.25;
  return Math.round(Math.max(58, Math.min(225, blended * conditionFactor)));
}

function skillSpeedLimitRate(launchScore: number | null, shiftScores: number[]): number {
  if ((launchScore ?? 0) < PERFECT_SCORE_THRESHOLD) return BASE_SPEED_LIMIT_RATE;
  let perfectShiftStreak = 0;
  for (const score of shiftScores) {
    if (score < PERFECT_SCORE_THRESHOLD) break;
    perfectShiftStreak += 1;
  }
  return Math.min(MAX_SKILL_SPEED_LIMIT_RATE, PERFECT_LAUNCH_SPEED_LIMIT_RATE + perfectShiftStreak * PERFECT_SHIFT_SPEED_LIMIT_BONUS);
}

function liveQuarterMileSpeedLimitMph(performance: VehiclePerformance, tuning: GarageTuning, condition: number, nitrousTier = 0, limiterRate = BASE_SPEED_LIMIT_RATE): number {
  const projected = tuningProjection(performance, tuning, condition);
  const finalDrive = finalDriveForGearing(tuning.gearing);
  const effectivePower = projected.wheelHorsepower * 0.55 + performance.horsepower * 0.45;
  const baseTrap = 250 * Math.cbrt(effectivePower / Math.max(1, performance.weight));
  const tractionFactor = 0.9 + Math.min(0.16, projected.launchGrip / 520);
  const aeroFactor = 1 - Math.max(0, (tuning.downforce ?? 35) - 35) / 900 + Math.max(0, 35 - (tuning.downforce ?? 35)) / 650;
  const gearingFactor = 0.98 + (finalDrive.launchFactor - 1) * 0.16 + (finalDrive.topSpeedFactor - 1) * 0.2;
  const nitrousFactor = 1 + Math.min(0.14, nitrousTier * 0.028 + (tuning.nitrousShots ?? 0) * 0.006);
  const conditionFactor = Math.max(0.7, condition / 100);
  const quarterTrap = baseTrap * tractionFactor * aeroFactor * gearingFactor * nitrousFactor * conditionFactor;
  const skillGain = Math.max(0, limiterRate - BASE_SPEED_LIMIT_RATE);
  const skillTrapLimit = quarterTrap * (1 + skillGain * 0.65);
  const topSpeedLimit = projected.topSpeedMph * limiterRate;
  return Math.round(Math.max(72, Math.min(projected.topSpeedMph, topSpeedLimit, skillTrapLimit)));
}

function AnalogGauge({ label, value, max, unit, marks, redFrom, targetValue, targetLabel }: {
  label: string;
  value: number;
  max: number;
  unit: string;
  marks: number[];
  redFrom?: number;
  targetValue?: number;
  targetLabel?: string;
}) {
  const rotation = gaugeNeedleRotation(value, max);
  const targetRotation = targetValue == null ? null : gaugeNeedleRotation(targetValue, max);
  return (
    <div className="mx-auto flex w-[clamp(118px,15dvh,170px)] shrink-0 flex-col items-center gap-1">
      <div className="relative aspect-square w-full rounded-full border border-zinc-600 bg-[radial-gradient(circle_at_50%_42%,#303744_0%,#13161d_48%,#050608_100%)] shadow-[inset_0_0_24px_rgba(255,255,255,0.08),0_12px_28px_rgba(0,0,0,0.45)]">
        <svg viewBox="0 0 160 160" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id={`${label}-chrome`} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#d7dde8" stopOpacity="0.45" />
              <stop offset="48%" stopColor="#475063" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#050608" stopOpacity="0.65" />
            </linearGradient>
          </defs>
          <circle cx="80" cy="80" r="74" fill="none" stroke={`url(#${label}-chrome)`} strokeWidth="5" />
          <path d="M 25 116 A 66 66 0 1 1 135 116" fill="none" stroke="#172339" strokeWidth="14" strokeLinecap="round" />
          {redFrom != null && (
            <path d="M 25 116 A 66 66 0 1 1 135 116" fill="none" stroke="#ef4444" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${Math.max(8, (1 - redFrom / max) * 176)} 210`} strokeDashoffset="-172" opacity="0.72" />
          )}
          {targetRotation != null && (
            <g transform={`rotate(${targetRotation} 80 80)`}>
              <line x1="80" y1="8" x2="80" y2="32" stroke="#22c55e" strokeWidth="5" strokeLinecap="round" />
              <line x1="80" y1="8" x2="80" y2="32" stroke="#dcfce7" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
              <text x="80" y="54" textAnchor="middle" fill="#86efac" fontSize="8" fontWeight="900" transform={`rotate(${-targetRotation} 80 54)`}>{targetLabel ?? "TARGET"}</text>
            </g>
          )}
          {marks.map((mark) => {
            const angle = gaugeNeedleRotation(mark, max);
            return (
              <g key={mark} transform={`rotate(${angle} 80 80)`}>
                <line x1="80" y1="14" x2="80" y2="25" stroke="#f8fafc" strokeWidth={mark % (max / 2) === 0 ? 3 : 2} strokeLinecap="round" />
                <text x="80" y="40" textAnchor="middle" fill="#d1d5db" fontSize="9" fontWeight="800" transform={`rotate(${-angle} 80 40)`}>{mark}</text>
              </g>
            );
          })}
          <g transform={`rotate(${rotation} 80 80)`}>
            <path d="M 78 82 L 80 24 L 82 82 Z" fill="#f43f5e" />
            <path d="M 79 82 L 80 30 L 81 82 Z" fill="#ffe4e6" opacity="0.75" />
          </g>
          <circle cx="80" cy="80" r="8" fill="#e5e7eb" />
          <circle cx="80" cy="80" r="4" fill="#111827" />
          <ellipse cx="60" cy="38" rx="42" ry="16" fill="#fff" opacity="0.08" />
        </svg>
      </div>
      <div className="text-center leading-tight">
        <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">{label}</p>
        <p className="font-mono text-sm font-black text-white">{Math.round(value).toLocaleString()} <span className="text-[10px] text-zinc-400">{unit}</span></p>
      </div>
    </div>
  );
}

export default function DragRace() {
  const queryClient = useQueryClient();
  const garageQueryKey = driverScopedQueryKey("garage");
  const [location, setLocation] = useLocation();
  const [, queryString = ""] = location.split("?");
  const searchParams = new URLSearchParams(queryString || window.location.search);
  const requestedVehicle = searchParams.get("vehicle");
  const requestedOpponent = searchParams.get("opponent");
  const requestedMode = searchParams.get("mode");

  const garageQuery = useQuery({
    queryKey: garageQueryKey,
    queryFn: garageApi.getGarage,
  });
  const savesQuery = useListSaves({ query: { queryKey: getListSavesQueryKey() } });

  const garage = garageQuery.data;
  const activeCareerSave = useMemo(() => latestActiveSeriesSave(savesQuery.data), [savesQuery.data]);
  const vehicle = selectVehicle(garage?.vehicles ?? [], requestedVehicle);
  const opponents = useMemo(() => opponentsForVehicle(vehicle ? { ...vehicle, tuning: { ...defaultGarageTuning, ...(vehicle.tuning ?? {}) } } : undefined), [vehicle]);
  const [opponentKey, setOpponentKey] = useState(requestedOpponent ?? opponents[0]?.key ?? "service-road-sleeper");
  const opponent = opponents.find((item) => item.key === opponentKey) ?? opponents[0];
  const entryFee = opponent ? Math.max(100, Math.round(opponent.rewardCredits / 2)) : 0;
  const potCredits = entryFee * 2;
  const [tuning, setTuning] = useState<GarageTuning>({ ...defaultGarageTuning, ...(vehicle?.tuning ?? {}) });
  const [phase, setPhase] = useState<RacePhase>("staging");
  const [throttleHeld, setThrottleHeld] = useState(false);
  const [nitrousHeld, setNitrousHeld] = useState(false);
  const [launchScore, setLaunchScore] = useState<number | null>(null);
  const [shiftScores, setShiftScores] = useState<number[]>([]);
  const [reactionMs, setReactionMs] = useState<number | null>(null);
  const [runtime, setRuntime] = useState<RaceRuntime>(initialRuntime);
  const [feedback, setFeedback] = useState<string>("Stage both cars and wait for green.");
  const [result, setResult] = useState<DragRaceResult | null>(null);
  const [countdownStep, setCountdownStep] = useState(0);
  const [redLightStrikes, setRedLightStrikes] = useState(0);
  const [entryPaid, setEntryPaid] = useState(false);
  const [selectedTransmission, setSelectedTransmission] = useState<RaceTransmission | null>(null);
  const [forceChallengeBoard, setForceChallengeBoard] = useState(false);
  const [vehicleFileVersion, setVehicleFileVersion] = useState(0);

  const countdownStartedAt = useRef<number | null>(null);
  const greenAt = useRef<number | null>(null);
  const raceStartedAt = useRef<number | null>(null);
  const lastFrameAt = useRef<number | null>(null);
  const launchScoreRef = useRef<number | null>(null);
  const shiftScoresRef = useRef<number[]>([]);
  const runtimeRef = useRef<RaceRuntime>(initialRuntime);
  const savedResultRef = useRef(false);
  const throttleHeldRef = useRef(false);
  const nitrousHeldRef = useRef(false);
  const vehicleConditionRef = useRef(vehicle?.condition ?? 100);
  const redLightProcessingRef = useRef(false);
  const throttlePointerIdRef = useRef<number | null>(null);

  const saveTuningMutation = useMutation({
    mutationFn: ({ selected, nextTuning }: { selected: OwnedVehicle; nextTuning: GarageTuning }) =>
      garageApi.saveTuning(selected.canonicalVehicleKey, nextTuning, 0),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: garageQueryKey }),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: garageQueryKey }),
  });

  useEffect(() => {
    if (vehicle) {
      setTuning({ ...defaultGarageTuning, ...(vehicle.tuning ?? {}) });
      vehicleConditionRef.current = vehicle.condition;
    }
  }, [vehicle?.canonicalVehicleKey]);

  useEffect(() => {
    if (requestedOpponent && opponents.some((item) => item.key === requestedOpponent)) {
      setOpponentKey(requestedOpponent);
      return;
    }
    if (!opponents.some((item) => item.key === opponentKey)) {
      setOpponentKey(opponents[0]?.key ?? "service-road-sleeper");
    }
  }, [opponents, opponentKey, requestedOpponent]);

  useEffect(() => {
    setSelectedTransmission(null);
  }, [requestedVehicle, requestedOpponent]);

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
    throttleHeldRef.current = throttleHeld;
  }, [throttleHeld]);

  useEffect(() => {
    nitrousHeldRef.current = nitrousHeld;
  }, [nitrousHeld]);

  useEffect(() => {
    if (phase !== "countdown" && phase !== "launching") return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const next = { ...runtimeRef.current };
      const throttleTarget = throttleHeldRef.current ? DRAG_DIFFICULTY.redlineRpm + 320 : DRAG_DIFFICULTY.idleRpm;
      const response = throttleHeldRef.current ? 3600 : 2600;
      const rpmDelta = Math.sign(throttleTarget - next.rpm) * Math.min(Math.abs(throttleTarget - next.rpm), response * dt);
      next.rpm = Math.round(Math.max(DRAG_DIFFICULTY.idleRpm, Math.min(DRAG_DIFFICULTY.redlineRpm + 650, next.rpm + rpmDelta)));
      if (next.rpm >= DRAG_DIFFICULTY.dangerRpm) next.overRevMs += dt * 1000;
      runtimeRef.current = next;
      setRuntime(next);
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
    const finalShiftScores = shiftScoresRef.current;
    const finalShiftScore = shiftScoresRef.current.length > 0
      ? shiftScoresRef.current.reduce((total, score) => total + score, 0) / shiftScoresRef.current.length
      : 0.45;
    const finalReactionMs = reactionMs ?? DRAG_DIFFICULTY.beginnerReactionGraceMs;
    const mechanicalDamage = mechanicalDamageFor(finalRuntime, finalLaunchScore, finalShiftScores);
    const simulated = simulateDragRace({
      vehicle: { ...vehicle, tuning },
      opponent,
      launchScore: finalLaunchScore,
      shiftScore: finalShiftScore,
      reactionMs: finalReactionMs,
    });
    const visualElapsedMs = finalRuntime.playerFinishedMs ?? simulated.elapsedMs;
    const visualOpponentMs = finalRuntime.opponentFinishedMs ?? simulated.opponentElapsedMs;
    const finalElapsedMs = Math.round((visualElapsedMs + simulated.elapsedMs) / 2);
    const finalOpponentElapsedMs = Math.round((visualOpponentMs + simulated.opponentElapsedMs) / 2);
    const runtimeTrapMph = Math.max(0, Math.round(finalRuntime.playerSpeed * 2.237));
    const raceTransmission = selectedTransmission ?? "automatic";
    const wonRace = visualElapsedMs <= visualOpponentMs;
    const manualBonusCredits = raceTransmission === "manual" && wonRace ? Math.round(potCredits * MANUAL_REWARD_BONUS_RATE) : 0;
    const xpBonus = raceTransmission === "manual" ? MANUAL_XP_BONUS : 0;
    const final: DragRaceResult = {
      ...simulated,
      elapsedMs: finalElapsedMs,
      opponentElapsedMs: finalOpponentElapsedMs,
      trapSpeed: realisticTrapSpeed({ ...simulated, elapsedMs: finalElapsedMs }, runtimeTrapMph),
      won: wonRace,
      rewardCredits: wonRace ? potCredits + manualBonusCredits : 0,
      breakdown: {
        ...simulated.breakdown,
        overRevMs: Math.round(finalRuntime.overRevMs),
        mechanicalDamage,
        nitrousUsed: Math.max(0, (tuning.nitrousShots ?? 0) - finalRuntime.nitrousShots),
        entryFee,
        potCredits,
        transmissionMode: raceTransmission,
        manualBonusCredits,
        xpBonus,
        redLightStrikes,
        fault: mechanicalDamage >= 10
          ? "engine-risk"
          : finalRuntime.badShiftCount > 0 || finalShiftScores.some((score) => score < 0.3)
            ? "missed-shifts"
            : undefined,
      },
    };
    setResult(final);
    setPhase("result");
    setFeedback(mechanicalDamage > 0
      ? `${final.won ? "Win light" : "Loss"} - the car took ${mechanicalDamage}% damage.`
      : final.won ? "Win light!" : "Opponent got there first.");
    recordVehicleService(vehicle.canonicalVehicleKey, {
      type: "race",
      summary: `${final.won ? "Won" : "Lost"} vs ${opponent.name}: ET ${formatTime(final.elapsedMs)}, trap ${final.trapSpeed} mph, ${final.rewardCredits > 0 ? `GBP +${final.rewardCredits.toLocaleString()}` : "no payout"}.`,
    });
    setVehicleFileVersion((version) => version + 1);
    await raceMutation.mutateAsync({ ...final, selected: vehicle, opponent }).catch(() => {
      toast({ title: "Race result not saved", variant: "destructive" });
    });
    recordCareerDragRace(activeCareerSave, {
      won: final.won,
      rewardCredits: final.rewardCredits,
      elapsedMs: final.elapsedMs,
      opponentName: opponent.name,
      xpBonus,
    });
    if (mechanicalDamage > 0) {
      vehicleConditionRef.current = Math.max(0, vehicleConditionRef.current - mechanicalDamage);
      await garageApi.patchVehicle(vehicle.canonicalVehicleKey, {
        condition: vehicleConditionRef.current,
      }).catch(() => {
        toast({ title: "Vehicle damage not saved", variant: "destructive" });
      });
      await queryClient.invalidateQueries({ queryKey: garageQueryKey });
    }
    setEntryPaid(false);
  }, [activeCareerSave, entryFee, opponent, potCredits, queryClient, raceMutation, reactionMs, redLightStrikes, selectedTransmission, tuning, vehicle]);

  useEffect(() => {
    if (phase !== "racing" || !vehicle || !opponent) return;
    let raf = 0;
    lastFrameAt.current = performance.now();
    raceStartedAt.current = raceStartedAt.current ?? performance.now();
    const vehiclePerformance = deriveVehiclePerformance(vehicle, vehicle.upgrades);
    const raceTransmission = selectedTransmission ?? transmissionMode(vehicle.name);
    const nitrousTier = vehicle.upgrades.nitrous ?? 0;
    const opponentSpeedLimit = Math.max(31, Math.min(86, (98 + opponent.power * 8 + opponent.traction * 2) / 2.237));
    const powerFactor = Math.min(3.4, Math.max(0.75, vehiclePerformance.horsepower / 420));
    const tirePressureGrip = 1 + Math.max(-0.12, Math.min(0.16, (34 - (tuning.tirePressure ?? 32)) / 50));
    const suspensionProfile = suspensionTuningProfile(tuning.suspension ?? 50);
    const suspensionGrip = 1 + suspensionProfile.gripBonus;
    const finalDrive = finalDriveForGearing(tuning.gearing);
    const projectedPerformance = tuningProjection(vehiclePerformance, tuning, vehicle.condition);
    const downforceDrag = 1 - Math.max(0, (tuning.downforce ?? 35) - 35) / 450;
    const gripFactor = Math.min(1.5, Math.max(0.55, (vehiclePerformance.traction / 6.5) * tirePressureGrip * suspensionGrip));
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
      const nextShiftMeter = DRAG_DIFFICULTY.shiftWindowMeters[next.shiftIndex] ?? DRAG_DIFFICULTY.raceDistanceMeters;
      const shiftZoneStart = nextShiftMeter - DRAG_DIFFICULTY.shiftWindowPaddingMeters;
      const shiftZoneEnd = nextShiftMeter + DRAG_DIFFICULTY.shiftWindowPaddingMeters;
      const shiftZoneProgress = Math.max(0, Math.min(1, (next.playerMeters - shiftZoneStart) / (shiftZoneEnd - shiftZoneStart)));
      const overRevFactor = next.shiftIndex < DRAG_DIFFICULTY.shiftGears.length && next.playerMeters > shiftZoneEnd ? 0.72 : 1;
      const playerLaunchBoost = (0.72 + launch * 0.56) * suspensionProfile.accelerationFactor;
      const playerShiftBoost = 0.72 + shiftAverage * 0.36;
      const gearRatio = (1.08 - Math.min(0.34, (next.gear - 1) * 0.1)) * finalDrive.launchFactor;
      const throttleFactor = throttleHeldRef.current ? 1 : 0.18;
      const nitrousActive = next.nitrousBoostMs > 0 && next.playerFinishedMs == null;
      const nitrousBoost = nitrousActive ? 1 + nitrousTier * 0.22 : 1;
      const speedLimiterRate = skillSpeedLimitRate(launchScoreRef.current, shiftScoresRef.current);
      const playerSpeedLimitMph = liveQuarterMileSpeedLimitMph(vehiclePerformance, tuning, vehicle.condition, nitrousTier, speedLimiterRate);
      const activePlayerSpeedLimit = Math.min(projectedPerformance.topSpeedMph, playerSpeedLimitMph + (nitrousActive ? 8 + nitrousTier * 6 : 0)) / 2.237;
      const playerAccel = (8.6 * powerFactor * gripFactor * conditionFactor * playerLaunchBoost * playerShiftBoost * gearRatio)
        * throttleFactor * nitrousBoost * overRevFactor * downforceDrag - next.playerSpeed * (0.045 + (tuning.downforce ?? 35) / 4500);
      const opponentAccel = (8.25 * opponentPower * opponentGrip * (0.9 + opponent.consistency / 40))
        - next.opponentSpeed * 0.048;

      if (next.playerFinishedMs == null) {
        next.playerSpeed = Math.min(activePlayerSpeedLimit, Math.max(0, next.playerSpeed + playerAccel * dt * DRAG_DIFFICULTY.speedScale));
        next.playerMeters = Math.min(DRAG_DIFFICULTY.raceDistanceMeters, next.playerMeters + next.playerSpeed * dt);
        if (next.playerMeters >= DRAG_DIFFICULTY.raceDistanceMeters) next.playerFinishedMs = elapsedMs;
      }
      if (nitrousActive) {
        next.nitrousBoostMs = Math.max(0, next.nitrousBoostMs - dt * 1000);
        next.nitrousMs += dt * 1000;
        if (next.nitrousBoostMs <= 0) setNitrousHeld(false);
        if (next.rpm > DRAG_DIFFICULTY.dangerRpm - 250) next.overRevMs += dt * 650;
      }
      if (next.opponentFinishedMs == null) {
        next.opponentSpeed = Math.min(opponentSpeedLimit, Math.max(0, next.opponentSpeed + opponentAccel * dt * DRAG_DIFFICULTY.speedScale));
        next.opponentMeters = Math.min(DRAG_DIFFICULTY.raceDistanceMeters, next.opponentMeters + next.opponentSpeed * dt);
        if (next.opponentMeters >= DRAG_DIFFICULTY.raceDistanceMeters) next.opponentFinishedMs = elapsedMs;
      }

      const rpmBase = 2500 + next.playerSpeed * (54 / Math.max(1, next.gear)) + shiftZoneProgress * 3800 + (nitrousActive ? 520 : 0);
      const throttleRpm = throttleHeldRef.current ? rpmBase + 700 : rpmBase - 1800;
      next.rpm = Math.round(Math.max(DRAG_DIFFICULTY.idleRpm, Math.min(DRAG_DIFFICULTY.redlineRpm + 650, throttleRpm)));
      if (raceTransmission === "automatic" && next.shiftIndex < DRAG_DIFFICULTY.shiftGears.length && next.rpm >= tuning.shiftRpm) {
        const nextGear = DRAG_DIFFICULTY.shiftGears[next.shiftIndex] ?? next.gear + 1;
        next.gear = nextGear;
        next.shiftIndex += 1;
        next.playerSpeed = Math.max(3, next.playerSpeed + 1.4);
        next.rpm = 4700;
        shiftScoresRef.current = [...shiftScoresRef.current, 0.78];
      }
      if (next.rpm >= DRAG_DIFFICULTY.dangerRpm || overRevFactor < 1) {
        next.overRevMs += dt * 1000;
        if (next.overRevMs > 900 && Math.floor(next.overRevMs / 300) % 2 === 0) {
          setFeedback("Lift or shift. The engine is unhappy.");
        }
      }
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
  }, [finishRace, opponent, phase, selectedTransmission, tuning, vehicle]);

  const startRace = async () => {
    if (!vehicle || !opponent) return;
    if (!selectedTransmission) {
      toast({ title: "Choose transmission", description: "Pick automatic or manual before staging." });
      return;
    }
    if (!entryPaid) {
      if ((garage?.profile.credits ?? 0) < entryFee) {
        toast({ title: "Not enough Garage GBP", description: `You need GBP ${entryFee.toLocaleString()} to enter this race.`, variant: "destructive" });
        return;
      }
      const paid = await garageApi.awardCredits(-entryFee, `Drag race entry vs ${opponent.name}`).then(() => true).catch(() => {
        toast({ title: "Entry fee not paid", variant: "destructive" });
        return false;
      });
      if (!paid) return;
      await queryClient.invalidateQueries({ queryKey: garageQueryKey });
      setEntryPaid(true);
    }
    const nextTuning = { ...defaultGarageTuning, ...tuning };
    setTuning(nextTuning);
    await saveTuningMutation.mutateAsync({ selected: vehicle, nextTuning }).catch(() => undefined);
    savedResultRef.current = false;
    setResult(null);
    setLaunchScore(null);
    setShiftScores([]);
    launchScoreRef.current = null;
    shiftScoresRef.current = [];
    setThrottleHeld(false);
    throttleHeldRef.current = false;
    setNitrousHeld(false);
    nitrousHeldRef.current = false;
    setReactionMs(null);
    const nextRuntime = { ...initialRuntime, nitrousShots: nextTuning.nitrousShots ?? 0 };
    setRuntime(nextRuntime);
    runtimeRef.current = nextRuntime;
    raceStartedAt.current = null;
    setCountdownStep(0);
    setFeedback("Watch the tree.");
    setPhase("countdown");
  };

  const falseStart = async () => {
    if (!vehicle || !opponent || savedResultRef.current || redLightProcessingRef.current) return;
    redLightProcessingRef.current = true;
    const nextStrikes = redLightStrikes + 1;
    setRedLightStrikes(nextStrikes);
    vehicleConditionRef.current = Math.max(0, vehicleConditionRef.current - RED_LIGHT_DAMAGE);
    recordVehicleService(vehicle.canonicalVehicleKey, {
      type: "race",
      summary: `Red light strike ${nextStrikes}/${RED_LIGHT_LIMIT} vs ${opponent.name}; tire and engine wear cost ${RED_LIGHT_DAMAGE}% condition.`,
    });
    setVehicleFileVersion((version) => version + 1);
    await garageApi.patchVehicle(vehicle.canonicalVehicleKey, {
      condition: vehicleConditionRef.current,
    }).catch(() => {
      toast({ title: "Vehicle wear not saved", variant: "destructive" });
    });
    await queryClient.invalidateQueries({ queryKey: garageQueryKey });
    setThrottleHeld(false);
    throttleHeldRef.current = false;
    setNitrousHeld(false);
    nitrousHeldRef.current = false;
    setReactionMs(null);
    setCountdownStep(0);
    greenAt.current = null;
    countdownStartedAt.current = null;
    raceStartedAt.current = null;
    const nextRuntime = { ...initialRuntime, nitrousShots: runtimeRef.current.nitrousShots, overRevMs: runtimeRef.current.overRevMs };
    setRuntime(nextRuntime);
    runtimeRef.current = nextRuntime;
    if (nextStrikes < RED_LIGHT_LIMIT) {
      setFeedback(`Red light strike ${nextStrikes}/${RED_LIGHT_LIMIT}. Tire and engine wear cost ${RED_LIGHT_DAMAGE}% condition. Stage again.`);
      setPhase("staging");
      redLightProcessingRef.current = false;
      return;
    }
    savedResultRef.current = true;
    const final: DragRaceResult = {
      elapsedMs: DRAG_DIFFICULTY.maxRaceSeconds * 1000,
      opponentElapsedMs: 1,
      trapSpeed: 1,
      won: false,
      rewardCredits: 0,
      breakdown: {
        horsepower: vehiclePerformance.horsepower,
        weight: vehiclePerformance.weight,
        drivetrain: vehiclePerformance.drivetrain,
        tier: vehiclePerformance.tier,
        traction: vehiclePerformance.traction,
        launchQuality: 0,
        shiftQuality: 0,
        reactionMs: -1,
        conditionPenalty: Math.round(Math.max(0, (100 - vehicle.condition) / 100) * 100),
        tuningBonus: 0,
        mechanicalDamage: RED_LIGHT_DAMAGE,
        nitrousUsed: 0,
        entryFee,
        potCredits,
        transmissionMode: selectedTransmission ?? "automatic",
        manualBonusCredits: 0,
        xpBonus: 0,
        redLightStrikes: nextStrikes,
        fault: "false-start",
      },
    };
    setResult(final);
    setFeedback(`Third red light. You lose the pot and the car took ${RED_LIGHT_DAMAGE}% wear.`);
    setPhase("result");
    await raceMutation.mutateAsync({ ...final, selected: vehicle, opponent }).catch(() => {
      toast({ title: "Race result not saved", variant: "destructive" });
    });
    recordCareerDragRace(activeCareerSave, {
      won: final.won,
      rewardCredits: final.rewardCredits,
      elapsedMs: final.elapsedMs,
      opponentName: opponent.name,
      xpBonus: 0,
    });
    setEntryPaid(false);
    redLightProcessingRef.current = false;
  };

  const launch = () => {
    if (phase !== "launching") return;
    const launchRpm = runtimeRef.current.rpm;
    const grade = gradeForRpm(launchRpm, tuning.launchRpm);
    const score = scoreForRpm(launchRpm, tuning.launchRpm);
    const now = performance.now();
    const rawReaction = greenAt.current ? now - greenAt.current : DRAG_DIFFICULTY.beginnerReactionGraceMs;
    const reaction = Math.max(0, Math.round(rawReaction));
    const speedPenalty = grade === "too-early" ? 0.35 : grade === "late" || grade === "missed" ? 0.45 : grade === "perfect" ? 2.2 : 1.35;
    setLaunchScore(score);
    launchScoreRef.current = score;
    setReactionMs(reaction);
    setRuntime((current) => {
      const next = { ...current, playerSpeed: speedPenalty, opponentSpeed: 0.95, rpm: Math.max(2600, Math.round(launchRpm * 0.72)) };
      runtimeRef.current = next;
      return next;
    });
    raceStartedAt.current = now;
    setFeedback(feedbackFor("launch", grade));
    setPhase("racing");
  };

  const shift = () => {
    if (phase !== "racing") return;
    if ((selectedTransmission ?? (vehicle ? transmissionMode(vehicle.name) : "automatic")) !== "manual") return;
    const current = runtimeRef.current;
    if (current.shiftIndex >= DRAG_DIFFICULTY.shiftGears.length) return;
    const isReady = current.rpm >= 3600;
    if (!isReady) {
      setShiftScores((scores) => {
        const nextScores = [...scores, 0];
        shiftScoresRef.current = nextScores;
        return nextScores;
      });
      setRuntime((prior) => {
        const nextGear = DRAG_DIFFICULTY.shiftGears[prior.shiftIndex] ?? prior.gear + 1;
        const next = {
          ...prior,
          gear: nextGear,
          shiftIndex: prior.shiftIndex + 1,
          badShiftCount: prior.badShiftCount + 1,
          playerSpeed: Math.max(2, prior.playerSpeed - 5),
          rpm: 3200,
        };
        runtimeRef.current = next;
        return next;
      });
      setFeedback("Short shift. The car bogged.");
      return;
    }
    const grade = gradeForRpm(current.rpm, tuning.shiftRpm);
    const score = scoreForRpm(current.rpm, tuning.shiftRpm);
    setShiftScores((scores) => {
      const nextScores = [...scores, score];
      shiftScoresRef.current = nextScores;
      return nextScores;
    });
    setRuntime((prior) => {
      const nextGear = DRAG_DIFFICULTY.shiftGears[prior.shiftIndex] ?? prior.gear + 1;
      const speedDelta = grade === "perfect" ? 4.8 : grade === "good" ? 2.4 : grade === "late" ? -1.8 : -4.8;
      const next = {
        ...prior,
        gear: nextGear,
        shiftIndex: prior.shiftIndex + 1,
        playerSpeed: Math.max(3, prior.playerSpeed + speedDelta),
        rpm: grade === "perfect" ? 5100 : grade === "good" ? 4700 : 3400,
        badShiftCount: grade === "late" || grade === "missed" ? prior.badShiftCount + 1 : prior.badShiftCount,
      };
      runtimeRef.current = next;
      return next;
    });
    setFeedback(feedbackFor("shift", grade));
  };

  const resetRace = () => {
    setPhase("staging");
    setResult(null);
    setRedLightStrikes(0);
    setEntryPaid(false);
    setLaunchScore(null);
    setShiftScores([]);
    launchScoreRef.current = null;
    shiftScoresRef.current = [];
    setThrottleHeld(false);
    throttleHeldRef.current = false;
    setNitrousHeld(false);
    nitrousHeldRef.current = false;
    setReactionMs(null);
    const nextRuntime = { ...initialRuntime, nitrousShots: vehicle?.tuning?.nitrousShots ?? 0 };
    setRuntime(nextRuntime);
    runtimeRef.current = nextRuntime;
    setFeedback("Stage both cars and wait for green.");
    savedResultRef.current = false;
  };

  const applyTuning = (nextTuning: GarageTuning, serviceSummary?: string) => {
    if (!vehicle) return;
    setTuning(nextTuning);
    void saveTuningMutation.mutateAsync({ selected: vehicle, nextTuning }).catch(() => {
      toast({ title: "Tuning not saved", variant: "destructive" });
    });
    if (serviceSummary) {
      recordVehicleService(vehicle.canonicalVehicleKey, { type: "tuning", summary: serviceSummary });
      setVehicleFileVersion((version) => version + 1);
    }
  };

  const resetTuningToFactory = () => {
    if (!vehicle || phase !== "staging") return;
    const nextTuning = factoryGarageTuning(tuning);
    applyTuning(nextTuning, "Reset drag-strip tuning to factory settings.");
    toast({ title: "Factory tuning restored", description: `${vehicle.name} kept its loaded nitrous shots.` });
  };

  const saveCurrentTuningSlot = (slot: TuningSlotId) => {
    if (!vehicle) return;
    saveTuningPreset(vehicle.canonicalVehicleKey, slot, tuning);
    recordVehicleService(vehicle.canonicalVehicleKey, { type: "tuning", summary: `Saved current drag tuning to ${slot.replace("-", " ")}.` });
    setVehicleFileVersion((version) => version + 1);
    toast({ title: "Tuning preset saved", description: `${vehicle.name} ${slot.replace("-", " ")} updated.` });
  };

  const loadTuningSlot = (slot: TuningSlotId) => {
    if (!vehicle || phase !== "staging") return;
    const preset = summarizeVehicleFile(vehicle, garage?.raceHistory ?? []).file.tuningPresets[slot];
    if (!preset) {
      toast({ title: "Empty tuning slot", description: `${slot.replace("-", " ")} has not been saved yet.` });
      return;
    }
    const nextTuning = { ...preset.tuning, nitrousShots: tuning.nitrousShots };
    applyTuning(nextTuning, `Loaded ${preset.name} on the drag strip.`);
    toast({ title: "Tuning preset loaded", description: `${preset.name} applied; nitrous load preserved.` });
  };

  const setThrottleActive = (active: boolean) => {
    if (phase === "staging" || phase === "result") return;
    if (active && phase === "countdown") {
      throttleHeldRef.current = true;
      setThrottleHeld(true);
      void falseStart();
      return;
    }
    throttleHeldRef.current = active;
    setThrottleHeld(active);
    if (active && phase === "launching") launch();
  };

  const setNitrousActive = (active: boolean) => {
    if (!active) return;
    const hasNitrous = (vehicle?.upgrades.nitrous ?? 0) > 0;
    const current = runtimeRef.current;
    const canUseNitrous = hasNitrous && phase === "racing" && current.nitrousShots > 0 && current.nitrousBoostMs <= 0;
    if (!vehicle || !canUseNitrous) return;
    const nextShots = current.nitrousShots - 1;
    const nextRuntime = { ...current, nitrousShots: nextShots, nitrousBoostMs: 850 + (vehicle.upgrades.nitrous ?? 0) * 260 };
    runtimeRef.current = nextRuntime;
    setRuntime(nextRuntime);
    nitrousHeldRef.current = true;
    setNitrousHeld(true);
    const nextTuning = { ...tuning, nitrousShots: nextShots };
    setTuning(nextTuning);
    void saveTuningMutation.mutateAsync({ selected: vehicle, nextTuning }).catch(() => {
      toast({ title: "Nitrous shot not saved", variant: "destructive" });
    });
  };

  const pressThrottle = (event: PointerEvent<HTMLElement>) => {
    event.preventDefault();
    if (throttlePointerIdRef.current !== null) return;
    throttlePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setThrottleActive(true);
  };

  const releaseThrottle = (event: PointerEvent<HTMLElement>) => {
    event.preventDefault();
    if (throttlePointerIdRef.current !== event.pointerId) return;
    throttlePointerIdRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setThrottleActive(false);
  };

  const cancelThrottle = (event: PointerEvent<HTMLElement>) => {
    if (throttlePointerIdRef.current !== event.pointerId) return;
    throttlePointerIdRef.current = null;
    setThrottleActive(false);
  };

  const tapShift = (event: PointerEvent<HTMLElement>) => {
    event.preventDefault();
    shift();
  };

  const tapNitrous = (event: PointerEvent<HTMLElement>) => {
    event.preventDefault();
    setNitrousActive(true);
  };

  const updateTuning = (key: keyof GarageTuning, value: number) => {
    setTuning((current) => {
      const nextTuning = { ...current, [key]: value };
      if (vehicle && phase === "staging") {
        void saveTuningMutation.mutateAsync({ selected: vehicle, nextTuning }).catch(() => {
          toast({ title: "Tuning not saved", variant: "destructive" });
        });
      }
      return nextTuning;
    });
  };

  useEffect(() => {
    const isRangeInput = (event: KeyboardEvent) => (event.target as HTMLElement | null)?.tagName === "INPUT";
    const onKeyDown = (event: KeyboardEvent) => {
      if (isRangeInput(event)) return;
      if (event.code === "Space") {
        event.preventDefault();
        setThrottleActive(true);
      }
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
        event.preventDefault();
        shift();
      }
      if (event.code === "KeyN") {
        event.preventDefault();
        if (!event.repeat) setNitrousActive(true);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        setThrottleActive(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [phase, runtime.shiftIndex, selectedTransmission, tuning.launchRpm, tuning.shiftRpm, vehicle?.name, vehicle?.upgrades.nitrous]);


  if (garageQuery.isLoading) {
    return <div className="flex-1 p-8 text-muted-foreground">Loading drag strip...</div>;
  }

  if (!vehicle) {
    return (
      <div className="flex-1 p-6 md:p-12">
        <div className="mx-auto max-w-3xl rounded-md border border-dashed border-border bg-muted/20 p-10 text-center">
          <p className="mb-4 text-xl font-black uppercase">No Garage Vehicle</p>
          <p className="mb-6 text-muted-foreground">Open the garage and buy an unlocked starter car from the showroom before entering Quick Drag.</p>
          <Link href="/garage">
            <Button className="uppercase font-bold">Open Garage</Button>
          </Link>
        </div>
      </div>
    );
  }

  const vehiclePerformance = deriveVehiclePerformance(vehicle, vehicle.upgrades);
  const vehicleFileSummary = summarizeVehicleFile(vehicle, garage?.raceHistory ?? []);
  void vehicleFileVersion;
  const defaultTransmission = transmissionMode(vehicle.name);
  const transmission = selectedTransmission ?? defaultTransmission;
  const manualBonusPreview = Math.round(potCredits * MANUAL_REWARD_BONUS_RATE);
  const manualPotPreview = potCredits + manualBonusPreview;
  const racePotCredits = potCredits + (selectedTransmission === "manual" ? manualBonusPreview : 0);
  const showTransmissionPrompt = phase === "staging" && !selectedTransmission;
  const nitrousTier = vehicle.upgrades.nitrous ?? 0;
  const hasNitrous = nitrousTier > 0;
  const displayLimiterRate = skillSpeedLimitRate(launchScore, shiftScores);
  const liveSpeedLimitMph = liveQuarterMileSpeedLimitMph(vehiclePerformance, tuning, vehicle.condition, nitrousTier, displayLimiterRate);
  const projected = tuningProjection(vehiclePerformance, tuning, vehicle.condition);
  const baselineProjection = tuningProjection(vehiclePerformance, { ...defaultGarageTuning, ...(vehicle.tuning ?? {}) }, vehicle.condition);
  const finalDrive = finalDriveForGearing(tuning.gearing);
  const tuningGrip = projected.gripPct;
  const aeroDrag = projected.aeroPct;
  const gearingBias = projected.gearingBias;
  const playerProgress = Math.min(1, runtime.playerMeters / DRAG_DIFFICULTY.raceDistanceMeters);
  const opponentProgress = Math.min(1, runtime.opponentMeters / DRAG_DIFFICULTY.raceDistanceMeters);
  const targetRpm = phase === "countdown" || phase === "launching" ? tuning.launchRpm : tuning.shiftRpm;
  const currentGrade = gradeForRpm(runtime.rpm, targetRpm);
  const playerSprite = vehicleTrackTopDownSprite(vehicle.name, vehicle.power, vehicle.offRoad);
  const opponentName = opponentSpriteName(opponent);
  const opponentSprite = vehicleTrackTopDownSprite(opponentName, opponent.power, opponent.traction);
  const nextShiftGear = DRAG_DIFFICULTY.shiftGears[runtime.shiftIndex];
  const nextShiftMeter = DRAG_DIFFICULTY.shiftWindowMeters[runtime.shiftIndex] ?? DRAG_DIFFICULTY.raceDistanceMeters;
  const shiftArmed = runtime.rpm >= 3600;
  const canShift = transmission === "manual" && phase === "racing" && nextShiftGear != null && runtime.playerFinishedMs == null && shiftArmed;
  const speedMph = Math.min(liveSpeedLimitMph, Math.round(runtime.playerSpeed * 2.237));
  const rewardLabel = `Entry GBP ${entryFee.toLocaleString()} - Pot GBP ${racePotCredits.toLocaleString()}`;
  const rpmPercent = Math.max(0, Math.min(100, (runtime.rpm / DRAG_DIFFICULTY.redlineRpm) * 100));
  const shiftDistanceLabel = Math.max(0, Math.round(nextShiftMeter - runtime.playerMeters));
  const nitrousShots = runtime.nitrousShots;
  const boardHref = `/drag-race?mode=board&vehicle=${encodeURIComponent(vehicle.canonicalVehicleKey)}`;
  const goToChallengeBoard = () => {
    setSelectedTransmission(null);
    setOpponentKey(opponents[0]?.key ?? "service-road-sleeper");
    resetRace();
    setForceChallengeBoard(true);
    window.history.pushState(null, "", boardHref);
    setLocation(boardHref);
  };
  const hasRequestedOpponent = Boolean(requestedOpponent && opponents.some((item) => item.key === requestedOpponent));
  const showChallengeBoard = forceChallengeBoard || (requestedMode === "board" && !hasRequestedOpponent);
  const presenterResultLine = result
    ? result.won
      ? opponent.loseLine
      : opponent.winLine
    : opponent.intro;

  if (showChallengeBoard) {
    return (
      <div className="flex-1 overflow-y-auto bg-background p-3 md:p-6">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-primary">Garage Drag Race</p>
              <h1 className="text-3xl font-black uppercase tracking-tight md:text-4xl">Challenge Board</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Pick an opponent for your active garage car. Entry is paid when you stage, and winner takes the pot.
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/garage">
                <Button variant="outline" className="uppercase font-bold">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Garage
                </Button>
              </Link>
              <Link href="/">
                <Button variant="outline" className="hidden uppercase font-bold md:inline-flex">Main Menu</Button>
              </Link>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <Card className="border-2 border-primary/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 uppercase">
                  <Car className="h-5 w-5 text-primary" /> Your Garage Car
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-md border border-border bg-muted/20 p-3">
                  <p className="text-xs font-black uppercase text-muted-foreground">Selected</p>
                  <p className="text-xl font-black uppercase">{vehicle.year} {vehicle.name}</p>
                  <p className="text-sm text-muted-foreground">PWR {vehiclePerformance.powerRating}/100 - HND {vehiclePerformance.handlingRating}/100 - REL {vehiclePerformance.reliabilityRating}/100</p>
                </div>
                <img src={playerSprite} alt={vehicle.name} className="mx-auto h-24 w-full object-contain drop-shadow-[0_16px_24px_rgba(0,0,0,0.45)]" draggable={false} />
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    ["Tier", vehiclePerformance.tier],
                    ["Condition", `${vehicle.condition}%`],
                    ["Top Speed", `${projected.topSpeedMph} mph`],
                    ["1/4 Mile", `${projected.quarterMile.toFixed(1)}s`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md border border-border bg-muted/20 p-2">
                      <p className="font-black uppercase text-muted-foreground">{label}</p>
                      <p className="font-mono font-black">{value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {opponents.map((item) => {
                const itemEntry = Math.max(100, Math.round(item.rewardCredits / 2));
                const itemPot = itemEntry * 2;
                const sprite = vehicleTopDownSprite(item.vehicleName, item.power, item.traction);
                const raceHref = `/drag-race?vehicle=${encodeURIComponent(vehicle.canonicalVehicleKey)}&opponent=${encodeURIComponent(item.key)}`;
                return (
                  <Card key={item.key} className="flex flex-col border-2 border-transparent transition-colors hover:border-primary/60">
                    <CardHeader className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-widest text-primary">{item.tier}</p>
                          <CardTitle className="uppercase">{item.name}</CardTitle>
                        </div>
                        <span className="rounded border border-border bg-muted/30 px-2 py-1 text-[11px] font-black uppercase text-muted-foreground">{item.presenter}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{item.episode}</p>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col gap-3">
                      <div className="rounded-md border border-border bg-zinc-950/70 p-2">
                        <img src={sprite} alt={item.vehicleName} className="mx-auto h-24 w-full rotate-90 object-contain drop-shadow-[0_16px_20px_rgba(0,0,0,0.5)]" draggable={false} />
                      </div>
                      <div>
                        <p className="font-black uppercase">{item.vehicleName}</p>
                        <p className="text-xs text-muted-foreground">Power {rating100(item.power)}/100 - Handling {rating100(item.traction)}/100 - Consistency {rating100(item.consistency)}/100</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-md border border-border bg-muted/20 p-2">
                          <p className="font-black uppercase text-muted-foreground">Entry</p>
                          <p className="font-mono font-black">GBP {itemEntry.toLocaleString()}</p>
                        </div>
                        <div className="rounded-md border border-border bg-muted/20 p-2">
                          <p className="font-black uppercase text-muted-foreground">Pot</p>
                          <p className="font-mono font-black">GBP {itemPot.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                        <div className="mb-1 flex items-center gap-2 text-xs font-black uppercase text-amber-200">
                          <MessageSquare className="h-4 w-4" /> {item.presenter}
                        </div>
                        <p className="text-muted-foreground">{item.intro}</p>
                      </div>
                      <Button
                        className="mt-auto w-full uppercase font-black"
                        onClick={() => {
                          setForceChallengeBoard(false);
                          setSelectedTransmission(null);
                          setOpponentKey(item.key);
                          resetRace();
                          setLocation(raceHref);
                        }}
                      >
                        Accept Challenge
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex-1 overflow-y-auto bg-background p-1 md:p-2", phase === "result" ? "md:overflow-y-auto" : "md:overflow-hidden")}>
      {showTransmissionPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-md border border-primary/50 bg-background p-4 shadow-2xl md:p-5">
            <p className="text-xs font-black uppercase tracking-widest text-primary">Race Setup</p>
            <h2 className="mt-1 text-2xl font-black uppercase">Choose Transmission</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Manual pays an extra GBP {manualBonusPreview.toLocaleString()} and adds {MANUAL_XP_BONUS} XP, but you have to shift it yourself.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Button
                variant="outline"
                className="h-auto justify-start p-4 text-left uppercase"
                onClick={() => setSelectedTransmission("automatic")}
                data-testid="button-choose-automatic"
              >
                <span>
                  <span className="block text-lg font-black">Automatic</span>
                  <span className="block text-xs text-muted-foreground">Auto shifts - winner takes GBP {potCredits.toLocaleString()}</span>
                </span>
              </Button>
              <Button
                className="h-auto justify-start p-4 text-left uppercase"
                onClick={() => setSelectedTransmission("manual")}
                data-testid="button-choose-manual"
              >
                  <span>
                    <span className="block text-lg font-black">Manual</span>
                  <span className="block text-xs">Winner takes GBP {manualPotPreview.toLocaleString()} - +{MANUAL_XP_BONUS} XP</span>
                  </span>
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className={cn(
        "mx-auto flex min-h-[100dvh] max-w-7xl flex-col gap-1.5 overflow-visible md:min-h-0 md:gap-2",
        phase === "result" ? "md:min-h-[calc(100dvh-1rem)] md:overflow-visible" : "md:h-[calc(100dvh-1rem)] md:overflow-hidden",
      )}>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 border-b pb-1 pl-36 md:justify-between md:gap-2 md:pl-0">
          <div>
            <p className="hidden text-xs font-black uppercase tracking-widest text-primary md:block">Race Night</p>
            <h1 className="sr-only text-xl font-black uppercase tracking-tight md:not-sr-only md:text-2xl">Drag Strip</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/garage">
              <Button variant="outline" className="h-8 px-2 text-xs uppercase font-bold md:h-10 md:px-3 md:text-sm">
                <ArrowLeft className="mr-1 h-4 w-4 md:mr-2" /> Garage
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="hidden h-10 px-3 text-sm uppercase font-bold md:inline-flex">Main Menu</Button>
            </Link>
          </div>
        </div>

        <div className="grid flex-none gap-2 md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,1fr)_290px] md:gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className={cn(
            "flex flex-col overflow-visible border-2 border-primary/30 md:min-h-0",
            phase === "result" ? "md:overflow-visible" : "md:overflow-hidden",
          )}>
            <CardHeader className="bg-black/40 p-1.5 md:p-2">
              <CardTitle className="flex flex-wrap items-center justify-between gap-2 uppercase">
                <span className="flex items-center gap-1.5 text-lg md:gap-2 md:text-2xl"><Flag className="h-4 w-4 text-primary md:h-5 md:w-5" /> Quarter Mile</span>
                <span className="flex gap-1 rounded border border-zinc-700 bg-zinc-950/80 p-1.5">
                  {[0, 1, 2].map((light) => (
                    <span
                      key={light}
                      className={cn(
                        "h-4 w-4 rounded-full border border-zinc-600 md:h-5 md:w-5",
                        phase === "countdown" && countdownStep > light ? "bg-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.8)]" : "bg-zinc-800",
                      )}
                    />
                  ))}
                  <span
                    className={cn(
                      "h-4 w-4 rounded-full border border-zinc-600 md:h-5 md:w-5",
                      (phase === "launching" || phase === "racing" || phase === "result") ? "bg-green-400 shadow-[0_0_18px_rgba(74,222,128,0.8)]" : "bg-zinc-800",
                    )}
                  />
                </span>
                <span className="font-mono text-sm text-primary">{Math.round(runtime.playerMeters)}m / {DRAG_DIFFICULTY.raceDistanceMeters}m</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid flex-none grid-rows-[auto_auto] gap-1.5 p-1.5 md:min-h-0 md:flex-1 md:grid-rows-[auto_auto] md:content-start md:gap-2 md:p-2">
              <div className="relative h-[150px] overflow-hidden rounded-md border border-zinc-700 bg-[#050609] min-[420px]:h-[164px] md:h-[210px] lg:h-[230px] xl:h-[250px]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_50%,rgba(251,191,36,0.08),transparent_28%),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:auto,82px_100%]" />
                <div className="absolute left-0 right-0 top-[17%] h-[30%] border-y border-white/10 bg-zinc-900/55" />
                <div className="absolute left-0 right-0 top-[54%] h-[30%] border-y border-white/10 bg-zinc-900/55" />
                <div className="absolute top-[32%] border-t border-dashed border-amber-300/65" style={{ left: `${TRACK_START_PCT}%`, right: `${100 - TRACK_FINISH_PCT}%` }} />
                <div className="absolute top-[69%] border-t border-dashed border-amber-300/65" style={{ left: `${TRACK_START_PCT}%`, right: `${100 - TRACK_FINISH_PCT}%` }} />
                <div className="absolute top-[17%] h-[67%] w-[3px] bg-white/90 shadow-[0_0_14px_rgba(255,255,255,0.22)]" style={{ left: `${TRACK_START_PCT}%` }} />
                <div className="absolute top-[17%] h-[67%] w-2 bg-[repeating-linear-gradient(0deg,#fff_0_9px,#111827_9px_18px)] shadow-[0_0_14px_rgba(255,255,255,0.2)]" style={{ left: `${TRACK_FINISH_PCT}%` }} />

                {["Wheelspin", "Bogged launch", "Missed shift"].includes(feedback) && (
                  <div className="absolute left-[12%] top-[28%] h-16 w-28 rounded-full bg-white/20 blur-xl" />
                )}
                {["Perfect launch", "Perfect shift"].includes(feedback) && (
                  <div className="absolute left-[12%] top-[28%] rounded-full border border-green-300/70 px-3 py-1 text-xs font-black uppercase text-green-100">
                    {feedback}
                  </div>
                )}

                <div
                  className="absolute top-[32%] w-11 -translate-x-full -translate-y-1/2 transition-transform duration-75 will-change-transform sm:w-14 md:w-16"
                  style={{ left: `${TRACK_START_PCT - TRACK_STAGING_GAP_PCT + playerProgress * (TRACK_RACE_WIDTH_PCT + TRACK_STAGING_GAP_PCT)}%` }}
                >
                  <img src={playerSprite} alt={vehicle.name} className="h-14 w-11 rotate-90 object-contain drop-shadow-[0_10px_12px_rgba(0,0,0,0.55)] sm:h-16 sm:w-14 md:h-24 md:w-16" draggable={false} />
                </div>

                <div
                  className="absolute top-[69%] w-11 -translate-x-full -translate-y-1/2 transition-transform duration-75 will-change-transform sm:w-14 md:w-16"
                  style={{ left: `${TRACK_START_PCT - TRACK_STAGING_GAP_PCT + opponentProgress * (TRACK_RACE_WIDTH_PCT + TRACK_STAGING_GAP_PCT)}%` }}
                >
                  <img src={opponentSprite} alt={opponent.name} className="h-14 w-11 rotate-90 object-contain drop-shadow-[0_10px_12px_rgba(0,0,0,0.55)] sm:h-16 sm:w-14 md:h-24 md:w-16" draggable={false} />
                </div>
              </div>

              <div className="grid items-center gap-1.5 rounded-md border border-zinc-700 bg-[linear-gradient(180deg,#20242c_0%,#11141a_48%,#07080b_100%)] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_34px_rgba(0,0,0,0.35)] md:gap-2 md:rounded-lg md:p-2 md:grid-cols-[1fr_0.85fr_1fr]">
                <div className="hidden md:block">
                  <AnalogGauge label="Speedometer" value={speedMph} max={220} unit="mph" marks={[0, 40, 80, 120, 160, 200]} />
                </div>

                <div className="flex min-h-0 flex-col justify-between gap-1.5 rounded-md border border-zinc-700 bg-black/45 p-1.5 text-center shadow-[inset_0_0_18px_rgba(0,0,0,0.55)] md:min-h-[clamp(104px,17dvh,185px)] md:rounded-lg md:p-2">
                  <div className="grid grid-cols-3 gap-1">
                    <span className="flex items-center justify-center gap-1 rounded bg-zinc-950/80 px-1 py-1 text-[9px] font-black uppercase text-zinc-500 md:px-2 md:text-[10px]">
                      <span className={cn("h-1.5 w-1.5 rounded-full", throttleHeld ? "bg-green-300 shadow-[0_0_8px_rgba(134,239,172,0.85)]" : "bg-zinc-700")} />
                      Throttle
                    </span>
                    <span className="flex items-center justify-center gap-1 rounded bg-zinc-950/80 px-1 py-1 text-[9px] font-black uppercase text-zinc-500 md:px-2 md:text-[10px]">
                      <span className={cn("h-1.5 w-1.5 rounded-full", nitrousHeld ? "bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.85)]" : "bg-zinc-700")} />
                      Nitrous
                    </span>
                    <span className="flex items-center justify-center gap-1 rounded bg-zinc-950/80 px-1 py-1 text-[9px] font-black uppercase text-zinc-500 md:px-2 md:text-[10px]">
                      <span className={cn("h-1.5 w-1.5 rounded-full", runtime.rpm >= DRAG_DIFFICULTY.dangerRpm ? "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.85)]" : "bg-zinc-700")} />
                      Redline
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-[10px] font-black uppercase md:hidden">
                    {[
                      ["MPH", speedMph.toLocaleString()],
                      ["RPM", runtime.rpm.toLocaleString()],
                      ["Gear", runtime.gear.toString()],
                      ["RT", reactionMs == null ? "--" : `${reactionMs}ms`],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded border border-zinc-700 bg-zinc-950/80 p-1">
                        <p className="text-zinc-500">{label}</p>
                        <p className="font-mono text-zinc-100">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div>
                    {phase === "staging" ? (
                      <div className="space-y-1.5">
                        <Button size="lg" className="h-11 w-full text-sm font-black uppercase md:h-14 md:text-base" onClick={startRace} data-testid="button-start-drag-race">
                          <Zap className="mr-2 h-6 w-6" /> {entryPaid ? "Restage" : "Enter Race"}
                        </Button>
                        <p className="rounded border border-zinc-700 bg-zinc-950/80 p-2 text-[11px] font-black uppercase text-zinc-400">
                          {entryPaid
                            ? `Pot paid - ${transmission} - strikes ${redLightStrikes}/${RED_LIGHT_LIMIT}`
                            : `Entry GBP ${entryFee.toLocaleString()} - winner takes GBP ${racePotCredits.toLocaleString()}${selectedTransmission === "manual" ? ` (+${MANUAL_XP_BONUS} XP)` : ""}`}
                        </p>
                      </div>
                    ) : phase === "result" && result ? (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Finish Line</p>
                        <p className={cn("text-3xl font-black uppercase leading-none", result.won ? "text-green-300" : "text-red-300")}>
                          {result.breakdown.fault === "false-start" ? "Red Light" : result.won ? "You Won" : "You Lost"}
                        </p>
                        <div className="grid grid-cols-3 gap-1 text-[10px] font-black uppercase">
                          <div className="rounded border border-zinc-700 bg-zinc-950/80 p-2">
                            <p className="text-zinc-500">ET</p>
                            <p className="font-mono text-sm text-white">{formatTime(result.elapsedMs)}</p>
                          </div>
                          <div className="rounded border border-zinc-700 bg-zinc-950/80 p-2">
                            <p className="text-zinc-500">Trap</p>
                            <p className="font-mono text-sm text-white">{result.trapSpeed}</p>
                          </div>
                          <div className="rounded border border-zinc-700 bg-zinc-950/80 p-2">
                            <p className="text-zinc-500">Pot</p>
                            <p className="font-mono text-sm text-white">+{result.rewardCredits}</p>
                          </div>
                        </div>
                        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-left text-[11px] font-bold text-zinc-300">
                          <p className="mb-1 font-black uppercase text-amber-200">{opponent.presenter}</p>
                          <p>{presenterResultLine}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          <Button variant="outline" className="h-10 uppercase font-black" onClick={resetRace}>
                            <RotateCcw className="mr-2 h-4 w-4" /> Again
                          </Button>
                          <Button variant="outline" className="h-10 w-full uppercase font-black" onClick={goToChallengeBoard} data-testid="button-result-board">
                            Board
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Gear</p>
                        <p className="font-mono text-5xl font-black leading-none text-white drop-shadow-[0_0_12px_rgba(251,191,36,0.25)]">{runtime.gear}</p>
                        <p className="mt-1 text-xs font-black uppercase text-amber-300">
                          {phase === "launching" ? "Green - hit throttle" : transmission === "automatic" ? "Automatic shift" : nextShiftGear ? (canShift ? `Shift to ${nextShiftGear}` : "Hold gear") : "Top gear"}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="rounded-md border border-zinc-700 bg-zinc-950/80 p-1.5">
                    <div className="mb-1 flex justify-between text-[10px] font-black uppercase text-cyan-200">
                      <span>N2O</span>
                      <span>{hasNitrous ? `${nitrousShots} shot${nitrousShots === 1 ? "" : "s"}` : "No Kit"}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-zinc-800">
                      <div className={cn("h-full rounded-full", hasNitrous ? "bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.8)]" : "bg-zinc-700")} style={{ width: `${hasNitrous ? Math.min(100, nitrousShots * 12.5) : 0}%` }} />
                    </div>
                  </div>
                  <p className="min-h-6 text-[11px] font-black uppercase text-zinc-300">{feedback}</p>
                </div>

                <div className="hidden md:block">
                  <AnalogGauge
                    label="Tachometer"
                    value={runtime.rpm / 1000}
                    max={9}
                    unit="x1000"
                    marks={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]}
                    redFrom={DRAG_DIFFICULTY.dangerRpm / 1000}
                    targetValue={targetRpm / 1000}
                    targetLabel={phase === "countdown" || phase === "launching" ? "LAUNCH" : "SHIFT"}
                  />
                </div>

                {phase !== "staging" && phase !== "result" && (
                  <div className="grid touch-none select-none gap-1.5 md:col-span-3 md:grid-cols-[1.1fr_0.85fr_0.85fr_0.9fr]" style={{ touchAction: "none" }}>
                    <button
                      type="button"
                      className={cn(
                        "h-16 w-full rounded-md border text-sm font-black uppercase transition-colors md:h-12",
                        throttleHeld
                          ? "border-primary bg-primary text-primary-foreground shadow-[0_0_18px_rgba(251,191,36,0.35)]"
                          : "border-zinc-600 bg-zinc-950/80 text-zinc-200 active:border-primary active:text-primary",
                      )}
                      onPointerDown={pressThrottle}
                      onPointerUp={releaseThrottle}
                      onPointerCancel={cancelThrottle}
                      onLostPointerCapture={cancelThrottle}
                      onContextMenu={(event) => event.preventDefault()}
                      data-testid="button-throttle-drag-race"
                    >
                      {throttleHeld ? "Pedal Down" : "Throttle"}
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "h-16 w-full rounded-md border border-zinc-600 bg-zinc-950/80 text-sm font-black uppercase text-zinc-200 transition-colors active:border-primary active:text-primary md:h-12",
                        transmission === "automatic" && "opacity-55",
                      )}
                      onPointerDown={tapShift}
                      onContextMenu={(event) => event.preventDefault()}
                      aria-disabled={transmission === "automatic"}
                      data-testid="button-shift-drag-race"
                    >
                      {transmission === "automatic" ? "Auto Shift" : nextShiftGear ? "Shift" : "Top Gear"}
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "h-16 w-full rounded-md border text-sm font-black uppercase transition-colors md:h-12",
                        nitrousHeld
                          ? "border-cyan-300 bg-cyan-300 text-black shadow-[0_0_18px_rgba(103,232,249,0.35)]"
                          : "border-zinc-600 bg-zinc-950/80 text-zinc-200 active:border-cyan-300 active:text-cyan-200",
                        (!hasNitrous || phase !== "racing" || runtime.nitrousShots <= 0 || runtime.nitrousBoostMs > 0) && "opacity-55",
                      )}
                      onPointerDown={tapNitrous}
                      onContextMenu={(event) => event.preventDefault()}
                      aria-disabled={!hasNitrous || phase !== "racing" || runtime.nitrousShots <= 0 || runtime.nitrousBoostMs > 0}
                      data-testid="button-nitrous-drag-race"
                    >
                      {hasNitrous ? "Nitrous" : "No Nitrous"}
                    </button>
                    <div className="rounded-md border border-zinc-700 bg-black/50 p-2">
                      <p className="text-[10px] font-black uppercase text-zinc-500">RT / Target</p>
                      <p className="font-mono text-lg font-black">{reactionMs == null ? "--" : `${reactionMs}ms`}</p>
                      <p className={cn("text-xs font-black uppercase", gradeClass(currentGrade))}>{timingLabel(currentGrade)} {targetRpm.toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
            <Card>
              <CardHeader className="p-3">
                <CardTitle className="flex items-center gap-2 uppercase">
                  <Gauge className="h-5 w-5 text-primary" /> Staged Cars
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                <div className="rounded-md border border-border bg-muted/20 p-3">
                  <p className="text-xs font-black uppercase text-muted-foreground">You</p>
                  <p className="font-black uppercase">{vehicle.year} {vehicle.name}</p>
                  <p className="text-xs text-muted-foreground">PWR {vehiclePerformance.powerRating}/100 - HND {vehiclePerformance.handlingRating}/100 - REL {vehiclePerformance.reliabilityRating}/100</p>
                </div>
                <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3">
                  <p className="text-xs font-black uppercase text-red-300">Opponent - {opponent.presenter}</p>
                  <p className="font-black uppercase">{opponent.name}</p>
                  <p className="text-xs text-muted-foreground">{opponent.vehicleName} - {opponent.episode}</p>
                  <p className="text-xs text-muted-foreground">Power {rating100(opponent.power)}/100 - Handling {rating100(opponent.traction)}/100 - {rewardLabel}</p>
                </div>
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
                  <div className="mb-1 flex items-center gap-2 text-xs font-black uppercase text-amber-200">
                    <MessageSquare className="h-4 w-4" /> {opponent.presenter}
                  </div>
                  <p className="text-sm font-bold text-muted-foreground">{presenterResultLine}</p>
                  <Button variant="outline" size="sm" className="mt-3 w-full uppercase font-bold" onClick={goToChallengeBoard} data-testid="button-sidebar-board">
                    Challenge Board
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3">
                <CardTitle className="flex items-center gap-2 uppercase">
                  <Settings2 className="h-5 w-5 text-primary" /> Tuning
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-3 pt-0">
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  {[
                    ["Grip", `${tuningGrip >= 0 ? "+" : ""}${tuningGrip}%`],
                    ["Aero", `${aeroDrag}%`],
                    ["Diff", gearingBias],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md border border-border bg-muted/20 p-2">
                      <p className="font-black uppercase text-muted-foreground">{label}</p>
                      <p className="font-mono font-black">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-black uppercase text-muted-foreground">Factory / Presets</p>
                      <p className="text-xs text-muted-foreground">Final drive {finalDrive.ratio.toFixed(2)}:1</p>
                    </div>
                    <Button size="sm" variant="outline" className="uppercase font-black" disabled={phase !== "staging"} onClick={resetTuningToFactory}>
                      <RotateCcw className="mr-2 h-3.5 w-3.5" /> Factory
                    </Button>
                  </div>
                  <div className="mt-2 grid gap-2">
                    {tuningSlotIds().map((slot) => {
                      const preset = vehicleFileSummary.file.tuningPresets[slot];
                      return (
                        <div key={slot} className="grid grid-cols-[1fr_auto_auto] items-center gap-1 text-[11px]">
                          <span className="min-w-0 truncate font-black uppercase text-muted-foreground">
                            {preset ? `${preset.name} - ${finalDriveForGearing(preset.tuning.gearing).label}` : `${slot.replace("-", " ")} - Empty`}
                          </span>
                          <Button size="sm" variant="outline" className="h-8 px-2 text-[10px] uppercase" disabled={phase !== "staging"} onClick={() => saveCurrentTuningSlot(slot)}>
                            Save
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 px-2 text-[10px] uppercase" disabled={phase !== "staging" || !preset} onClick={() => loadTuningSlot(slot)}>
                            Load
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {[
                    ["Top Speed", `${projected.topSpeedMph} mph`, projected.topSpeedMph - baselineProjection.topSpeedMph, "mph"],
                    ["Race Skill", `${Math.round(displayLimiterRate * 100)}%`, (displayLimiterRate - BASE_SPEED_LIMIT_RATE) * 100, "%"],
                    ["Horsepower", `${projected.horsepower.toLocaleString()} hp`, projected.horsepower - baselineProjection.horsepower, "hp"],
                    ["Wheel HP", `${projected.wheelHorsepower.toLocaleString()} whp`, projected.wheelHorsepower - baselineProjection.wheelHorsepower, "whp"],
                    ["Torque", `${projected.torqueLbFt.toLocaleString()} lb-ft`, projected.torqueLbFt - baselineProjection.torqueLbFt, "lb-ft"],
                    ["0-60", `${projected.zeroToSixty.toFixed(1)}s`, baselineProjection.zeroToSixty - projected.zeroToSixty, "s quicker"],
                    ["1/4 Mile", `${projected.quarterMile.toFixed(1)}s`, baselineProjection.quarterMile - projected.quarterMile, "s quicker"],
                    ["Launch Grip", `${projected.launchGrip}%`, projected.launchGrip - baselineProjection.launchGrip, "%"],
                  ].map(([label, value, delta, unit]) => {
                    const numericDelta = Number(delta);
                    const neutral = Math.abs(numericDelta) < 0.05;
                    const displayDelta = neutral
                      ? "No change"
                      : `${numericDelta > 0 ? "+" : ""}${Math.abs(numericDelta) < 1 ? numericDelta.toFixed(1) : Math.round(numericDelta).toLocaleString()} ${unit}`;
                    return (
                      <div key={label as string} className="rounded-md border border-border bg-muted/20 p-2">
                        <p className="font-black uppercase text-muted-foreground">{label}</p>
                        <p className="font-mono text-sm font-black">{value}</p>
                        <p className={cn("text-[10px] font-black uppercase", neutral ? "text-muted-foreground" : numericDelta > 0 ? "text-green-300" : "text-red-300")}>{displayDelta}</p>
                      </div>
                    );
                  })}
                </div>
                {[
                  ["launchRpm", "Launch RPM", 2500, 7200],
                  ["shiftRpm", "Shift RPM", 3500, 8500],
                  ["gearing", "Gearing", 0, 100],
                  ["suspension", "Suspension", 0, 100],
                  ["downforce", "Downforce", 0, 100],
                  ["tirePressure", "Tire PSI", 18, 48],
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

          </div>
        </div>
      </div>
    </div>
  );
}
