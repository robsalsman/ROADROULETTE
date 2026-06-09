import { useLocation, useParams } from "wouter";
import {
  useGetSave, getGetSaveQueryKey,
  useRecordSaveEvent, useUpdateSave,
  useGetCharacter, getGetCharacterQueryKey,
  useGetMission, getGetMissionQueryKey,
  useListMissions, getListMissionsQueryKey,
} from "@workspace/api-client-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { pickNextEvent, type RoadEventTemplate, type EventChoice } from "@/data/roadEvents";
import { pickTrivia, type TriviaQuestion } from "@/data/trivia";
import DrivingGame from "@/components/DrivingGame";
import GroupChat from "@/components/GroupChat";
import { vehicleArchetype, vehicleSprite } from "@/data/vehicles";
import { adjustedCarStats, loadGarage, loadUpgrades as loadCarUpgrades, type GarageCar } from "@/data/garage";
import { Wrench, AlertTriangle, MapPin, Flag, Car, Footprints, Brain, HeartHandshake, Trophy } from "lucide-react";

// ── Upgrade helpers ───────────────────────────────────────────────────────────
const UPGRADE_KEY = (id: string | number) => `tgrr-upgrades-${id}`;

interface Upgrades {
  engine?: 1 | 2 | 3;
  suspension?: 1 | 2 | 3;
  fuel?: 1 | 2 | 3;
  bodywork?: 1 | 2 | 3;
  tyres?: 1 | 2 | 3;
  sponsor?: 1 | 2 | 3;
  charm?: 1 | 2 | 3;
}

function loadUpgrades(saveId: string | number): Upgrades {
  try {
    const raw = localStorage.getItem(UPGRADE_KEY(saveId));
    if (raw) return JSON.parse(raw).upgrades ?? {};
  } catch { /* ignore */ }
  return {};
}

function upgradeStats(u: Upgrades) {
  return {
    damageResist:       (u.bodywork ?? 0) * 0.2,
    fuelEfficiency:     1 - (u.fuel ?? 0) * 0.15,
    laneSpeedBonus:     (u.suspension ?? 0) * 2,
    collectRadiusBonus: (u.tyres ?? 0) * 8,
    scoreMultiplier:    [0, 0.15, 0.3, 0.5][u.sponsor ?? 0],
    scoreBonus:         [0, 75, 175, 350][u.charm ?? 0],
  };
}

const TRIP_KM = 500;

// ── Types ─────────────────────────────────────────────────────────────────────
type GameMode = "loading" | "hub" | "driving" | "gameover";

interface MechanicOffer {
  label: string;
  desc: string;
  cost: number;
  action: "repair" | "fuel" | "food" | "parts";
  amount: number;
}

const MECHANIC_OFFERS: MechanicOffer[] = [
  { label: "Full Service",  desc: "Restore condition by 40%",   cost: 150, action: "repair", amount: 40 },
  { label: "Patch & Pray",  desc: "Quick repair, +20% condition", cost: 60, action: "repair", amount: 20 },
  { label: "Jerry Cans",   desc: "Refill fuel to 100%",          cost: 80, action: "fuel",   amount: 100 },
  { label: "Packed Lunch", desc: "5 food rations for the crew",  cost: 40, action: "food",   amount: 5 },
  { label: "Spare Parts",  desc: "3 spare parts for the road",   cost: 55, action: "parts",  amount: 3 },
];

const RISK_COLORS: Record<string, string> = {
  safe:  "border-blue-500/50 hover:border-blue-400 hover:bg-blue-500/10",
  risky: "border-amber-500/50 hover:border-amber-400 hover:bg-amber-500/10",
  mad:   "border-red-500/50 hover:border-red-400 hover:bg-red-500/10",
};
const RISK_BADGE: Record<string, string> = {
  safe:  "bg-blue-500/20 text-blue-300",
  risky: "bg-amber-500/20 text-amber-300",
  mad:   "bg-red-500/20 text-red-300",
};

// ── Challenge result (shown briefly in hub after driving) ─────────────────────
interface DriveResult { earnings: number; condDelta: number; distKm: number; }

// ── Component ─────────────────────────────────────────────────────────────────
export default function Game() {
  const { saveId } = useParams();
  const [, setLocation] = useLocation();

  const [mode, setMode] = useState<GameMode>("loading");
  const [tab, setTab] = useState<"chat" | "journey">("chat");
  const [pendingEvent, setPendingEvent] = useState<RoadEventTemplate | null>(null);
  const [resolving, setResolving] = useState(false);
  // Single shared lock so the three advance paths + road-event resolution can
  // never run concurrently with stale-closure values.
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [showMechanic, setShowMechanic] = useState(false);
  const [driveResult, setDriveResult] = useState<DriveResult | null>(null);
  const [upgrades, setUpgrades] = useState<Upgrades>({});
  const [shownEventIds, setShownEventIds] = useState<Set<string>>(new Set());
  const [chatReact, setChatReact] = useState<{ id: string; context: string; tone?: string } | null>(null);

  // Resources
  const [condition, setCondition] = useState(70);
  const [fuel, setFuel] = useState(100);
  const [food, setFood] = useState(3);
  const [parts, setParts] = useState(2);
  const [funds, setFunds] = useState(0);
  const [distKm, setDistKm] = useState(0);
  const [camaraderie, setCamaraderie] = useState(0);

  // Optional advance: trivia ("Pub Quiz") state
  const [trivia, setTrivia] = useState<TriviaQuestion | null>(null);
  const [triviaResult, setTriviaResult] = useState<"correct" | "wrong" | null>(null);
  const usedTriviaRef = useRef<Set<string>>(new Set());
  // Cumulative distance from prior series stages (0 in arcade / first stage).
  const priorDistRef = useRef(0);

  // Wide = side-by-side (any landscape, or desktop ≥1024px). Narrow = stacked tabs.
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape), (min-width: 1024px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const initialized = useRef(false);
  const recordEvent = useRecordSaveEvent();
  const updateSave = useUpdateSave();

  const { data: save, isLoading: saveLoading } = useGetSave(Number(saveId), {
    query: { enabled: !!saveId, queryKey: getGetSaveQueryKey(Number(saveId)) },
  });
  const { data: character } = useGetCharacter(Number(save?.characterId), {
    query: { enabled: !!save?.characterId, queryKey: getGetCharacterQueryKey(Number(save?.characterId)) },
  });
  const { data: mission } = useGetMission(Number(save?.missionId), {
    query: { enabled: !!save?.missionId, queryKey: getGetMissionQueryKey(Number(save?.missionId)) },
  });

  const isSeries = save?.mode === "series";
  const displayName = isSeries ? (save?.playerName || "You") : (character?.name ?? "");
  const playerInitial = (displayName || "?").charAt(0).toUpperCase();

  // Series needs the full stage list (ordered) to know what comes next.
  const { data: missionsList } = useListMissions({
    query: { queryKey: getListMissionsQueryKey(), enabled: !!isSeries },
  });
  const stagesList = [...(missionsList ?? [])].sort((a, b) => a.id - b.id);

  const findActiveGarageCar = useCallback((): GarageCar | undefined => {
    if (!saveId || !save?.carId) return undefined;
    return loadGarage(saveId).cars.find((garageCar) => garageCar.id === save.carId);
  }, [saveId, save?.carId]);

  // Initialise from save data
  useEffect(() => {
    if (!save || !mission || initialized.current) return;
    if (!isSeries && !character) return; // arcade waits for its presenter
    initialized.current = true;
    const baseCar = findActiveGarageCar() ?? mission.availableCars?.find((c: { id: number; reliability?: number }) => c.id === save.carId);
    const loadedUpgrades = saveId && save.carId ? loadCarUpgrades(saveId, save.carId) : {};
    const carStats = baseCar ? adjustedCarStats(baseCar, loadedUpgrades) : null;
    setCondition(carStats ? (carStats.reliability ?? 6) * 10 : 60);
    setFunds(save.funds ?? 0);
    setFood(save.food ?? 3);
    setParts(save.parts ?? 2);
    setCamaraderie(save.camaraderie ?? 0);
    if (isSeries) {
      // Baseline is derived from the stage index so a mid-stage reload restores
      // the correct in-stage distance instead of resetting it to 0 (which would
      // otherwise re-bake partial progress into the cumulative total).
      const baseline = (save.seriesStageIndex ?? 0) * TRIP_KM;
      priorDistRef.current = baseline;
      setDistKm(Math.max(0, Math.min(TRIP_KM, (save.distanceTravelled ?? 0) - baseline)));
    } else {
      priorDistRef.current = 0;
      setDistKm(save.distanceTravelled ?? 0);
    }
    setUpgrades(loadedUpgrades);

    // Kick off with a first road event to set the scene
    const firstEvt = pickNextEvent(new Set());
    if (firstEvt) {
      setShownEventIds(new Set([firstEvt.id]));
      setPendingEvent(firstEvt);
    }

    setMode("hub");
  }, [save, mission, character, isSeries, saveId, findActiveGarageCar]);

  const stats = upgradeStats(upgrades);
  const car = findActiveGarageCar() ?? mission?.availableCars?.find((c: { id: number }) => c.id === save?.carId);

  const whoIsDriving = isSeries
    ? `${displayName}, the fourth member of the team touring with Jeremy, Richard and James,`
    : `${character?.name ?? "The driver"}`;
  const gameContext = mission
    ? `${whoIsDriving} is on a road trip across ${mission.location} — ${mission.title}. Distance covered: ${Math.round(distKm)} km of ${TRIP_KM} km. Car condition: ${Math.round(condition)}%. Fuel: ${Math.round(fuel)}%. Funds: £${funds}.`
    : "";

  // ── Persist progress to server ─────────────────────────────────────────────
  const persistProgress = useCallback(async (
    newFunds: number,
    newDistKm: number,
    extra?: { food?: number; parts?: number; camaraderie?: number },
  ) => {
    if (!save) return;
    try {
      await updateSave.mutateAsync({
        id: save.id,
        data: {
          funds: newFunds,
          distanceTravelled: priorDistRef.current + Math.round(newDistKm),
          status: "on_road",
          food: extra?.food ?? food,
          parts: extra?.parts ?? parts,
          camaraderie: extra?.camaraderie ?? camaraderie,
        },
      });
    } catch { /* silent */ }
  }, [save, updateSave, food, parts, camaraderie]);

  // ── Camaraderie bump (chat + bold choices) ─────────────────────────────────
  const bumpCamaraderie = useCallback((n: number) => {
    setCamaraderie((prev) => {
      const next = Math.min(100, prev + n);
      if (save && next !== prev) {
        updateSave.mutate({ id: save.id, data: { camaraderie: next } });
      }
      return next;
    });
  }, [save, updateSave]);

  // ── Finish the current stage: advance the series or end the run ─────────────
  const finishStage = useCallback(async (newFunds: number, newDist: number, newCam: number) => {
    if (!save) return;
    const finalScore = newFunds + newCam * 5;

    if (isSeries && stagesList.length > 0) {
      const idx = stagesList.findIndex((m) => m.id === save.missionId);
      const next = idx >= 0 ? stagesList[idx + 1] : undefined;
      const cumulative = priorDistRef.current + TRIP_KM;

      if (next) {
        try {
          await updateSave.mutateAsync({
            id: save.id,
            data: {
              missionId: next.id,
              seriesStageIndex: (save.seriesStageIndex ?? 0) + 1,
              carId: null,
              status: "car_selection",
              funds: newFunds,
              food, parts,
              camaraderie: newCam,
              distanceTravelled: cumulative,
            },
          });
        } catch { /* silent */ }
        toast({ title: "🏁 Stage complete!", description: `On to ${next.title}. Grab a fresh car.` });
        setTimeout(() => setLocation(`/mission/${next.id}?saveId=${save.id}&series=1`), 1500);
        return;
      }

      // Last stage of the series
      try {
        await updateSave.mutateAsync({
          id: save.id,
          data: { status: "completed", distanceTravelled: cumulative, funds: newFunds, food, parts, camaraderie: newCam, score: finalScore },
        });
      } catch { /* silent */ }
      toast({ title: "🏆 Series complete!", description: "You survived the entire tour." });
      setTimeout(() => setLocation(`/results/${save.id}`), 1500);
      return;
    }

    // Arcade single stage
    try {
      await updateSave.mutateAsync({
        id: save.id,
        data: { status: "completed", distanceTravelled: Math.round(newDist), funds: newFunds, food, parts, camaraderie: newCam, score: finalScore },
      });
    } catch { /* silent */ }
    setTimeout(() => setLocation(`/results/${save.id}`), 1500);
  }, [save, isSeries, stagesList, updateSave, food, parts, setLocation]);

  // ── Shared advance resolver (challenge / press on / trivia) ────────────────
  const resolveAdvance = useCallback(async (opts: {
    earnings?: number;
    condDelta?: number;
    fuelCost?: number;
    kmEarned: number;
    camaraderieDelta?: number;
    result?: DriveResult | null;
    chat?: { context: string; tone?: string };
  }) => {
    if (!save || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const earnings = opts.earnings ?? 0;
    const newFunds = funds + earnings;
    const newCond = Math.max(0, Math.min(100, condition + (opts.condDelta ?? 0)));
    const newDist = Math.min(TRIP_KM, distKm + opts.kmEarned);
    const newFuel = Math.max(0, fuel - (opts.fuelCost ?? 0));
    const newCam = Math.min(100, camaraderie + (opts.camaraderieDelta ?? 0));

    setFunds(newFunds);
    setCondition(newCond);
    setDistKm(newDist);
    setFuel(newFuel);
    setCamaraderie(newCam);
    setDriveResult(opts.result ?? null);
    setMode("hub");
    if (opts.chat) setChatReact({ id: `adv-${Date.now()}`, context: opts.chat.context, tone: opts.chat.tone });

    await persistProgress(newFunds, newDist, { camaraderie: newCam });

    // Game over conditions
    if (newCond <= 0) {
      toast({ title: "💥 Car destroyed!", description: "The car has completely given up. That's it.", variant: "destructive" });
      setMode("gameover");
      await updateSave.mutateAsync({ id: save.id, data: { status: "failed", distanceTravelled: priorDistRef.current + Math.round(newDist) } });
      setTimeout(() => setLocation(`/results/${save.id}`), 2500);
      return;
    }
    if (newFuel <= 0) {
      toast({ title: "🛢 Out of fuel!", description: "You've ground to a halt in the middle of nowhere.", variant: "destructive" });
      setMode("gameover");
      await updateSave.mutateAsync({ id: save.id, data: { status: "failed", distanceTravelled: priorDistRef.current + Math.round(newDist) } });
      setTimeout(() => setLocation(`/results/${save.id}`), 2500);
      return;
    }

    // Stage / trip complete?
    if (newDist >= TRIP_KM) {
      await finishStage(newFunds, newDist, newCam);
      return;
    }

    // Surface a road event after advancing (if one is available)
    if (!pendingEvent) {
      const evt = pickNextEvent(shownEventIds);
      if (evt) {
        setShownEventIds(prev => new Set([...prev, evt.id]));
        setPendingEvent(evt);
      }
    }
    setTab("journey");
    if (opts.result) setTimeout(() => setDriveResult(null), 6000);
    busyRef.current = false;
    setBusy(false);
  }, [save, funds, condition, distKm, fuel, camaraderie, pendingEvent, shownEventIds, persistProgress, updateSave, setLocation, finishStage]);

  // ── Driving challenge complete ─────────────────────────────────────────────
  const handleDriveComplete = useCallback((earnings: number, condDelta: number, kmEarned: number) => {
    void resolveAdvance({
      earnings,
      condDelta,
      kmEarned,
      fuelCost: Math.round(8 + Math.random() * 6),
      camaraderieDelta: 2,
      result: { earnings, condDelta, distKm: kmEarned },
      chat: {
        context: `${displayName || "The driver"} just finished a driving challenge, banking £${earnings} and covering ${kmEarned}km${condDelta < 0 ? ", taking some damage on the way" : " without a scratch"}.`,
        tone: condDelta < 0 ? "mocking" : "impressed",
      },
    });
  }, [resolveAdvance, displayName]);

  // ── Press On: free advance that costs fuel + wear ──────────────────────────
  const handlePressOn = useCallback(() => {
    const km = 55 + Math.round(Math.random() * 20);
    void resolveAdvance({
      kmEarned: km,
      fuelCost: 14,
      condDelta: -8,
      chat: {
        context: `${displayName || "The driver"} just pressed on and ground out ${km}km of road without stopping for anything.`,
        tone: "weary",
      },
    });
  }, [resolveAdvance, displayName]);

  // ── Trivia (Pub Quiz): answer to advance + small reward ────────────────────
  const openTrivia = useCallback(() => {
    setTriviaResult(null);
    setTrivia(pickTrivia(usedTriviaRef.current));
  }, []);

  const answerTrivia = useCallback((idx: number) => {
    if (!trivia || triviaResult) return;
    usedTriviaRef.current.add(trivia.id);
    const correct = idx === trivia.answer;
    setTriviaResult(correct ? "correct" : "wrong");
    const km = correct ? 60 : 25;
    const earnings = correct ? 50 : 0;
    setTimeout(() => {
      setTrivia(null);
      setTriviaResult(null);
      void resolveAdvance({
        earnings,
        kmEarned: km,
        fuelCost: 5,
        camaraderieDelta: correct ? 2 : 0,
        chat: {
          context: correct
            ? `${displayName || "The driver"} just nailed a car-trivia question over the radio for a bit of cash and bragging rights.`
            : `${displayName || "The driver"} just got a car-trivia question hopelessly wrong over the radio.`,
          tone: correct ? "impressed" : "mocking",
        },
      });
    }, 1100);
  }, [trivia, triviaResult, resolveAdvance, displayName]);

  // ── Road event choice ─────────────────────────────────────────────────────
  const handleChoice = useCallback(async (choice: EventChoice) => {
    if (!save || !pendingEvent) return;
    setResolving(true);

    const newFunds = Math.max(0, funds + choice.fundsEffect);
    setFunds(newFunds);

    const newDist = Math.min(TRIP_KM, distKm + (choice.distanceEffect ?? 0));
    setDistKm(newDist);

    if (choice.damageEffect) {
      setCondition(prev => Math.max(0, Math.min(100, prev + choice.damageEffect)));
    }

    // Bold choices grow camaraderie with the lads.
    const camGain = choice.risk === "mad" ? 3 : choice.risk === "risky" ? 2 : 0;
    const newCam = Math.min(100, camaraderie + camGain);
    if (camGain > 0) setCamaraderie(newCam);

    const EVENT_TYPE_MAP: Record<string, "breakdown" | "weather" | "police" | "shortcut" | "fuel" | "mechanical" | "wildlife" | "banter"> = {
      breakdown: "breakdown", obstacle: "mechanical", navigation: "shortcut",
      hazard: "weather", encounter: "banter", good: "mechanical",
    };

    try {
      await Promise.all([
        recordEvent.mutateAsync({
          saveId: save.id,
          data: {
            eventType: EVENT_TYPE_MAP[pendingEvent.type] ?? "mechanical",
            title: pendingEvent.title,
            description: choice.outcome,
            outcome: choice.label,
            fundsChange: choice.fundsEffect,
          },
        }),
        updateSave.mutateAsync({ id: save.id, data: { funds: newFunds, distanceTravelled: priorDistRef.current + Math.round(newDist), camaraderie: newCam } }),
      ]);
    } catch { /* silent */ }

    setResolving(false);
    setPendingEvent(null);

    setChatReact({
      id: `evt-${Date.now()}`,
      context: `${displayName || "The driver"} just faced the road event "${pendingEvent.title}" and chose to "${choice.label}" — ${choice.outcome} (funds changed by £${choice.fundsEffect}).`,
      tone: choice.risk === "mad" ? "alarmed" : choice.risk === "risky" ? "skeptical" : "approving",
    });

    // Brief outcome toast
    toast({
      title: choice.label,
      description: choice.outcome.slice(0, 100) + (choice.outcome.length > 100 ? "…" : ""),
    });

    // Trip / stage complete via event distance?
    if (newDist >= TRIP_KM) {
      await finishStage(newFunds, newDist, newCam);
    }
  }, [save, pendingEvent, funds, distKm, camaraderie, recordEvent, updateSave, setLocation, displayName, finishStage]);

  // ── Mechanic purchase ──────────────────────────────────────────────────────
  const handleMechanicPurchase = async (offer: MechanicOffer) => {
    if (!save || funds < offer.cost) { toast({ title: "Not enough funds", variant: "destructive" }); return; }
    const newFunds = funds - offer.cost;
    setFunds(newFunds);
    if (offer.action === "repair") setCondition(c => Math.min(100, c + offer.amount));
    if (offer.action === "fuel") setFuel(100);
    let newFood = food;
    let newParts = parts;
    if (offer.action === "food") { newFood = Math.min(10, food + offer.amount); setFood(newFood); }
    if (offer.action === "parts") { newParts = Math.min(10, parts + offer.amount); setParts(newParts); }
    await updateSave.mutateAsync({ id: save.id, data: { funds: newFunds, food: newFood, parts: newParts } });
    toast({ title: offer.label, description: "Sorted. Back on the road." });
  };

  // ── Use part ──────────────────────────────────────────────────────────────
  const handleUsePart = () => {
    if (parts <= 0) { toast({ title: "No spare parts", variant: "destructive" }); return; }
    const newParts = parts - 1;
    setParts(newParts);
    setCondition(c => Math.min(100, c + 30));
    if (save) updateSave.mutate({ id: save.id, data: { parts: newParts } });
    toast({ title: "🔧 Roadside repair", description: "Used a spare part. Car condition +30%." });
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (saveLoading || mode === "loading" || !save || !mission || (!isSeries && !character)) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground uppercase tracking-widest text-sm">Preparing the vehicle...</p>
        </div>
      </div>
    );
  }

  const condColor = condition > 60 ? "text-green-400" : condition > 30 ? "text-amber-400" : "text-red-400";
  const fuelColor = fuel > 30 ? "text-blue-400" : fuel > 15 ? "text-amber-400" : "text-red-400";
  const progressPct = Math.round((distKm / TRIP_KM) * 100);
  const avatarSrc = !isSeries && character
    ? (character.slug === "richard" ? "/images/hammond.png" : `/images/${character.slug}.png`)
    : null;

  // ── Driving mode ──────────────────────────────────────────────────────────
  if (mode === "driving") {
    return (
      <div className="h-[100dvh] flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
        <DrivingGame
          terrain={mission.terrain}
          missionTitle={mission.title}
          damageResist={stats.damageResist}
          laneSpeedBonus={stats.laneSpeedBonus}
          collectRadiusBonus={stats.collectRadiusBonus}
          scoreMultiplier={stats.scoreMultiplier}
          scoreBonus={stats.scoreBonus}
          vehicleSprite={(() => {
            const c = car as { name?: string; power?: number; offRoad?: number } | undefined;
            return c?.name ? vehicleSprite(vehicleArchetype(c.name, c.power, c.offRoad)) : undefined;
          })()}
          onComplete={handleDriveComplete}
          onExit={() => setMode("hub")}
        />
      </div>
    );
  }

  // ── Hub mode ───────────────────────────────────────────────────────────────
  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden" style={{ minHeight: 0 }}>

      {/* ── Top bar (wraps on narrow screens) ───────────────────────────── */}
      <div className="shrink-0 border-b border-border bg-card px-3 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex items-center gap-2 min-w-0">
          {avatarSrc ? (
            <img src={avatarSrc} alt={displayName} className="w-7 h-7 rounded-full border border-primary object-cover shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-full border border-amber-500 bg-amber-500/20 text-amber-300 text-xs font-black flex items-center justify-center shrink-0">
              {playerInitial}
            </div>
          )}
          <div className="min-w-0 leading-tight">
            <p className="font-black text-[11px] uppercase truncate">
              {displayName}
              {isSeries && <span className="ml-1 text-amber-400">· Stage {(save.seriesStageIndex ?? 0) + 1}</span>}
            </p>
            <p className="text-[9px] text-muted-foreground flex items-center gap-0.5 truncate">
              <MapPin className="w-2.5 h-2.5 shrink-0" />{mission.location}
            </p>
          </div>
        </div>
        <span className="font-mono font-bold text-green-400 text-xs">£{funds.toLocaleString()}</span>
        <div className="flex items-center gap-2.5 text-[11px] font-mono ml-auto">
          <span className={fuelColor}>⛽{Math.round(fuel)}%</span>
          <span className="text-orange-400">🍖{food}</span>
          <span className="text-slate-400">🔧{parts}</span>
          <span className={condColor}>❤️{Math.round(condition)}%</span>
          <span className="text-pink-400" title="Camaraderie">🤝{camaraderie}%</span>
          <span className="text-muted-foreground">{Math.round(distKm)}/{TRIP_KM}km</span>
        </div>
      </div>

      {/* ── Tab switcher (narrow screens only) ──────────────────────────── */}
      {!wide && (
        <div className="shrink-0 flex border-b border-border bg-card">
          <button
            onClick={() => setTab("chat")}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors ${
              tab === "chat" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
            }`}
          >
            💬 Chat
          </button>
          <button
            onClick={() => setTab("journey")}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors relative ${
              tab === "journey" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
            }`}
          >
            🗺 Journey
            {(pendingEvent || driveResult) && tab !== "journey" && (
              <span className="absolute top-2 ml-1 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>
        </div>
      )}

      {/* ── Main split layout (narrow: stacked tabs · wide: side-by-side) ── */}
      <div className={`flex-1 flex overflow-hidden min-h-0 ${wide ? "flex-row" : "flex-col"}`}>

        {/* ── Group Chat ────────────────────────────────────────────────── */}
        <div className={`flex-1 min-w-0 min-h-0 flex-col overflow-hidden ${wide || tab === "chat" ? "flex" : "hidden"}`}>
          <GroupChat
            playerCharacter={isSeries ? "player" : (character?.slug ?? "player")}
            playerName={displayName}
            gameContext={gameContext}
            stats={{ condition, fuel, progressPct }}
            reactTo={chatReact}
            saveId={save.id}
            onPlayerMessage={() => bumpCamaraderie(1)}
          />
        </div>

        {/* ── Journey / Action panel ────────────────────────────────────── */}
        <div className={`${wide ? "w-[320px] lg:w-[360px] max-w-[46%] border-l border-border shrink-0 min-h-0" : "w-full flex-1 min-h-0"} flex-col overflow-hidden bg-card ${wide || tab === "journey" ? "flex" : "hidden"}`}>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {/* ── Mission progress ────────────────────────────────────── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground uppercase tracking-wider font-bold">
                <span className="flex items-center gap-1"><Flag className="w-3 h-3" />Trip Progress</span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-700"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">{mission.title}</p>
            </div>

            {/* ── Drive result (brief, after challenge) ───────────────── */}
            <AnimatePresence>
              {driveResult && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-xl border border-green-500/40 bg-green-500/10 p-3 space-y-1"
                >
                  <p className="text-xs font-bold text-green-400 uppercase tracking-wide">Challenge complete!</p>
                  <div className="grid grid-cols-3 gap-1 text-center text-xs">
                    <div>
                      <div className="font-mono font-bold text-green-400">+£{driveResult.earnings}</div>
                      <div className="text-muted-foreground text-[10px]">earned</div>
                    </div>
                    <div>
                      <div className={`font-mono font-bold ${driveResult.condDelta < 0 ? "text-red-400" : "text-green-400"}`}>
                        {driveResult.condDelta < 0 ? driveResult.condDelta : `+${driveResult.condDelta}`}%
                      </div>
                      <div className="text-muted-foreground text-[10px]">condition</div>
                    </div>
                    <div>
                      <div className="font-mono font-bold text-primary">+{driveResult.distKm}km</div>
                      <div className="text-muted-foreground text-[10px]">advanced</div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Pending road event card ──────────────────────────────── */}
            <AnimatePresence>
              {pendingEvent && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className="rounded-xl border border-amber-500/40 bg-amber-500/5 overflow-hidden"
                >
                  <div className="px-3 pt-3 pb-2 border-b border-amber-500/20">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                      ⚠ Road Event
                    </span>
                    <h3 className="font-black text-sm uppercase mt-0.5">{pendingEvent.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{pendingEvent.situation}</p>
                  </div>
                  <div className="p-2 space-y-1.5">
                    {resolving ? (
                      <div className="text-center py-2 text-xs text-muted-foreground animate-pulse">Dealing with it...</div>
                    ) : (
                      pendingEvent.choices.map((choice, i) => (
                        <button
                          key={i}
                          onClick={() => handleChoice(choice)}
                          className={`w-full text-left px-3 py-2 rounded-lg border bg-card/50 text-xs transition-all ${RISK_COLORS[choice.risk]}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div>
                              <p className="font-bold">{choice.label}</p>
                              <p className="text-muted-foreground italic text-[10px] mt-0.5">{choice.flavor}</p>
                            </div>
                            <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${RISK_BADGE[choice.risk]}`}>
                              {choice.risk}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Action buttons ───────────────────────────────────────── */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Advance the Journey — pick one</p>

              {/* Main driving challenge button (optional) */}
              <button
                onClick={() => setMode("driving")}
                className="w-full py-3 px-4 rounded-xl bg-primary text-primary-foreground font-black text-sm uppercase tracking-wide flex items-center justify-between hover:bg-primary/90 active:scale-95 transition-all shadow-lg shadow-primary/20"
              >
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4" />
                  <div className="text-left">
                    <div>Driving Challenge</div>
                    <div className="text-[10px] font-normal opacity-80">45 sec · earn up to £200+</div>
                  </div>
                </div>
                <span className="text-lg">→</span>
              </button>

              {/* Press On — free advance that costs fuel + wear */}
              <button
                onClick={handlePressOn}
                className="w-full py-2.5 px-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-sm font-bold flex items-center justify-between hover:bg-emerald-500/20 active:scale-95 transition-all"
              >
                <div className="flex items-center gap-2">
                  <Footprints className="w-4 h-4 text-emerald-400" />
                  <div className="text-left">
                    <div className="text-emerald-200">Press On</div>
                    <div className="text-[10px] font-normal text-muted-foreground">~65km · costs fuel &amp; condition</div>
                  </div>
                </div>
                <span className="text-lg text-emerald-400">→</span>
              </button>

              {/* Pub Quiz — answer trivia to advance + earn */}
              <button
                onClick={openTrivia}
                className="w-full py-2.5 px-4 rounded-xl border border-violet-500/40 bg-violet-500/10 text-sm font-bold flex items-center justify-between hover:bg-violet-500/20 active:scale-95 transition-all"
              >
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-violet-400" />
                  <div className="text-left">
                    <div className="text-violet-200">Pub Quiz</div>
                    <div className="text-[10px] font-normal text-muted-foreground">Answer to advance · right = +£50</div>
                  </div>
                </div>
                <span className="text-lg text-violet-400">→</span>
              </button>

              {/* Use part (if condition is low and we have parts) */}
              {parts > 0 && condition < 80 && (
                <button
                  onClick={handleUsePart}
                  className="w-full py-2 px-4 rounded-xl border border-slate-500/40 bg-slate-500/10 text-sm font-bold flex items-center gap-2 hover:bg-slate-500/20 transition-all"
                >
                  <Wrench className="w-4 h-4 text-slate-400" />
                  <div className="text-left">
                    <div className="text-slate-300 text-xs">Roadside Repair</div>
                    <div className="text-[10px] text-muted-foreground">Use a spare part · +30% condition</div>
                  </div>
                </button>
              )}

              {/* Mechanic */}
              <button
                onClick={() => setShowMechanic(true)}
                className="w-full py-2 px-4 rounded-xl border border-border bg-card text-xs font-bold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all flex items-center gap-2"
              >
                <span className="text-base">🔧</span>
                <div className="text-left">
                  <div>Visit Mechanic</div>
                  <div className="text-[10px] font-normal opacity-70">Budget: £{funds}</div>
                </div>
              </button>
            </div>

            {/* ── Car stats ───────────────────────────────────────────── */}
            <div className="space-y-2 pt-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Car Status</p>
              {[
                { label: "Condition", val: condition, color: condColor, barColor: condition > 60 ? "#22c55e" : condition > 30 ? "#f59e0b" : "#ef4444" },
                { label: "Fuel",      val: fuel,      color: fuelColor,  barColor: fuel > 30 ? "#3b82f6" : fuel > 15 ? "#f59e0b" : "#ef4444" },
              ].map(stat => (
                <div key={stat.label} className="space-y-0.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">{stat.label}</span>
                    <span className={`font-mono font-bold ${stat.color}`}>{Math.round(stat.val)}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${stat.val}%`, background: stat.barColor }} />
                  </div>
                </div>
              ))}
              {/* Camaraderie meter */}
              <div className="space-y-0.5 pt-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground flex items-center gap-1"><HeartHandshake className="w-3 h-3 text-pink-400" />Camaraderie</span>
                  <span className="font-mono font-bold text-pink-400">{camaraderie}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${camaraderie}%`, background: "#ec4899" }} />
                </div>
                <p className="text-[9px] text-muted-foreground">Grows when you chat with the lads &amp; make bold calls.</p>
              </div>
              <div className="flex gap-3 text-xs pt-1">
                <span className="text-orange-400">🍖 Food: <strong>{food}</strong></span>
                <span className="text-slate-400">🔧 Parts: <strong>{parts}</strong></span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Pub Quiz (trivia) modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {trivia && (
          <motion.div
            key="trivia"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
              className="w-full max-w-md bg-card border border-violet-500/40 rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="px-5 pt-5 pb-3 border-b border-border">
                <span className="text-xs font-bold uppercase tracking-widest text-violet-400 flex items-center gap-1"><Brain className="w-3.5 h-3.5" /> Pub Quiz</span>
                <h2 className="text-lg font-black uppercase mt-1 leading-snug">{trivia.question}</h2>
              </div>
              <div className="p-4 space-y-2">
                {trivia.options.map((opt, i) => {
                  const isAnswer = i === trivia.answer;
                  const showState = triviaResult !== null;
                  const cls = showState
                    ? isAnswer
                      ? "border-green-500 bg-green-500/15 text-green-200"
                      : "border-border bg-card/50 opacity-50"
                    : "border-border bg-card/50 hover:border-violet-500/60 hover:bg-violet-500/10";
                  return (
                    <button
                      key={i}
                      disabled={showState}
                      onClick={() => answerTrivia(i)}
                      data-testid={`button-trivia-${i}`}
                      className={`w-full text-left p-3 rounded-xl border text-sm font-bold transition-all disabled:cursor-default ${cls}`}
                    >
                      {opt}
                    </button>
                  );
                })}
                {triviaResult && (
                  <p className={`text-center text-sm font-bold pt-1 ${triviaResult === "correct" ? "text-green-400" : "text-red-400"}`}>
                    {triviaResult === "correct" ? "Correct! +£50 and a good chunk of road." : "Wrong! Still rolling on, just slower."}
                  </p>
                )}
                {!triviaResult && (
                  <button
                    onClick={() => setTrivia(null)}
                    className="w-full text-center py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Not now
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mechanic modal ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showMechanic && (
          <motion.div
            key="mechanic"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
              className="w-full max-w-md bg-card border border-border rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="px-5 pt-5 pb-3 border-b border-border">
                <span className="text-xs font-bold uppercase tracking-widest text-primary">🔧 Roadside Mechanic</span>
                <h2 className="text-xl font-black uppercase mt-1">Someone in overalls is waving you down</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Budget: <strong className={funds < 60 ? "text-red-400" : "text-green-400"}>£{funds}</strong>
                </p>
              </div>
              <div className="p-4 space-y-2">
                {MECHANIC_OFFERS.map((offer, i) => (
                  <button
                    key={i}
                    disabled={funds < offer.cost}
                    onClick={() => handleMechanicPurchase(offer)}
                    className="w-full text-left p-3 rounded-xl border border-border bg-card/50 hover:border-primary/50 hover:bg-primary/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm">{offer.label}</p>
                        <p className="text-xs text-muted-foreground">{offer.desc}</p>
                      </div>
                      <span className="font-mono font-bold text-primary">£{offer.cost}</span>
                    </div>
                  </button>
                ))}
                <button
                  onClick={() => setShowMechanic(false)}
                  className="w-full text-center py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Drive away without stopping
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Game over overlay ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {mode === "gameover" && (
          <motion.div
            key="gameover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          >
            <div className="text-center space-y-4">
              <AlertTriangle className="w-16 h-16 text-red-500 mx-auto" />
              <h2 className="text-3xl font-black uppercase text-red-400">That's it. It's over.</h2>
              <p className="text-muted-foreground">The journey ends here.</p>
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
