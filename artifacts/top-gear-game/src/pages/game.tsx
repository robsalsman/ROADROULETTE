import { Link, useLocation, useParams } from "wouter";
import {
  useGetSave, getGetSaveQueryKey,
  useRecordSaveEvent, useUpdateSave,
  useGetCharacter, getGetCharacterQueryKey,
  useGetMission, getGetMissionQueryKey,
  useListMissions, getListMissionsQueryKey,
} from "@workspace/api-client-react";
import { ECONOMY } from "@workspace/economy";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { pickNextEvent, type RoadEventTemplate, type EventChoice } from "@/data/roadEvents";
import { pickTrivia, type TriviaQuestion } from "@/data/trivia";
import { buildForwardPrompt, buildNavigationPrompt } from "@/data/questTurns";
import {
  addPlayerXp,
  advanceCampaignTime,
  consumeInventoryItem,
  ensureCampaignState,
  ensureStarterInventory,
  grantInventoryItem,
  inventoryItemName,
  loadInventory,
  recordCampaignTrivia,
  recordCompletedEpisode,
  recordDrivingChallenge,
  type InventoryItem,
} from "@/data/campaign";
import DrivingGame from "@/components/DrivingGame";
import JaguarSkiSlalomGame from "@/components/JaguarSkiSlalomGame";
import GroupChat from "@/components/GroupChat";
import { getVehicleSprite } from "@/components/VehicleSprite";
import { adjustedCarStats, loadGarage, loadUpgrades as loadCarUpgrades, type GarageCar, type Upgrades } from "@/data/garage";
import { canonicalVehicleKey, vehicleTopDownSprite } from "@/data/vehicles";
import { garageApi } from "@/services/garageApi";
import { Wrench, AlertTriangle, MapPin, Flag, Car, Footprints, Brain, HeartHandshake, Trophy, Backpack, Clock } from "lucide-react";

// ── Upgrade helpers ───────────────────────────────────────────────────────────
const UPGRADE_KEY = (id: string | number) => `tgrr-upgrades-${id}`;

function loadUpgrades(saveId: string | number): Upgrades {
  try {
    const raw = localStorage.getItem(UPGRADE_KEY(saveId));
    if (raw) return JSON.parse(raw).upgrades ?? {};
  } catch { /* ignore */ }
  return {};
}

function upgradeStats(u: Upgrades) {
  const tierEffect = (tier = 0) => tier / 2;
  return {
    damageResist:       tierEffect(u.bodywork) * 0.2,
    fuelEfficiency:     1 - tierEffect(u.fuel) * 0.15,
    laneSpeedBonus:     tierEffect(u.suspension) * 2,
    collectRadiusBonus: tierEffect(u.tyres) * 8,
    scoreMultiplier:    [0, 0.07, 0.15, 0.22, 0.3, 0.4, 0.5][u.sponsor ?? 0],
    scoreBonus:         [0, 350, 750, 1250, 1750, 2600, 3500][u.charm ?? 0],
  };
}

const TRIP_KM = 500;

// ── Types ─────────────────────────────────────────────────────────────────────
type GameMode = "loading" | "hub" | "driving" | "slalom" | "gameover";
type TurnPhase = "navigation" | "road-event" | "advance";

const TURN_PHASES: Array<{ id: TurnPhase; label: string; desc: string }> = [
  { id: "navigation", label: "Route", desc: "Pick the way forward" },
  { id: "road-event", label: "Event", desc: "Deal with what happens" },
  { id: "advance", label: "Payoff", desc: "Minigame, quiz, or press on" },
];

const TURN_PHASE_COPY: Record<TurnPhase, { title: string; detail: string }> = {
  navigation: {
    title: "Route planning",
    detail: "The trio are proposing different ways forward. Choose one in the group chat; the choice creates the next road event.",
  },
  "road-event": {
    title: "Road event",
    detail: "Something has happened on the route. Pick how the party handles it, then the consequence lands.",
  },
  advance: {
    title: "Next push",
    detail: "The immediate trouble is settled. Choose the payoff: playable challenge, pub quiz, or press on to start the next loop.",
  },
};

interface MechanicOffer {
  label: string;
  desc: string;
  cost: number;
  action: "repair" | "fuel" | "food" | "parts" | "item";
  amount: number;
  itemId?: string;
}

const MECHANIC_OFFERS: MechanicOffer[] = [
  { label: "Full Service",  desc: "Restore condition by 40%",   cost: 1500, action: "repair", amount: 40 },
  { label: "Patch & Pray",  desc: "Quick repair, +20% condition", cost: 600, action: "repair", amount: 20 },
  { label: "Jerry Cans",   desc: "Refill fuel to 100%",          cost: 800, action: "fuel",   amount: 100 },
  { label: "Packed Lunch", desc: "5 food rations for the crew",  cost: 400, action: "food",   amount: 5 },
  { label: "Spare Parts",  desc: "3 spare parts for the road",   cost: 550, action: "parts",  amount: 3 },
  { label: "Snow Chains", desc: "Campaign kit for icy passes", cost: 900, action: "item", amount: 1, itemId: "snow-chains" },
  { label: "Sand Ladders", desc: "Campaign kit for beaches and desert", cost: 1200, action: "item", amount: 1, itemId: "sand-ladders" },
  { label: "River Permit", desc: "Campaign kit for ferry and river trouble", cost: 750, action: "item", amount: 1, itemId: "river-permit" },
  { label: "Emergency Envelope", desc: "Campaign kit for suspicious tolls", cost: 850, action: "item", amount: 1, itemId: "bribe-envelope" },
  { label: "Tyre Compressor", desc: "Campaign kit for rough-road punctures", cost: 700, action: "item", amount: 1, itemId: "portable-compressor" },
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

interface OutcomeSummary {
  id: string;
  title: string;
  detail: string;
  tone: "good" | "bad" | "neutral";
  fundsDelta?: number;
  distanceDelta?: number;
  conditionDelta?: number;
  fuelDelta?: number;
  foodDelta?: number;
  partsDelta?: number;
  timeHours?: number;
  xpDelta?: number;
  garageCreditsDelta?: number;
}

type AdventureDrive = {
  event: RoadEventTemplate;
  choice: EventChoice;
};

function nextStepForChoice(event: RoadEventTemplate, choice: EventChoice): NonNullable<EventChoice["next"]> {
  if (choice.next) return choice.next;
  const id = `${event.id}:${choice.id}`;
  if (/race_accept|race_wager|shortcut_flat_out|floor_it|cross_fast|maintain_speed|drive_faster|wildlife_edge/.test(id)) return "driving";
  if (/garage_service|village_garage/.test(id)) return "mechanic";
  if (/claim_press|stop_polite|museum_full_tour|view_photos/.test(id)) return "trivia";
  if (/take_shortcut|take_navigator|tea_farmer|tractor_tow|festival_join|garage_chat/.test(id)) return "side-chat";
  return "resolve";
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Game() {
  const { saveId } = useParams();
  const [, setLocation] = useLocation();

  const [mode, setMode] = useState<GameMode>("loading");
  const [tab, setTab] = useState<"chat" | "journey">("chat");
  const [pendingEvent, setPendingEvent] = useState<RoadEventTemplate | null>(null);
  const [turnPhase, setTurnPhase] = useState<TurnPhase>("navigation");
  const [turnNumber, setTurnNumber] = useState(0);
  const [resolving, setResolving] = useState(false);
  // Single shared lock so the three advance paths + road-event resolution can
  // never run concurrently with stale-closure values.
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [showMechanic, setShowMechanic] = useState(false);
  const [driveResult, setDriveResult] = useState<DriveResult | null>(null);
  const [adventureDrive, setAdventureDrive] = useState<AdventureDrive | null>(null);
  const [upgrades, setUpgrades] = useState<Upgrades>({});
  const [shownEventIds, setShownEventIds] = useState<Set<string>>(new Set());
  const [chatReact, setChatReact] = useState<{ id: string; context: string; tone?: string } | null>(null);
  const [pendingAfterMechanic, setPendingAfterMechanic] = useState(false);
  const [triviaSource, setTriviaSource] = useState<"event" | "forward" | "manual">("manual");
  const [lastOutcome, setLastOutcome] = useState<OutcomeSummary | null>(null);

  // Resources
  const [condition, setCondition] = useState(70);
  const [fuel, setFuel] = useState(100);
  const [food, setFood] = useState(3);
  const [parts, setParts] = useState(2);
  const [funds, setFunds] = useState(0);
  const [distKm, setDistKm] = useState(0);
  const [camaraderie, setCamaraderie] = useState(0);
  const [journeyHours, setJourneyHours] = useState(0);
  const [currentDay, setCurrentDay] = useState(1);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

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

  const awardGarageCredits = useCallback((amount: number, reason: string) => {
    const credits = Math.round(amount * ECONOMY.dragRewardMultiplier);
    if (credits <= 0) return;
    void garageApi.awardCredits(credits, reason).catch(() => undefined);
  }, []);

  const findActiveGarageCar = useCallback((): GarageCar | undefined => {
    if (!saveId || !save?.carId) return undefined;
    return loadGarage(saveId).cars.find((garageCar) => garageCar.id === save.carId);
  }, [saveId, save?.carId]);

  const syncActiveVehicleCondition = useCallback((nextCondition: number) => {
    const activeCar = findActiveGarageCar();
    if (!activeCar) return;
    const localKey =
      (activeCar as GarageCar & { canonicalVehicleKey?: string; canonicalKey?: string }).canonicalVehicleKey ??
      (activeCar as GarageCar & { canonicalVehicleKey?: string; canonicalKey?: string }).canonicalKey ??
      canonicalVehicleKey(activeCar.name);
    const conditionPatch = Math.max(0, Math.min(100, Math.round(nextCondition)));
    void garageApi.getGarage()
      .then((garage) => {
        const owned = garage.vehicles.find((vehicle) =>
          vehicle.canonicalVehicleKey === localKey ||
          canonicalVehicleKey(vehicle.name) === localKey ||
          vehicle.sourceCarId === activeCar.id
        );
        if (!owned) return;
        return garageApi.patchVehicle(owned.canonicalVehicleKey, { condition: conditionPatch });
      })
      .catch(() => undefined);
  }, [findActiveGarageCar]);

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
      const campaignState = ensureCampaignState(save.id);
      setInventoryItems(ensureStarterInventory(save.id));
      setJourneyHours(campaignState.journeyHours);
      setCurrentDay(campaignState.currentDay);
    } else {
      setInventoryItems([]);
    }
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

    if (isSeries) {
      setTurnPhase("navigation");
      setPendingEvent(null);
      setTab("chat");
    } else {
      // Arcade keeps the simple free-play flow: a road event opens the scene.
      const firstEvt = pickNextEvent(new Set());
      if (firstEvt) {
        setShownEventIds(new Set([firstEvt.id]));
        setPendingEvent(firstEvt);
        setTurnPhase("road-event");
        setTab("chat");
      }
    }

    setMode("hub");
  }, [save, mission, character, isSeries, saveId, findActiveGarageCar]);

  const stats = upgradeStats(upgrades);
  const car = findActiveGarageCar() ?? mission?.availableCars?.find((c: { id: number }) => c.id === save?.carId);
  const carTopDownSprite = car
    ? vehicleTopDownSprite(
        (car as { name?: string }).name ?? "Road car",
        (car as { power?: number }).power ?? 5,
        (car as { offRoad?: number }).offRoad ?? 5,
      )
    : undefined;

  const whoIsDriving = isSeries
    ? `${displayName}, the fourth member of the team touring with Jeremy, Richard and James,`
    : `${character?.name ?? "The driver"}`;
  const gameContext = mission
    ? `${whoIsDriving} is on a road trip across ${mission.location} — ${mission.title}. Distance covered: ${Math.round(distKm)} km of ${TRIP_KM} km. Car condition: ${Math.round(condition)}%. Fuel: ${Math.round(fuel)}%. Funds: £${funds}.`
    : "";

  const missionPromptInfo = mission
    ? { id: mission.id, title: mission.title, location: mission.location }
    : null;
  const missionTerrain = ((mission as { terrain?: string } | undefined)?.terrain ?? mission?.location ?? "road").toString();
  const navigationPrompt = useMemo(
    () => missionPromptInfo ? buildNavigationPrompt(missionPromptInfo, missionTerrain, turnNumber) : null,
    [missionPromptInfo, missionTerrain, turnNumber],
  );
  const forwardPrompt = useMemo(
    () => missionPromptInfo ? buildForwardPrompt(missionPromptInfo, turnNumber, missionTerrain) : null,
    [missionPromptInfo, turnNumber, missionTerrain],
  );
  const activeAdventurePrompt = isSeries
    ? turnPhase === "navigation"
      ? navigationPrompt
      : turnPhase === "advance"
        ? forwardPrompt
        : pendingEvent
    : pendingEvent;
  const activeTurnCopy = TURN_PHASE_COPY[turnPhase];

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

  const advanceClock = useCallback((hours: number) => {
    if (!isSeries || !save) return;
    const next = advanceCampaignTime(save.id, hours, mission?.location ?? mission?.title);
    setJourneyHours(next.journeyHours);
    setCurrentDay(next.currentDay);
  }, [isSeries, save, mission?.location, mission?.title]);

  const finishBusy = useCallback(() => {
    busyRef.current = false;
    setBusy(false);
  }, []);

  const timeForChoice = useCallback((choice: EventChoice) => {
    if (choice.timeEffectHours != null) return choice.timeEffectHours;
    if (choice.risk === "safe") return choice.distanceEffect > 55 ? 4 : 3;
    if (choice.risk === "risky") return 2;
    return 1;
  }, []);

  const getChoiceDisabledReason = useCallback((choice: EventChoice) => {
    if (!isSeries || !choice.consumedItemId) return null;
    const hasItem = inventoryItems.some((item) => item.id === choice.consumedItemId && item.qty > 0);
    return hasItem ? null : `Needs ${inventoryItemName(choice.consumedItemId)}.`;
  }, [isSeries, inventoryItems]);

  const applyInventoryEffects = useCallback((choice: EventChoice) => {
    if (!isSeries || !save) return [];
    const notes: string[] = [];
    if (choice.consumedItemId) {
      const hasItem = loadInventory(save.id).some((item) => item.id === choice.consumedItemId && item.qty > 0);
      if (!hasItem) return [`Missing ${inventoryItemName(choice.consumedItemId)}`];
      const next = consumeInventoryItem(save.id, choice.consumedItemId);
      setInventoryItems(next);
      notes.push(`Used ${inventoryItemName(choice.consumedItemId)}`);
    }
    if (choice.itemRewardId) {
      const qty = choice.itemRewardQty ?? 1;
      const next = grantInventoryItem(save.id, choice.itemRewardId, qty);
      setInventoryItems(next);
      notes.push(`Gained ${inventoryItemName(choice.itemRewardId)}${qty > 1 ? ` x${qty}` : ""}`);
    }
    return notes;
  }, [isSeries, save]);

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
      recordCompletedEpisode(save.id, save.missionId);
      addPlayerXp(save.id, 100, save.playerName ?? displayName);
      awardGarageCredits(175 + Math.max(0, save.seriesStageIndex ?? 0) * 5, `Episode ${save.missionId} completed`);

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
  }, [save, isSeries, stagesList, updateSave, food, parts, setLocation, displayName, awardGarageCredits]);

  // ── Shared advance resolver (challenge / press on / trivia) ────────────────
  const resolveAdvance = useCallback(async (opts: {
    earnings?: number;
    condDelta?: number;
    fuelCost?: number;
    kmEarned: number;
    camaraderieDelta?: number;
    result?: DriveResult | null;
    chat?: { context: string; tone?: string };
    after?: "event" | "advance" | "navigation";
    timeHours?: number;
    outcome?: Omit<OutcomeSummary, "id">;
    xp?: number;
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
    syncActiveVehicleCondition(newCond);
    setDistKm(newDist);
    setFuel(newFuel);
    setCamaraderie(newCam);
    setDriveResult(opts.result ?? null);
    const xpEarned = isSeries ? Math.max(5, Math.round(opts.xp ?? (opts.kmEarned / 5 + Math.max(0, earnings) / 25))) : 0;
    if (isSeries && xpEarned > 0) addPlayerXp(save.id, xpEarned, save.playerName ?? displayName);
    if (opts.outcome) setLastOutcome({ id: `outcome-${Date.now()}`, xpDelta: xpEarned || undefined, ...opts.outcome });
    setMode("hub");
    advanceClock(opts.timeHours ?? 2);
    if (opts.chat) setChatReact({ id: `adv-${Date.now()}`, context: opts.chat.context, tone: opts.chat.tone });

    await persistProgress(newFunds, newDist, { camaraderie: newCam });

    // Game over conditions
    if (newCond <= 0) {
      toast({ title: "💥 Car destroyed!", description: "The car has completely given up. That's it.", variant: "destructive" });
      setMode("gameover");
      await updateSave.mutateAsync({ id: save.id, data: { status: "failed", distanceTravelled: priorDistRef.current + Math.round(newDist) } });
      setTimeout(() => setLocation(`/results/${save.id}`), 2500);
      finishBusy();
      return;
    }
    if (newFuel <= 0) {
      toast({ title: "🛢 Out of fuel!", description: "You've ground to a halt in the middle of nowhere.", variant: "destructive" });
      setMode("gameover");
      await updateSave.mutateAsync({ id: save.id, data: { status: "failed", distanceTravelled: priorDistRef.current + Math.round(newDist) } });
      setTimeout(() => setLocation(`/results/${save.id}`), 2500);
      finishBusy();
      return;
    }

    // Stage / trip complete?
    if (newDist >= TRIP_KM) {
      await finishStage(newFunds, newDist, newCam);
      finishBusy();
      return;
    }

    const after = opts.after ?? "event";
    if (isSeries && after === "advance") {
      setPendingEvent(null);
      setTurnPhase("advance");
      setTab("chat");
      if (opts.result) setTimeout(() => setDriveResult(null), 6000);
      finishBusy();
      return;
    }
    if (isSeries && after === "navigation") {
      setPendingEvent(null);
      setTurnPhase("navigation");
      setTurnNumber((value) => value + 1);
      setTab("chat");
      if (opts.result) setTimeout(() => setDriveResult(null), 6000);
      finishBusy();
      return;
    }

    // Arcade/free-play still surfaces a road event after advancing.
    let surfacedEvent = false;
    if (!pendingEvent) {
      const evt = pickNextEvent(shownEventIds);
      if (evt) {
        setShownEventIds(prev => new Set([...prev, evt.id]));
        setPendingEvent(evt);
        surfacedEvent = true;
      }
    }
    setTab(surfacedEvent ? "chat" : "journey");
    if (opts.result) setTimeout(() => setDriveResult(null), 6000);
    finishBusy();
  }, [save, funds, condition, distKm, fuel, camaraderie, pendingEvent, shownEventIds, persistProgress, updateSave, setLocation, finishStage, isSeries, advanceClock, finishBusy, displayName, syncActiveVehicleCondition]);

  // ── Driving challenge complete ─────────────────────────────────────────────
  const handleDriveComplete = useCallback((earnings: number, condDelta: number, kmEarned: number) => {
    if (adventureDrive && save) {
      const { event, choice } = adventureDrive;
      const garageCreditReward = isSeries ? Math.max(30, Math.round(Math.max(0, earnings) * 0.5)) : 0;
      setAdventureDrive(null);
      const inventoryNotes = applyInventoryEffects(choice);
      if (inventoryNotes.length > 0) {
        toast({ title: "Inventory updated", description: inventoryNotes.join(" | ") });
      }
      if (isSeries) recordDrivingChallenge(save.id);
      if (garageCreditReward > 0) awardGarageCredits(garageCreditReward, "Driving challenge reward");
      void recordEvent.mutateAsync({
        saveId: save.id,
        data: {
          eventType: event.type === "navigation" ? "shortcut" : event.type === "encounter" ? "banter" : "mechanical",
          title: event.title,
          description: `${choice.outcome} The playable challenge added Â£${earnings} and ${kmEarned}km.`,
          outcome: choice.label,
          fundsChange: choice.fundsEffect + earnings,
        },
      }).catch(() => {});
      void resolveAdvance({
        earnings: earnings + choice.fundsEffect,
        condDelta: condDelta + choice.damageEffect,
        kmEarned: kmEarned + Math.max(0, Math.round(choice.distanceEffect / 2)),
        fuelCost: Math.round(10 + Math.random() * 8),
        camaraderieDelta: choice.risk === "mad" ? 4 : 2,
        result: { earnings, condDelta: condDelta + choice.damageEffect, distKm: kmEarned },
        after: isSeries ? "advance" : "event",
        timeHours: timeForChoice(choice),
        xp: 40 + Math.round(kmEarned / 3),
        outcome: {
          title: "Driving challenge resolved",
          detail: choice.outcome,
          tone: condDelta + choice.damageEffect < -15 ? "bad" : "good",
          fundsDelta: earnings + choice.fundsEffect,
          distanceDelta: kmEarned + Math.max(0, Math.round(choice.distanceEffect / 2)),
          conditionDelta: condDelta + choice.damageEffect,
          timeHours: timeForChoice(choice),
          garageCreditsDelta: garageCreditReward || undefined,
        },
        chat: {
          context: `${displayName || "The driver"} chose "${choice.label}", which turned into a full playable road challenge. ${choice.outcome}`,
          tone: choice.risk === "mad" ? "alarmed" : "excited",
        },
      });
      return;
    }
    if (isSeries && save) recordDrivingChallenge(save.id);
    const garageCreditReward = isSeries ? Math.max(25, Math.round(Math.max(0, earnings) * 0.5)) : 0;
    if (garageCreditReward > 0) awardGarageCredits(garageCreditReward, "Driving challenge reward");
    void resolveAdvance({
      earnings,
      condDelta,
      kmEarned,
      fuelCost: Math.round(8 + Math.random() * 6),
      camaraderieDelta: 2,
      result: { earnings, condDelta, distKm: kmEarned },
      after: isSeries ? "navigation" : "event",
      timeHours: 2,
      xp: 35 + Math.round(kmEarned / 3),
      outcome: {
        title: "Driving challenge complete",
        detail: condDelta < 0 ? "You banked the money, but the car paid for it." : "You banked the money and kept the car mostly in one piece.",
        tone: condDelta < 0 ? "neutral" : "good",
        fundsDelta: earnings,
        distanceDelta: kmEarned,
        conditionDelta: condDelta,
        timeHours: 2,
        garageCreditsDelta: garageCreditReward || undefined,
      },
      chat: {
        context: `${displayName || "The driver"} just finished a driving challenge, banking £${earnings} and covering ${kmEarned}km${condDelta < 0 ? ", taking some damage on the way" : " without a scratch"}.`,
        tone: condDelta < 0 ? "mocking" : "impressed",
      },
    });
  }, [adventureDrive, save, recordEvent, resolveAdvance, displayName, isSeries, timeForChoice, applyInventoryEffects, awardGarageCredits]);

  const handleSlalomComplete = useCallback((earnings: number, condDelta: number, kmEarned: number) => {
    if (isSeries && save) recordDrivingChallenge(save.id);
    const garageCreditReward = isSeries ? Math.max(30, Math.round(Math.max(0, earnings) * 0.5)) : 0;
    if (garageCreditReward > 0) awardGarageCredits(garageCreditReward, "Slalom challenge reward");
    void resolveAdvance({
      earnings,
      condDelta,
      kmEarned,
      fuelCost: 8,
      camaraderieDelta: 3,
      result: { earnings, condDelta, distKm: kmEarned },
      after: isSeries ? "navigation" : "event",
      timeHours: 2,
      xp: 45 + Math.round(kmEarned / 3),
      outcome: {
        title: "Slalom run complete",
        detail: "The downhill trial is over. The clock, the gates, and the bodywork have all had their say.",
        tone: condDelta < -15 ? "bad" : "good",
        fundsDelta: earnings,
        distanceDelta: kmEarned,
        conditionDelta: condDelta,
        fuelDelta: -8,
        timeHours: 2,
        garageCreditsDelta: garageCreditReward || undefined,
      },
      chat: {
        context: `${displayName || "The driver"} just finished a downhill slalom trial, banking GBP ${earnings} and covering ${kmEarned}km.`,
        tone: condDelta < -15 ? "mocking" : "impressed",
      },
    });
  }, [displayName, isSeries, resolveAdvance, save, awardGarageCredits]);

  // ── Press On: free advance that costs fuel + wear ──────────────────────────
  const handlePressOn = useCallback(() => {
    const km = 55 + Math.round(Math.random() * 20);
    void resolveAdvance({
      kmEarned: km,
      fuelCost: 14,
      condDelta: -8,
      after: isSeries ? "navigation" : "event",
      timeHours: 3,
      xp: 16,
      outcome: {
        title: "Pressed on",
        detail: "No stop, no ceremony. Just distance, fuel burn, and some fresh mechanical suspicion.",
        tone: "neutral",
        distanceDelta: km,
        conditionDelta: -8,
        fuelDelta: -14,
        timeHours: 3,
      },
      chat: {
        context: `${displayName || "The driver"} just pressed on and ground out ${km}km of road without stopping for anything.`,
        tone: "weary",
      },
    });
  }, [resolveAdvance, displayName, isSeries]);

  // ── Trivia (Pub Quiz): answer to advance + small reward ────────────────────
  const openTrivia = useCallback(() => {
    setTriviaResult(null);
    setTriviaSource(isSeries ? "forward" : "manual");
    setTrivia(pickTrivia(usedTriviaRef.current, mission?.id));
  }, [mission?.id, isSeries]);

  const answerTrivia = useCallback((idx: number) => {
    if (!trivia || triviaResult) return;
    usedTriviaRef.current.add(trivia.id);
    if (isSeries && save) recordCampaignTrivia(save.id, trivia.id);
    const correct = idx === trivia.answer;
    setTriviaResult(correct ? "correct" : "wrong");
    const km = correct ? 60 : 25;
    const earnings = correct ? 50 : 0;
    const garageCreditReward = correct ? (isSeries ? 35 : 15) : 0;
    if (garageCreditReward > 0) awardGarageCredits(garageCreditReward, "Trivia reward");
    setTimeout(() => {
      setTrivia(null);
      setTriviaResult(null);
      void resolveAdvance({
        earnings,
        kmEarned: km,
        fuelCost: 5,
        camaraderieDelta: correct ? 2 : 0,
        after: isSeries ? (triviaSource === "event" ? "advance" : "navigation") : "event",
        timeHours: correct ? 1 : 2,
        xp: correct ? 30 : 10,
        outcome: {
          title: correct ? "Pub quiz won" : "Pub quiz survived",
          detail: correct
            ? "Correct answer. Cash, pride, and forward motion."
            : "Wrong answer. The journey continues, but nobody is letting it go.",
          tone: correct ? "good" : "neutral",
          fundsDelta: earnings,
          distanceDelta: km,
          fuelDelta: -5,
          timeHours: correct ? 1 : 2,
          garageCreditsDelta: garageCreditReward || undefined,
        },
        chat: {
          context: correct
            ? `${displayName || "The driver"} just nailed a car-trivia question over the radio for a bit of cash and bragging rights.`
            : `${displayName || "The driver"} just got a car-trivia question hopelessly wrong over the radio.`,
          tone: correct ? "impressed" : "mocking",
        },
      });
      setTriviaSource("manual");
    }, 1100);
  }, [trivia, triviaResult, resolveAdvance, displayName, isSeries, save, triviaSource, awardGarageCredits]);

  const handleNavigationChoice = useCallback(async (choice: EventChoice) => {
    if (!save || !mission || resolving) return;
    setResolving(true);

    const hours = timeForChoice(choice);
    const newFunds = Math.max(0, funds + choice.fundsEffect);
    const newDist = Math.min(TRIP_KM, distKm + choice.distanceEffect);
    const newCond = Math.max(0, Math.min(100, condition + choice.damageEffect));
    const fuelUse = Math.max(5, Math.round(choice.distanceEffect / 9));
    const newFuel = Math.max(0, fuel + (choice.fuelEffect ?? -fuelUse));
    const foodUse = hours >= 3 ? 1 : 0;
    const newFood = Math.max(0, food + (choice.foodEffect ?? -foodUse));
    const camGain = choice.risk === "mad" ? 3 : choice.risk === "risky" ? 2 : 1;
    const newCam = Math.min(100, camaraderie + camGain);

    setFunds(newFunds);
    setDistKm(newDist);
    setCondition(newCond);
    syncActiveVehicleCondition(newCond);
    setFuel(newFuel);
    setFood(newFood);
    setCamaraderie(newCam);
    advanceClock(hours);

    try {
      await Promise.all([
        recordEvent.mutateAsync({
          saveId: save.id,
          data: {
            eventType: "shortcut",
            title: "Route chosen",
            description: choice.outcome,
            outcome: choice.label,
            fundsChange: choice.fundsEffect,
          },
        }),
        updateSave.mutateAsync({
          id: save.id,
          data: {
            funds: newFunds,
            distanceTravelled: priorDistRef.current + Math.round(newDist),
            status: "on_road",
            food: newFood,
            parts,
            camaraderie: newCam,
          },
        }),
      ]);
    } catch { /* silent */ }

    setChatReact({
      id: `nav-${Date.now()}`,
      context: `${displayName || "The driver"} chose "${choice.label}". ${choice.outcome}`,
      tone: choice.risk === "mad" ? "alarmed" : choice.risk === "risky" ? "excited" : "approving",
    });
    const xpEarned = isSeries ? 12 + Math.round(choice.distanceEffect / 8) + (choice.risk === "mad" ? 8 : choice.risk === "risky" ? 4 : 0) : 0;
    if (isSeries && xpEarned > 0) addPlayerXp(save.id, xpEarned, save.playerName ?? displayName);
    setLastOutcome({
      id: `nav-outcome-${Date.now()}`,
      title: "Route chosen",
      detail: choice.outcome,
      tone: newCond < condition || newFuel < fuel ? "neutral" : "good",
      fundsDelta: choice.fundsEffect,
      distanceDelta: choice.distanceEffect,
      conditionDelta: choice.damageEffect,
      fuelDelta: newFuel - fuel,
      foodDelta: newFood - food,
      timeHours: hours,
      xpDelta: xpEarned || undefined,
    });

    if (newDist >= TRIP_KM) {
      setResolving(false);
      await finishStage(newFunds, newDist, newCam);
      return;
    }

    if (newCond <= 0 || newFuel <= 0) {
      setResolving(false);
      setMode("gameover");
      await updateSave.mutateAsync({ id: save.id, data: { status: "failed", distanceTravelled: priorDistRef.current + Math.round(newDist) } });
      setTimeout(() => setLocation(`/results/${save.id}`), 2500);
      return;
    }

    const evt = pickNextEvent(shownEventIds);
    if (evt) {
      setShownEventIds((prev) => new Set([...prev, evt.id]));
      setPendingEvent(evt);
      setTurnPhase("road-event");
    } else {
      setPendingEvent(null);
      setTurnPhase("advance");
    }
    setTab("chat");
    setResolving(false);
  }, [save, mission, resolving, timeForChoice, funds, distKm, condition, fuel, food, camaraderie, advanceClock, recordEvent, updateSave, parts, displayName, finishStage, setLocation, shownEventIds, syncActiveVehicleCondition]);

  const handleForwardChoice = useCallback((choice: EventChoice) => {
    if (choice.id.startsWith("drive-")) {
      setChatReact({
        id: `forward-drive-${Date.now()}`,
        context: `${displayName || "The driver"} chose to turn the next stretch into a driving challenge.`,
        tone: "excited",
      });
      setMode("driving");
      return;
    }
    if (choice.id.startsWith("slalom-")) {
      setChatReact({
        id: `forward-slalom-${Date.now()}`,
        context: `${displayName || "The driver"} chose to turn the next stretch into a downhill slalom trial.`,
        tone: "excited",
      });
      setMode("slalom");
      return;
    }
    if (choice.id.startsWith("quiz-")) {
      setTriviaSource("forward");
      setTriviaResult(null);
      setTrivia(pickTrivia(usedTriviaRef.current, mission?.id));
      return;
    }
    handlePressOn();
  }, [displayName, mission?.id, handlePressOn]);

  // ── Road event choice ─────────────────────────────────────────────────────
  const handleChoice = useCallback(async (choice: EventChoice) => {
    if (!save || !pendingEvent) return;
    setResolving(true);
    const disabledReason = getChoiceDisabledReason(choice);
    if (disabledReason) {
      toast({ title: "Item needed", description: disabledReason, variant: "destructive" });
      setResolving(false);
      return;
    }

    const nextStep = nextStepForChoice(pendingEvent, choice);
    if (nextStep === "driving") {
      const event = pendingEvent;
      setPendingEvent(null);
      setResolving(false);
      setAdventureDrive({ event, choice });
      setChatReact({
        id: `evt-drive-${Date.now()}`,
        context: `${displayName || "The driver"} accepted "${choice.label}". The idea has immediately become a proper driving challenge.`,
        tone: choice.risk === "mad" ? "alarmed" : "excited",
      });
      setMode("driving");
      return;
    }

    if (nextStep === "mechanic") {
      setPendingEvent(null);
      setResolving(false);
      setPendingAfterMechanic(true);
      setShowMechanic(true);
      setChatReact({
        id: `evt-mech-${Date.now()}`,
        context: `${displayName || "The driver"} chose "${choice.label}", so the team has peeled into a local garage encounter before continuing.`,
        tone: "cautious",
      });
      return;
    }

    if (nextStep === "trivia") {
      setPendingEvent(null);
      setResolving(false);
      setTriviaSource("event");
      setTriviaResult(null);
      setTrivia(pickTrivia(usedTriviaRef.current, mission?.id));
      setChatReact({
        id: `evt-quiz-${Date.now()}`,
        context: `${displayName || "The driver"} chose "${choice.label}", which has turned into a quick pub-quiz style argument over the radio.`,
        tone: "competitive",
      });
      return;
    }

    const newFunds = Math.max(0, funds + choice.fundsEffect);
    setFunds(newFunds);

    const newDist = Math.min(TRIP_KM, distKm + (choice.distanceEffect ?? 0));
    setDistKm(newDist);

    const newCond = Math.max(0, Math.min(100, condition + choice.damageEffect));
    const hours = timeForChoice(choice);
    const fuelUse = Math.max(3, Math.round(Math.max(10, choice.distanceEffect) / 14));
    const newFuel = Math.max(0, fuel + (choice.fuelEffect ?? -fuelUse));
    const newFood = Math.max(0, food + (choice.foodEffect ?? (hours >= 3 ? -1 : 0)));
    const newParts = Math.max(0, parts + (choice.partsEffect ?? 0));
    const inventoryNotes = applyInventoryEffects(choice);

    setCondition(newCond);
    syncActiveVehicleCondition(newCond);
    setFuel(newFuel);
    setFood(newFood);
    setParts(newParts);
    advanceClock(hours);

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
        updateSave.mutateAsync({
          id: save.id,
          data: {
            funds: newFunds,
            distanceTravelled: priorDistRef.current + Math.round(newDist),
            food: newFood,
            parts: newParts,
            camaraderie: newCam,
          },
        }),
      ]);
    } catch { /* silent */ }

    setResolving(false);
    setPendingEvent(null);
    if (isSeries) setTurnPhase("advance");
    const xpEarned = isSeries ? 14 + Math.round(choice.distanceEffect / 8) + (choice.risk === "mad" ? 10 : choice.risk === "risky" ? 5 : 0) : 0;
    if (isSeries && xpEarned > 0) addPlayerXp(save.id, xpEarned, save.playerName ?? displayName);
    setLastOutcome({
      id: `event-outcome-${Date.now()}`,
      title: pendingEvent.title,
      detail: inventoryNotes.length > 0 ? `${choice.outcome} ${inventoryNotes.join(" | ")}` : choice.outcome,
      tone: newCond < condition || newFuel < fuel ? "neutral" : "good",
      fundsDelta: choice.fundsEffect,
      distanceDelta: choice.distanceEffect,
      conditionDelta: choice.damageEffect,
      fuelDelta: newFuel - fuel,
      foodDelta: newFood - food,
      partsDelta: newParts - parts,
      timeHours: hours,
      xpDelta: xpEarned || undefined,
    });

    setChatReact({
      id: `evt-${Date.now()}`,
      context: `${displayName || "The driver"} just faced the road event "${pendingEvent.title}" and chose to "${choice.label}" — ${choice.outcome} (funds changed by £${choice.fundsEffect}).`,
      tone: nextStep === "side-chat" ? "secretive" : choice.risk === "mad" ? "alarmed" : choice.risk === "risky" ? "skeptical" : "approving",
    });

    // Brief outcome toast
    toast({
      title: choice.label,
      description: inventoryNotes.length > 0 ? `${choice.outcome} ${inventoryNotes.join(" | ")}` : choice.outcome,
    });

    // Trip / stage complete via event distance?
    if (newDist >= TRIP_KM) {
      await finishStage(newFunds, newDist, newCam);
    }
    if (newCond <= 0 || newFuel <= 0) {
      setMode("gameover");
      await updateSave.mutateAsync({ id: save.id, data: { status: "failed", distanceTravelled: priorDistRef.current + Math.round(newDist) } });
      setTimeout(() => setLocation(`/results/${save.id}`), 2500);
    }
  }, [save, pendingEvent, funds, distKm, condition, fuel, food, parts, camaraderie, recordEvent, updateSave, displayName, finishStage, mission?.id, timeForChoice, advanceClock, isSeries, setLocation, getChoiceDisabledReason, applyInventoryEffects, syncActiveVehicleCondition]);

  // ── Mechanic purchase ──────────────────────────────────────────────────────
  const handleMechanicPurchase = async (offer: MechanicOffer) => {
    if (!save || funds < offer.cost) { toast({ title: "Not enough funds", variant: "destructive" }); return; }
    if (offer.action === "item" && (!isSeries || !offer.itemId)) {
      toast({ title: "Campaign item", description: "Trip kit is saved in Series Mode inventories." });
      return;
    }
    const newFunds = funds - offer.cost;
    const nextCondition = offer.action === "repair" ? Math.min(100, condition + offer.amount) : condition;
    setFunds(newFunds);
    if (offer.action === "repair") {
      setCondition(nextCondition);
      syncActiveVehicleCondition(nextCondition);
    }
    if (offer.action === "fuel") setFuel(100);
    let newFood = food;
    let newParts = parts;
    if (offer.action === "food") { newFood = Math.min(10, food + offer.amount); setFood(newFood); }
    if (offer.action === "parts") { newParts = Math.min(10, parts + offer.amount); setParts(newParts); }
    if (offer.action === "item" && offer.itemId) {
      const nextInventory = grantInventoryItem(save.id, offer.itemId, offer.amount);
      setInventoryItems(nextInventory);
    }
    await updateSave.mutateAsync({ id: save.id, data: { funds: newFunds, food: newFood, parts: newParts } });
    if (isSeries) advanceClock(1);
    if (pendingAfterMechanic && isSeries) {
      setPendingAfterMechanic(false);
      setShowMechanic(false);
      setTurnPhase("advance");
      setTab("chat");
    }
    setLastOutcome({
      id: `mechanic-outcome-${Date.now()}`,
      title: offer.label,
      detail: offer.action === "repair"
        ? "A local stop eats time and money, and the garage condition record has been updated."
        : offer.action === "item" && offer.itemId
          ? `${inventoryItemName(offer.itemId)} added to the trip inventory for later trouble.`
          : "A local stop eats time and money, but the team is better prepared for the next bad idea.",
      tone: "good",
      fundsDelta: -offer.cost,
      conditionDelta: offer.action === "repair" ? nextCondition - condition : undefined,
      fuelDelta: offer.action === "fuel" ? 100 - fuel : undefined,
      foodDelta: offer.action === "food" ? newFood - food : undefined,
      partsDelta: offer.action === "parts" ? newParts - parts : undefined,
      timeHours: isSeries ? 1 : undefined,
      xpDelta: isSeries ? (offer.action === "item" ? 8 : 12) : undefined,
    });
    if (isSeries) addPlayerXp(save.id, offer.action === "item" ? 8 : 12, save.playerName ?? displayName);
    toast({ title: offer.label, description: "Sorted. Back on the road." });
  };

  // ── Use part ──────────────────────────────────────────────────────────────
  const handleUsePart = () => {
    if (parts <= 0) { toast({ title: "No spare parts", variant: "destructive" }); return; }
    const newParts = parts - 1;
    const nextCondition = Math.min(100, condition + 30);
    setParts(newParts);
    setCondition(nextCondition);
    syncActiveVehicleCondition(nextCondition);
    if (save) updateSave.mutate({ id: save.id, data: { parts: newParts } });
    setLastOutcome({
      id: `repair-outcome-${Date.now()}`,
      title: "Roadside repair",
      detail: "A spare part has been sacrificed to keep the journey moving.",
      tone: "good",
      conditionDelta: nextCondition - condition,
      partsDelta: -1,
      xpDelta: isSeries ? 8 : undefined,
    });
    if (isSeries && save) addPlayerXp(save.id, 8, save.playerName ?? displayName);
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
  const visibleInventoryItems = inventoryItems.filter((item) => item.qty > 0).slice(0, 5);
  const inventoryCount = inventoryItems.reduce((total, item) => total + item.qty, 0);
  const dayHourLabel = `Day ${currentDay}, Hour ${journeyHours % 12}`;

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
          vehicleSprite={getVehicleSprite(car)}
          vehiclePaintColor={(car as Partial<GarageCar> | undefined)?.paintColor ?? null}
          onComplete={handleDriveComplete}
          onExit={() => setMode("hub")}
        />
      </div>
    );
  }

  // ── Hub mode ───────────────────────────────────────────────────────────────
  if (mode === "slalom") {
    return (
      <JaguarSkiSlalomGame
        embedded
        vehicleSprite={carTopDownSprite}
        onComplete={handleSlalomComplete}
        onExit={() => setMode("hub")}
      />
    );
  }

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
              {isSeries && <span className="ml-1 text-primary">D{currentDay} H{journeyHours % 12}</span>}
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
            {(activeAdventurePrompt || driveResult) && tab !== "journey" && (
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
            adventureEvent={activeAdventurePrompt}
            adventurePhase={isSeries ? turnPhase : "road-event"}
            resolvingAdventure={resolving}
            saveId={save.id}
            getAdventureChoiceDisabledReason={getChoiceDisabledReason}
            onAdventureChoice={(choice) => {
              if (isSeries && turnPhase === "navigation") {
                void handleNavigationChoice(choice);
                return;
              }
              if (isSeries && turnPhase === "advance") {
                handleForwardChoice(choice);
                return;
              }
              void handleChoice(choice);
            }}
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

            {isSeries && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">Quest loop</p>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {TURN_PHASES.map((phase, index) => {
                    const active = phase.id === turnPhase;
                    const complete =
                      (turnPhase === "road-event" && phase.id === "navigation") ||
                      (turnPhase === "advance" && phase.id !== "advance");
                    return (
                      <div
                        key={phase.id}
                        className={`rounded-lg border px-2 py-2 ${
                          active
                            ? "border-primary bg-primary/15 text-foreground"
                            : complete
                              ? "border-green-500/40 bg-green-500/10 text-green-200"
                              : "border-border bg-background/40 text-muted-foreground"
                        }`}
                      >
                        <p className="text-[9px] font-mono font-black">{index + 1}</p>
                        <p className="text-[10px] font-black uppercase leading-tight">{phase.label}</p>
                        <p className="mt-0.5 text-[9px] leading-tight opacity-80">{phase.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {lastOutcome && (
              <div className={`rounded-xl border p-3 ${
                lastOutcome.tone === "bad"
                  ? "border-red-500/40 bg-red-500/10"
                  : lastOutcome.tone === "good"
                    ? "border-green-500/40 bg-green-500/10"
                    : "border-amber-500/40 bg-amber-500/10"
              }`}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary">Latest turn</p>
                    <h3 className="text-sm font-black uppercase leading-tight">{lastOutcome.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{lastOutcome.detail}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-1 text-[10px] font-mono text-muted-foreground">
                  {lastOutcome.timeHours != null && <span>time {lastOutcome.timeHours}h</span>}
                  {lastOutcome.distanceDelta != null && <span>road {lastOutcome.distanceDelta > 0 ? "+" : ""}{lastOutcome.distanceDelta}km</span>}
                  {lastOutcome.fundsDelta != null && lastOutcome.fundsDelta !== 0 && <span>cash {lastOutcome.fundsDelta > 0 ? "+" : ""}GBP {lastOutcome.fundsDelta}</span>}
                  {lastOutcome.conditionDelta != null && lastOutcome.conditionDelta !== 0 && <span>car {lastOutcome.conditionDelta > 0 ? "+" : ""}{lastOutcome.conditionDelta}%</span>}
                  {lastOutcome.fuelDelta != null && lastOutcome.fuelDelta !== 0 && <span>fuel {lastOutcome.fuelDelta > 0 ? "+" : ""}{lastOutcome.fuelDelta}%</span>}
                  {lastOutcome.foodDelta != null && lastOutcome.foodDelta !== 0 && <span>food {lastOutcome.foodDelta > 0 ? "+" : ""}{lastOutcome.foodDelta}</span>}
                  {lastOutcome.partsDelta != null && lastOutcome.partsDelta !== 0 && <span>parts {lastOutcome.partsDelta > 0 ? "+" : ""}{lastOutcome.partsDelta}</span>}
                  {lastOutcome.xpDelta != null && lastOutcome.xpDelta !== 0 && <span>xp +{lastOutcome.xpDelta}</span>}
                  {lastOutcome.garageCreditsDelta != null && lastOutcome.garageCreditsDelta !== 0 && <span>garage CR +{lastOutcome.garageCreditsDelta}</span>}
                </div>
              </div>
            )}

            {isSeries && (
              <div className="grid grid-cols-1 gap-2">
                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <Clock className="h-3 w-3" /> Journey Clock
                    </span>
                    <span className="font-mono text-xs font-black text-primary">{dayHourLabel}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Choices spend journey time. Faster routes usually hit fuel, food, or condition harder.
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <Backpack className="h-3 w-3" /> Kit
                    </span>
                    <Link href="/inventory" className="text-[10px] font-bold uppercase text-primary hover:underline">
                      Inventory ({inventoryCount})
                    </Link>
                  </div>
                  {visibleInventoryItems.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {visibleInventoryItems.map((item) => (
                        <span
                          key={item.id}
                          className="rounded border border-border bg-card px-2 py-1 text-[10px] font-bold text-muted-foreground"
                          title={item.effect}
                        >
                          {item.name} x{item.qty}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">No special kit yet. Road events can change that.</p>
                  )}
                </div>
              </div>
            )}

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
                  <div className="p-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      The next moves are being argued over in the group chat. Pick an option there to keep the quest moving.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Action buttons ───────────────────────────────────────── */}
            <div className="space-y-2">
              {isSeries ? (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                    {activeTurnCopy.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {activeTurnCopy.detail}
                  </p>
                </div>
              ) : (
                <>
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
                </>
              )}
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
                    disabled={funds < offer.cost || (offer.action === "item" && !isSeries)}
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
                  onClick={() => {
                    setShowMechanic(false);
                    if (pendingAfterMechanic && isSeries) {
                      setPendingAfterMechanic(false);
                      setTurnPhase("advance");
                      setTab("chat");
                    }
                  }}
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
