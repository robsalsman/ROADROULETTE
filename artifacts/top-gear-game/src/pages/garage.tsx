import { Link } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Car, Gauge, MessageSquare, Paintbrush, RotateCcw, Settings2, Trophy, Wrench, Zap, BadgeDollarSign, GitCompare, ListFilter, LockKeyhole, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import VehicleSprite from "@/components/VehicleSprite";
import {
  loadGarage,
  loadUpgradeSpend,
  loadUpgrades,
  saveUpgrades as saveLocalUpgrades,
  type UpgradeCat,
  type UpgradeTier,
  type Upgrades,
} from "@/data/garage";
import { canonicalVehicleKey } from "@/data/vehicles";
import { DEFS, EFFECTS } from "@/pages/upgrade-shop";
import {
  garageApi,
  carToBuyInput,
  factoryGarageTuning,
  ownedToGarageCar,
  type GarageResponse,
  type OwnedVehicle,
} from "@/services/garageApi";
import { deriveVehiclePerformance, repairCostForVehicle, saleValueForVehicle, tuningProjection } from "@/data/vehiclePerformance";
import { finalDriveForGearing } from "@/data/gearing";
import {
  appendPresenterMessage,
  presenterTuningAdvice,
  recordVehicleService,
  saveTuningPreset,
  summarizeVehicleFile,
  tuningSlotIds,
  type PresenterName,
  type TuningSlotId,
} from "@/data/vehicleFiles";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { economyTierForVehicle, type EconomyTier } from "@workspace/economy";

const GARAGE_QUERY_KEY = ["garage"];
const MIGRATION_FLAG = "tgrr-persistent-garage-migrated-v1";
const NITROUS_SHOT_COST = 500;

const PAINT_SWATCHES = [
  "#ef4444",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#14532d",
  "#2563eb",
  "#7c3aed",
  "#e5e7eb",
  "#111827",
] as const;

type GarageSort = "active" | "power" | "value" | "condition" | "wins" | "name";
type GarageFilter = "all" | "active" | "upgraded" | "needs-work";

type ShowroomMission = {
  id: number;
  title: string;
};

type ShowroomCar = {
  id: number;
  missionId: number;
  missionTitle: string;
  name: string;
  year: number;
  price: number;
  reliability: number;
  power: number;
  offRoad: number;
  description: string;
};

function garageSaveIds(): number[] {
  const ids: number[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const match = key?.match(/^tgrr-garage-(\d+)$/);
    if (match) ids.push(Number(match[1]));
  }
  return ids.sort((a, b) => a - b);
}

function localGarageMigrationPayload() {
  const byCanonicalKey = new Map<string, ReturnType<typeof carToBuyInput>>();
  for (const saveId of garageSaveIds()) {
    const garage = loadGarage(saveId);
    for (const car of garage.cars) {
      const key = canonicalVehicleKey(car.name);
      if (byCanonicalKey.has(key)) continue;
      byCanonicalKey.set(key, carToBuyInput(car));
    }
  }
  return [...byCanonicalKey.values()];
}

function formatTime(ms: number): string {
  return `${(ms / 1000).toFixed(3)}s`;
}

function highestCompletedEpisode(): number {
  let highestCompleted = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith("tgrr-campaign-")) continue;
    try {
      const state = JSON.parse(localStorage.getItem(key) ?? "{}") as { completedEpisodes?: number[] };
      for (const episodeId of state.completedEpisodes ?? []) highestCompleted = Math.max(highestCompleted, episodeId);
    } catch { /* ignore */ }
  }
  return highestCompleted;
}

function showroomTier(car: ShowroomCar): EconomyTier {
  return economyTierForVehicle({
    name: car.name,
    reliability: car.reliability,
    power: car.power,
    offRoad: car.offRoad,
    episodeNumber: car.missionId,
  });
}

function isShowroomUnlocked(car: ShowroomCar, completedEpisode: number): boolean {
  return showroomTier(car) === "starter" || car.missionId <= completedEpisode;
}

async function fetchShowroomCars(): Promise<ShowroomCar[]> {
  const missionsResponse = await fetch("/api/missions");
  if (!missionsResponse.ok) throw new Error("Failed to load missions");
  const missions = await missionsResponse.json() as ShowroomMission[];
  const details = await Promise.all(
    missions.map(async (mission) => {
      const detailResponse = await fetch(`/api/missions/${mission.id}`);
      if (!detailResponse.ok) throw new Error("Failed to load mission detail");
      const detail = await detailResponse.json() as ShowroomMission & { availableCars?: Array<Omit<ShowroomCar, "missionId" | "missionTitle">> };
      return (detail.availableCars ?? []).map((car) => ({
        ...car,
        missionId: detail.id,
        missionTitle: detail.title,
      }));
    }),
  );
  return details.flat();
}

export default function Garage() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<GarageSort>("active");
  const [filterMode, setFilterMode] = useState<GarageFilter>("all");
  const [compareKeys, setCompareKeys] = useState<[string | null, string | null]>([null, null]);
  const [vehicleFileVersion, setVehicleFileVersion] = useState(0);

  const garageQuery = useQuery({
    queryKey: GARAGE_QUERY_KEY,
    queryFn: garageApi.getGarage,
  });

  const showroomQuery = useQuery({
    queryKey: ["garage-showroom"],
    queryFn: fetchShowroomCars,
  });

  const refreshGarage = async () => {
    await queryClient.invalidateQueries({ queryKey: GARAGE_QUERY_KEY });
  };

  const updateGarageCache = (garage: GarageResponse) => {
    queryClient.setQueryData(GARAGE_QUERY_KEY, garage);
  };

  useEffect(() => {
    if (localStorage.getItem(MIGRATION_FLAG)) return;
    const vehicles = localGarageMigrationPayload();
    localStorage.setItem(MIGRATION_FLAG, "1");
    if (vehicles.length === 0) return;
    garageApi.migrateGarage(vehicles)
      .then(() => refreshGarage())
      .then(() => toast({ title: "Garage migrated", description: `${vehicles.length} local vehicle${vehicles.length !== 1 ? "s" : ""} added to the persistent garage.` }))
      .catch(() => localStorage.removeItem(MIGRATION_FLAG));
  }, []);

  const patchMutation = useMutation({
    mutationFn: ({ key, paintColor }: { key: string; paintColor: string }) => garageApi.patchVehicle(key, { paintColor }),
    onSuccess: (data) => {
      updateGarageCache(data.garage);
      void refreshGarage();
    },
  });

  const activeMutation = useMutation({
    mutationFn: (key: string) => garageApi.setActive(key),
    onSuccess: (data) => {
      updateGarageCache(data.garage);
      void refreshGarage();
    },
  });

  const upgradeMutation = useMutation({
    mutationFn: ({ vehicle, upgrades, spent, creditsDelta }: { vehicle: OwnedVehicle; upgrades: Upgrades; spent: number; creditsDelta: number }) =>
      garageApi.saveUpgrades(vehicle.canonicalVehicleKey, upgrades, spent, creditsDelta),
    onSuccess: (data) => {
      updateGarageCache(data.garage);
      void refreshGarage();
    },
  });

  const tuningMutation = useMutation({
    mutationFn: ({ vehicle, tuning, creditsDelta }: { vehicle: OwnedVehicle; tuning: OwnedVehicle["tuning"]; creditsDelta: number }) =>
      garageApi.saveTuning(vehicle.canonicalVehicleKey, tuning, creditsDelta),
    onSuccess: (data) => {
      updateGarageCache(data.garage);
      void refreshGarage();
    },
  });

  const repairMutation = useMutation({
    mutationFn: (vehicle: OwnedVehicle) => garageApi.repairVehicle(vehicle.canonicalVehicleKey),
    onSuccess: (data) => {
      updateGarageCache(data.garage);
      void refreshGarage();
    },
  });

  const sellMutation = useMutation({
    mutationFn: (vehicle: OwnedVehicle) => garageApi.sellVehicle(vehicle.canonicalVehicleKey),
    onSuccess: (data) => {
      updateGarageCache(data.garage);
      void refreshGarage();
    },
  });

  const buyMutation = useMutation({
    mutationFn: (vehicle: ShowroomCar) => garageApi.buyVehicle(carToBuyInput(vehicle)),
    onSuccess: refreshGarage,
  });

  const garage = garageQuery.data;
  const vehicles = garage?.vehicles ?? [];
  const activeVehicle = vehicles.find((vehicle) => vehicle.isActive) ?? vehicles[0];
  const raceHistory = garage?.raceHistory ?? [];
  const completedEpisode = useMemo(() => highestCompletedEpisode(), []);
  const ownedKeys = useMemo(() => new Set(vehicles.map((vehicle) => vehicle.canonicalVehicleKey)), [vehicles]);
  const showroomCars = showroomQuery.data ?? [];

  const stats = useMemo(() => {
    const totalValue = vehicles.reduce((total, vehicle) => total + saleValueForVehicle(vehicle), 0);
    const upgradedCars = vehicles.filter((vehicle) => Object.keys(vehicle.upgrades).length > 0).length;
    const raceWins = raceHistory.filter((race) => race.won).length;
    return { totalValue, upgradedCars, raceWins };
  }, [raceHistory, vehicles]);

  const vehicleRows = useMemo(() => {
    return vehicles.map((vehicle) => {
      const garageCar = ownedToGarageCar(vehicle);
      const performance = deriveVehiclePerformance(vehicle, vehicle.upgrades);
      const projection = tuningProjection(performance, vehicle.tuning, vehicle.condition);
      const vehicleRaces = raceHistory.filter((race) => race.canonicalVehicleKey === vehicle.canonicalVehicleKey);
      const wins = vehicleRaces.filter((race) => race.won).length;
      const bestEt = vehicleRaces.length > 0 ? Math.min(...vehicleRaces.map((race) => race.elapsedMs)) : null;
      const saleValue = saleValueForVehicle(vehicle);
      const repairCost = repairCostForVehicle(vehicle);
      const vehicleFileSummary = summarizeVehicleFile(vehicle, raceHistory);
      return { vehicle, garageCar, performance, projection, vehicleFileSummary, races: vehicleRaces.length, wins, bestEt, saleValue, repairCost };
    });
  }, [raceHistory, vehicleFileVersion, vehicles]);

  const visibleRows = useMemo(() => {
    const filtered = vehicleRows.filter(({ vehicle }) => {
      if (filterMode === "active") return vehicle.isActive;
      if (filterMode === "upgraded") return Object.keys(vehicle.upgrades).length > 0;
      if (filterMode === "needs-work") return vehicle.condition < 85;
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (sortMode === "power") return b.performance.horsepower - a.performance.horsepower;
      if (sortMode === "value") return b.saleValue - a.saleValue;
      if (sortMode === "condition") return b.vehicle.condition - a.vehicle.condition;
      if (sortMode === "wins") return b.wins - a.wins;
      if (sortMode === "name") return `${a.vehicle.year} ${a.vehicle.name}`.localeCompare(`${b.vehicle.year} ${b.vehicle.name}`);
      return Number(b.vehicle.isActive) - Number(a.vehicle.isActive) || b.vehicle.updatedAt.localeCompare(a.vehicle.updatedAt);
    });
  }, [filterMode, sortMode, vehicleRows]);

  const comparisonRows = useMemo(() => {
    const firstKey = compareKeys[0] ?? activeVehicle?.canonicalVehicleKey ?? vehicles[0]?.canonicalVehicleKey ?? null;
    const secondKey = compareKeys[1] ?? vehicles.find((vehicle) => vehicle.canonicalVehicleKey !== firstKey)?.canonicalVehicleKey ?? null;
    return [firstKey, secondKey]
      .map((key) => vehicleRows.find((row) => row.vehicle.canonicalVehicleKey === key))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  }, [activeVehicle?.canonicalVehicleKey, compareKeys, vehicleRows, vehicles]);

  const repaintCar = async (vehicle: OwnedVehicle, paintColor: string) => {
    setWorking(`${vehicle.canonicalVehicleKey}-paint`);
    try {
      await patchMutation.mutateAsync({ key: vehicle.canonicalVehicleKey, paintColor });
    } catch {
      toast({ title: "Paint failed", variant: "destructive" });
    } finally {
      setWorking(null);
    }
  };

  const setActiveCar = async (vehicle: OwnedVehicle) => {
    setWorking(`${vehicle.canonicalVehicleKey}-active`);
    try {
      await activeMutation.mutateAsync(vehicle.canonicalVehicleKey);
      toast({ title: "Active vehicle selected", description: `${vehicle.year} ${vehicle.name} is staged for garage races.` });
    } catch {
      toast({ title: "Failed to select vehicle", variant: "destructive" });
    } finally {
      setWorking(null);
    }
  };

  const buyTier = async (vehicle: OwnedVehicle, cat: UpgradeCat, tier: UpgradeTier) => {
    const def = DEFS.find((item) => item.cat === cat);
    if (!def || !garage) return;
    const token = `${vehicle.canonicalVehicleKey}-${cat}-${tier}`;
    const currentTier = vehicle.upgrades[cat] ?? 0;
    const targetCost = def.tiers[tier - 1].cost;
    const previousCost = currentTier > 0 ? def.tiers[currentTier - 1].cost : 0;
    const diffCost = targetCost - previousCost;

    if (tier < currentTier) return;
    setWorking(token);
    try {
      if (currentTier === tier) {
        const nextUpgrades = { ...vehicle.upgrades };
        delete nextUpgrades[cat];
        const nextSpent = Math.max(0, vehicle.upgradeSpend - targetCost);
        await upgradeMutation.mutateAsync({ vehicle, upgrades: nextUpgrades, spent: nextSpent, creditsDelta: targetCost });
        if (vehicle.sourceCarId != null) saveLocalUpgrades(vehicle.sourceMissionId ?? "garage", vehicle.sourceCarId, nextUpgrades, nextSpent);
        recordVehicleService(vehicle.canonicalVehicleKey, { type: "upgrade", summary: `Removed ${def.label} tier ${tier}; GBP ${targetCost.toLocaleString()} returned.` });
        setVehicleFileVersion((version) => version + 1);
      } else {
        if (diffCost > garage.profile.credits) {
      toast({ title: "Not enough Garage GBP", variant: "destructive" });
          return;
        }
        const nextUpgrades = { ...vehicle.upgrades, [cat]: tier };
        const nextSpent = vehicle.upgradeSpend + diffCost;
        await upgradeMutation.mutateAsync({ vehicle, upgrades: nextUpgrades, spent: nextSpent, creditsDelta: -diffCost });
        if (vehicle.sourceCarId != null) saveLocalUpgrades(vehicle.sourceMissionId ?? "garage", vehicle.sourceCarId, nextUpgrades, nextSpent);
        recordVehicleService(vehicle.canonicalVehicleKey, { type: "upgrade", summary: `Installed ${def.label} ${def.tiers[tier - 1].name} for GBP ${diffCost.toLocaleString()}.` });
        setVehicleFileVersion((version) => version + 1);
      }
    } catch {
      toast({ title: "Upgrade failed", variant: "destructive" });
    } finally {
      setWorking(null);
    }
  };

  const buyNitrousShot = async (vehicle: OwnedVehicle) => {
    if (!garage) return;
    if ((vehicle.upgrades.nitrous ?? 0) <= 0) {
      toast({ title: "Nitrous kit required", description: "Install a nitrous kit before buying shots.", variant: "destructive" });
      return;
    }
    if (garage.profile.credits < NITROUS_SHOT_COST) {
      toast({ title: "Not enough Garage GBP", description: `A nitrous shot costs GBP ${NITROUS_SHOT_COST}.`, variant: "destructive" });
      return;
    }
    if ((vehicle.tuning.nitrousShots ?? 0) >= 12) {
      toast({ title: "Bottle full", description: "This car already has the maximum number of nitrous shots loaded." });
      return;
    }
    setWorking(`${vehicle.canonicalVehicleKey}-nitrous-shot`);
    try {
      await tuningMutation.mutateAsync({
        vehicle,
        tuning: { ...vehicle.tuning, nitrousShots: (vehicle.tuning.nitrousShots ?? 0) + 1 },
        creditsDelta: -NITROUS_SHOT_COST,
      });
      recordVehicleService(vehicle.canonicalVehicleKey, { type: "nitrous", summary: `Loaded one nitrous shot for GBP ${NITROUS_SHOT_COST.toLocaleString()}.` });
      setVehicleFileVersion((version) => version + 1);
      toast({ title: "Nitrous shot loaded", description: `${vehicle.name} now has ${(vehicle.tuning.nitrousShots ?? 0) + 1} shot(s).` });
    } catch {
      toast({ title: "Nitrous purchase failed", variant: "destructive" });
    } finally {
      setWorking(null);
    }
  };

  const saveGarageTuning = async (vehicle: OwnedVehicle, key: keyof OwnedVehicle["tuning"], value: number) => {
    const token = `${vehicle.canonicalVehicleKey}-tuning-${key}`;
    setWorking(token);
    try {
      await tuningMutation.mutateAsync({
        vehicle,
        tuning: { ...vehicle.tuning, [key]: value },
        creditsDelta: 0,
      });
    } catch {
      toast({ title: "Tuning not saved", variant: "destructive" });
    } finally {
      setWorking(null);
    }
  };

  const applyGarageTuning = async (vehicle: OwnedVehicle, tuning: OwnedVehicle["tuning"], summary: string) => {
    setWorking(`${vehicle.canonicalVehicleKey}-tuning-file`);
    try {
      await tuningMutation.mutateAsync({ vehicle, tuning, creditsDelta: 0 });
      recordVehicleService(vehicle.canonicalVehicleKey, { type: "tuning", summary });
      setVehicleFileVersion((version) => version + 1);
      toast({ title: "Tuning saved", description: summary });
    } catch {
      toast({ title: "Tuning not saved", variant: "destructive" });
    } finally {
      setWorking(null);
    }
  };

  const resetGarageTuning = async (vehicle: OwnedVehicle) => {
    await applyGarageTuning(vehicle, factoryGarageTuning(vehicle.tuning), "Reset garage tuning to factory settings.");
  };

  const saveGarageTuningSlot = (vehicle: OwnedVehicle, slot: TuningSlotId) => {
    saveTuningPreset(vehicle.canonicalVehicleKey, slot, vehicle.tuning);
    recordVehicleService(vehicle.canonicalVehicleKey, { type: "tuning", summary: `Saved garage tuning to ${slot.replace("-", " ")}.` });
    setVehicleFileVersion((version) => version + 1);
    toast({ title: "Tuning preset saved", description: `${vehicle.name} ${slot.replace("-", " ")} updated.` });
  };

  const loadGarageTuningSlot = async (vehicle: OwnedVehicle, slot: TuningSlotId) => {
    const preset = summarizeVehicleFile(vehicle, raceHistory).file.tuningPresets[slot];
    if (!preset) {
      toast({ title: "Empty tuning slot", description: `${slot.replace("-", " ")} has not been saved yet.` });
      return;
    }
    await applyGarageTuning(vehicle, { ...preset.tuning, nitrousShots: vehicle.tuning.nitrousShots }, `Loaded ${preset.name}; nitrous load preserved.`);
  };

  const askPresenterForAdvice = (vehicle: OwnedVehicle, presenter: PresenterName) => {
    const performance = deriveVehiclePerformance(vehicle, vehicle.upgrades);
    const projection = tuningProjection(performance, vehicle.tuning, vehicle.condition);
    const prompt = `Tuning advice for ${vehicle.year} ${vehicle.name}`;
    const response = presenterTuningAdvice(presenter, vehicle, projection);
    appendPresenterMessage(vehicle.canonicalVehicleKey, { presenter, prompt, response });
    recordVehicleService(vehicle.canonicalVehicleKey, { type: "tuning", summary: `Texted ${presenter} for tuning advice.` });
    setVehicleFileVersion((version) => version + 1);
    toast({ title: `${presenter} replied`, description: response });
  };

  const repairCar = async (vehicle: OwnedVehicle) => {
    const cost = repairCostForVehicle(vehicle);
    if (!garage || cost <= 0) return;
    if (cost > garage.profile.credits) {
      toast({ title: "Not enough Garage GBP", description: `Repair needs GBP ${cost}.`, variant: "destructive" });
      return;
    }
    setWorking(`${vehicle.canonicalVehicleKey}-repair`);
    try {
      await repairMutation.mutateAsync(vehicle);
      recordVehicleService(vehicle.canonicalVehicleKey, { type: "repair", summary: `Repaired vehicle to 100% condition for GBP ${cost.toLocaleString()}.` });
      setVehicleFileVersion((version) => version + 1);
      toast({ title: "Vehicle repaired", description: `${vehicle.year} ${vehicle.name} is back at 100% condition.` });
    } catch {
      toast({ title: "Repair failed", variant: "destructive" });
    } finally {
      setWorking(null);
    }
  };

  const sellCar = async (vehicle: OwnedVehicle) => {
    if (vehicles.length <= 1) {
      toast({ title: "Keep one vehicle", description: "The garage needs at least one car ready to go.", variant: "destructive" });
      return;
    }
    if (!window.confirm(`Sell ${vehicle.year} ${vehicle.name} for GBP ${saleValueForVehicle(vehicle)}?`)) return;
    setWorking(`${vehicle.canonicalVehicleKey}-sell`);
    try {
      await sellMutation.mutateAsync(vehicle);
      toast({ title: "Vehicle sold", description: `GBP ${saleValueForVehicle(vehicle)} added to your garage balance.` });
    } catch {
      toast({ title: "Sale failed", variant: "destructive" });
    } finally {
      setWorking(null);
    }
  };

  const buyShowroomCar = async (vehicle: ShowroomCar) => {
    if (!garage) return;
    const canonicalKey = canonicalVehicleKey(vehicle.name);
    if (!isShowroomUnlocked(vehicle, completedEpisode) || ownedKeys.has(canonicalKey) || garage.profile.credits < vehicle.price) return;
    setWorking(`buy-${canonicalKey}`);
    try {
      await buyMutation.mutateAsync(vehicle);
      recordVehicleService(canonicalKey, { type: "acquired", summary: `Purchased ${vehicle.year} ${vehicle.name} for GBP ${vehicle.price.toLocaleString()}.` });
      setVehicleFileVersion((version) => version + 1);
      toast({ title: "Vehicle purchased", description: `${vehicle.year} ${vehicle.name} added to your garage.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Purchase failed";
      toast({ title: "Purchase failed", description: message, variant: "destructive" });
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className="flex-1 px-4 pb-6 pt-24 md:p-12">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary">
              <Car className="h-6 w-6" />
              <h2 className="text-3xl font-bold uppercase tracking-wide">Garage</h2>
            </div>
            <p className="text-muted-foreground">
              Persistent profile garage, Garage GBP, upgrades, tuning, and race history.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeVehicle && (
              <Link href={`/drag-race?mode=board&vehicle=${encodeURIComponent(activeVehicle.canonicalVehicleKey)}`}>
                <Button className="uppercase font-bold" data-testid="button-drag-race">
                  <Zap className="mr-2 h-4 w-4" /> Drag Race
                </Button>
              </Link>
            )}
            <Link href="/">
              <Button variant="outline" className="uppercase" data-testid="button-garage-back">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            </Link>
          </div>
        </div>

        {garageQuery.isLoading ? (
          <div className="rounded-md border border-border bg-card p-8 text-muted-foreground">Loading garage...</div>
        ) : !garage ? (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-10 text-center">
            <p className="mb-4 text-lg font-bold uppercase">Garage unavailable</p>
            <p className="mx-auto max-w-xl text-muted-foreground">
              The persistent garage did not load. Refresh and try again.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                ["Garage GBP", `GBP ${garage.profile.credits.toLocaleString()}`],
                ["Cars", vehicles.length.toLocaleString()],
                ["Upgraded", stats.upgradedCars.toLocaleString()],
                ["Wins", stats.raceWins.toLocaleString()],
                ["Garage Value", `GBP ${stats.totalValue.toLocaleString()}`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-border bg-card p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="mt-1 font-mono text-xl font-black">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 rounded-md border border-border bg-card p-4 lg:grid-cols-[1fr_1.4fr]">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ListFilter className="h-5 w-5 text-primary" />
                  <h3 className="font-black uppercase">Garage Controls</h3>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-black uppercase text-muted-foreground">
                    Sort
                    <select
                      value={sortMode}
                      onChange={(event) => setSortMode(event.target.value as GarageSort)}
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-bold text-foreground"
                      data-testid="select-garage-sort"
                    >
                      <option value="active">Active first</option>
                      <option value="power">Horsepower</option>
                      <option value="value">Resale value</option>
                      <option value="condition">Condition</option>
                      <option value="wins">Race wins</option>
                      <option value="name">Name</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-xs font-black uppercase text-muted-foreground">
                    Filter
                    <select
                      value={filterMode}
                      onChange={(event) => setFilterMode(event.target.value as GarageFilter)}
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-bold text-foreground"
                      data-testid="select-garage-filter"
                    >
                      <option value="all">All vehicles</option>
                      <option value="active">Active vehicle</option>
                      <option value="upgraded">Upgraded</option>
                      <option value="needs-work">Needs work</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <GitCompare className="h-5 w-5 text-primary" />
                  <h3 className="font-black uppercase">Compare</h3>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[0, 1].map((index) => (
                    <select
                      key={index}
                      value={comparisonRows[index]?.vehicle.canonicalVehicleKey ?? ""}
                      onChange={(event) => {
                        const next: [string | null, string | null] = [...compareKeys];
                        next[index] = event.target.value || null;
                        setCompareKeys(next);
                      }}
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-bold"
                      data-testid={`select-compare-${index + 1}`}
                    >
                      {vehicles.map((vehicle) => (
                        <option key={vehicle.canonicalVehicleKey} value={vehicle.canonicalVehicleKey}>
                          {vehicle.year} {vehicle.name}
                        </option>
                      ))}
                    </select>
                  ))}
                </div>
                {comparisonRows.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {comparisonRows.map((row) => (
                      <div key={row.vehicle.canonicalVehicleKey} className="rounded-md border border-border bg-muted/20 p-2">
                        <p className="truncate font-black uppercase">{row.vehicle.year} {row.vehicle.name}</p>
                        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono">
                          <span>HP {row.performance.horsepower}</span>
                          <span>{row.performance.drivetrain}</span>
                          <span>{row.projection.topSpeedMph} mph</span>
                          <span>{row.projection.zeroToSixty.toFixed(1)}s 0-60</span>
                          <span>GBP {row.saleValue}</span>
                          <span>{row.vehicle.condition}%</span>
                          <span>{row.wins}/{row.races} wins</span>
                          <span>{row.bestEt ? formatTime(row.bestEt) : "no ET"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {vehicles.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-muted/20 p-8">
                <p className="text-lg font-black uppercase">Choose a starter car</p>
                <p className="mt-2 max-w-2xl text-muted-foreground">
                  Your garage is empty. Buy an unlocked starter from the showroom below before entering drag races.
                  Episode and elite cars unlock after career progress, so the first run starts grounded.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {visibleRows.map(({ vehicle, garageCar, performance, projection, vehicleFileSummary, races, wins, bestEt, saleValue, repairCost }) => {
                const key = vehicle.canonicalVehicleKey;
                const isExpanded = expanded === key;
                const finalDrive = finalDriveForGearing(vehicle.tuning.gearing);

                return (
                  <Card key={key} className={cn("flex flex-col border-2", vehicle.isActive ? "border-primary" : "border-transparent")}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="uppercase">{vehicle.year} {vehicle.name}</CardTitle>
                          <p className="text-xs text-muted-foreground">Garage key: {vehicle.canonicalVehicleKey}</p>
                        </div>
                        {vehicle.isActive && <span className="rounded bg-primary/20 px-2 py-1 text-xs font-black uppercase text-primary">Active</span>}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-4">
                      <VehicleSprite vehicle={garageCar} className="h-32 w-full" />
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {[
                          ["Reliability", performance.reliabilityRating],
                          ["Power", performance.powerRating],
                          ["Handling", performance.handlingRating],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-md border border-border bg-muted/30 p-2">
                            <p className="font-bold uppercase text-muted-foreground">{label}</p>
                            <p className="font-mono text-lg font-black">{value}/100</p>
                            <Progress value={Number(value)} className="h-1.5" />
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-md border border-border bg-muted/20 p-2">
                          <p className="font-bold uppercase text-muted-foreground">Condition</p>
                          <p className="font-mono text-lg font-black">{vehicle.condition}%</p>
                          <Progress value={vehicle.condition} className="h-1.5" />
                        </div>
                        <div className="rounded-md border border-border bg-muted/20 p-2">
                          <p className="font-bold uppercase text-muted-foreground">Upgrade Spend</p>
                          <p className="font-mono text-lg font-black">GBP {vehicle.upgradeSpend}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-md border border-border bg-muted/20 p-2">
                          <p className="font-bold uppercase text-muted-foreground">Record</p>
                          <p className="font-mono text-sm font-black">{wins}/{races}</p>
                        </div>
                        <div className="rounded-md border border-border bg-muted/20 p-2">
                          <p className="font-bold uppercase text-muted-foreground">Best ET</p>
                          <p className="font-mono text-sm font-black">{bestEt ? formatTime(bestEt) : "None"}</p>
                        </div>
                        <div className="rounded-md border border-border bg-muted/20 p-2">
                          <p className="font-bold uppercase text-muted-foreground">Active</p>
                          <p className="font-mono text-sm font-black">{vehicle.isActive ? "Yes" : "No"}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
                        {[
                          ["HP", performance.horsepower.toLocaleString()],
                          ["Weight", `${performance.weight.toLocaleString()} lb`],
                          ["Drive", performance.drivetrain],
                          ["Tier", performance.tier],
                          ["Grip", performance.handlingRating.toString()],
                          ["Resale", `GBP ${saleValue}`],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-md border border-border bg-muted/20 p-2">
                            <p className="font-bold uppercase text-muted-foreground">{label}</p>
                            <p className="font-mono text-sm font-black">{value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
                        {[
                          ["Top Speed", `${projection.topSpeedMph} mph`],
                          ["Wheel HP", `${projection.wheelHorsepower.toLocaleString()} whp`],
                          ["Torque", `${projection.torqueLbFt.toLocaleString()} lb-ft`],
                          ["0-60", `${projection.zeroToSixty.toFixed(1)}s`],
                          ["1/4 Mile", `${projection.quarterMile.toFixed(1)}s`],
                          ["Launch Grip", `${projection.launchGrip}%`],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-md border border-border bg-muted/20 p-2">
                            <p className="font-bold uppercase text-muted-foreground">{label}</p>
                            <p className="font-mono text-sm font-black">{value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <Paintbrush className="h-4 w-4 text-muted-foreground" />
                        <div className="flex flex-wrap gap-1.5">
                          {PAINT_SWATCHES.map((paint) => (
                            <button
                              key={paint}
                              type="button"
                              aria-label={`Paint ${vehicle.name} ${paint}`}
                              className={cn(
                                "h-6 w-6 rounded-full border-2",
                                vehicle.paintColor === paint ? "border-primary" : "border-white/30",
                              )}
                              style={{ backgroundColor: paint }}
                              disabled={working === `${vehicle.canonicalVehicleKey}-paint`}
                              onClick={() => repaintCar(vehicle, paint)}
                            />
                          ))}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
                          <div className="rounded-md border border-cyan-500/30 bg-cyan-500/10 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-xs font-black uppercase text-cyan-200">Nitrous Bottle</p>
                                <p className="text-sm font-bold">{vehicle.tuning.nitrousShots ?? 0}/12 shots loaded</p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="uppercase font-bold"
                                disabled={(vehicle.upgrades.nitrous ?? 0) <= 0 || (vehicle.tuning.nitrousShots ?? 0) >= 12 || garage.profile.credits < NITROUS_SHOT_COST || working === `${vehicle.canonicalVehicleKey}-nitrous-shot`}
                                onClick={() => buyNitrousShot(vehicle)}
                              >
                                Buy Shot GBP {NITROUS_SHOT_COST}
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-3 rounded-md border border-border bg-background/40 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-xs font-black uppercase text-primary">Garage Tuning</p>
                                <p className="text-xs text-muted-foreground">Saved to this car and used on the drag strip.</p>
                              </div>
                              <span className="rounded border border-border bg-muted/30 px-2 py-1 text-[11px] font-black uppercase text-muted-foreground">
                                {projection.gearingBias}
                              </span>
                            </div>
                            <div className="grid gap-2 rounded-md border border-border bg-muted/20 p-2 text-xs md:grid-cols-[1fr_auto]">
                              <div>
                                <p className="font-black uppercase text-muted-foreground">Final Drive</p>
                                <p className="font-mono font-black">{finalDrive.label}</p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="uppercase font-black"
                                disabled={working === `${vehicle.canonicalVehicleKey}-tuning-file`}
                                onClick={() => resetGarageTuning(vehicle)}
                              >
                                <RotateCcw className="mr-2 h-3.5 w-3.5" /> Factory
                              </Button>
                            </div>
                            <div className="space-y-2 rounded-md border border-border bg-muted/20 p-2">
                              <p className="text-[11px] font-black uppercase text-muted-foreground">Tuning Slots</p>
                              {tuningSlotIds().map((slot) => {
                                const preset = vehicleFileSummary.file.tuningPresets[slot];
                                return (
                                  <div key={slot} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                                    <span className="min-w-0 truncate text-xs font-black uppercase text-muted-foreground">
                                      {preset ? `${preset.name} - ${finalDriveForGearing(preset.tuning.gearing).label}` : `${slot.replace("-", " ")} - Empty`}
                                    </span>
                                    <Button size="sm" variant="outline" className="h-8 px-2 text-[10px] uppercase" onClick={() => saveGarageTuningSlot(vehicle, slot)}>
                                      Save
                                    </Button>
                                    <Button size="sm" variant="outline" className="h-8 px-2 text-[10px] uppercase" disabled={!preset} onClick={() => loadGarageTuningSlot(vehicle, slot)}>
                                      Load
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px] md:grid-cols-3">
                              {[
                                ["Top Speed", `${projection.topSpeedMph} mph`],
                                ["Wheel HP", `${projection.wheelHorsepower.toLocaleString()} whp`],
                                ["Torque", `${projection.torqueLbFt.toLocaleString()} lb-ft`],
                                ["0-60", `${projection.zeroToSixty.toFixed(1)}s`],
                                ["1/4 Mile", `${projection.quarterMile.toFixed(1)}s`],
                                ["Launch Grip", `${projection.launchGrip}%`],
                              ].map(([label, value]) => (
                                <div key={label} className="rounded-md border border-border bg-muted/20 p-2">
                                  <p className="font-black uppercase text-muted-foreground">{label}</p>
                                  <p className="font-mono text-sm font-black">{value}</p>
                                </div>
                              ))}
                            </div>
                            {[
                              ["launchRpm", "Launch RPM", 2500, 7200],
                              ["shiftRpm", "Shift RPM", 3500, 8500],
                              ["gearing", "Gearing", 0, 100],
                              ["suspension", "Suspension", 0, 100],
                              ["downforce", "Downforce", 0, 100],
                              ["tirePressure", "Tire PSI", 18, 48],
                            ].map(([tuningKey, label, min, max]) => {
                              const keyName = tuningKey as keyof OwnedVehicle["tuning"];
                              const currentValue = vehicle.tuning[keyName];
                              const token = `${vehicle.canonicalVehicleKey}-tuning-${keyName}`;
                              return (
                                <label key={keyName} className="block space-y-1">
                                  <div className="flex justify-between text-xs font-black uppercase">
                                    <span>{label}</span>
                                    <span>{currentValue}</span>
                                  </div>
                                  <input
                                    type="range"
                                    min={min as number}
                                    max={max as number}
                                    value={currentValue}
                                    className="w-full accent-amber-500"
                                    disabled={working === token}
                                    onChange={(event) => saveGarageTuning(vehicle, keyName, Number(event.target.value))}
                                  />
                                </label>
                              );
                            })}
                            <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
                              <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-200">
                                <MessageSquare className="h-4 w-4" /> Presenter Advice
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                {(["Jeremy", "Richard", "James"] as PresenterName[]).map((presenter) => (
                                  <Button key={presenter} size="sm" variant="outline" className="uppercase" onClick={() => askPresenterForAdvice(vehicle, presenter)}>
                                    {presenter}
                                  </Button>
                                ))}
                              </div>
                              {vehicleFileSummary.file.presenterMessages[0] && (
                                <div className="rounded border border-amber-500/30 bg-background/50 p-2 text-sm">
                                  <p className="mb-1 text-xs font-black uppercase text-amber-200">{vehicleFileSummary.file.presenterMessages[0].presenter}</p>
                                  <p className="text-muted-foreground">{vehicleFileSummary.file.presenterMessages[0].response}</p>
                                </div>
                              )}
                            </div>
                            <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
                              <p className="text-xs font-black uppercase text-primary">Vehicle File</p>
                              <div className="grid grid-cols-2 gap-2 text-[11px] md:grid-cols-4">
                                {[
                                  ["Record", `${vehicleFileSummary.wins}/${vehicleFileSummary.races}`],
                                  ["Best Trap", vehicleFileSummary.bestTrapMph == null ? "--" : `${vehicleFileSummary.bestTrapMph} mph`],
                                  ["Winnings", `GBP ${vehicleFileSummary.winnings.toLocaleString()}`],
                                  ["Services", vehicleFileSummary.file.serviceRecords.length.toString()],
                                ].map(([label, value]) => (
                                  <div key={label} className="rounded border border-border bg-background/40 p-2">
                                    <p className="font-black uppercase text-muted-foreground">{label}</p>
                                    <p className="font-mono font-black">{value}</p>
                                  </div>
                                ))}
                              </div>
                              <div className="space-y-1">
                                {vehicleFileSummary.file.serviceRecords.slice(0, 4).map((record) => (
                                  <p key={record.id} className="rounded border border-border bg-background/30 p-2 text-xs text-muted-foreground">
                                    <span className="font-black uppercase text-foreground">{record.type}</span> - {record.summary}
                                  </p>
                                ))}
                              </div>
                            </div>
                          </div>
                          {DEFS.map((def) => {
                            const currentTier = vehicle.upgrades[def.cat] ?? 0;
                            return (
                              <div key={def.cat} className="space-y-2">
                                <div className="flex items-center gap-2 text-xs font-black uppercase">
                                  {def.icon}
                                  <span>{def.label}</span>
                                  {currentTier > 0 && <span className="ml-auto text-primary">Tier {currentTier}</span>}
                                </div>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                                  {def.tiers.map((tier, idx) => {
                                    const tierNum = (idx + 1) as UpgradeTier;
                                    const previousCost = currentTier > 0 ? def.tiers[currentTier - 1].cost : 0;
                                    const diffCost = tier.cost - previousCost;
                                    const owned = currentTier === tierNum;
                                    const locked = tierNum < currentTier;
                                    const affordable = owned || diffCost <= garage.profile.credits;
                                    const previewUpgrades = owned ? vehicle.upgrades : { ...vehicle.upgrades, [def.cat]: tierNum };
                                    const previewPerformance = deriveVehiclePerformance(vehicle, previewUpgrades);
                                    return (
                                      <button
                                        key={tier.name}
                                        type="button"
                                        disabled={locked || !affordable || working === `${vehicle.canonicalVehicleKey}-${def.cat}-${tierNum}`}
                                        onClick={() => buyTier(vehicle, def.cat, tierNum)}
                                        className={cn(
                                          "rounded-md border px-2 py-2 text-left text-[11px] transition-colors",
                                          owned
                                            ? "border-primary bg-primary/10 text-primary"
                                            : locked || !affordable
                                              ? "border-border text-muted-foreground opacity-45"
                                              : "border-border hover:border-primary hover:bg-primary/5",
                                        )}
                                      >
                                        <span className="block font-black uppercase">{tier.name}</span>
                                        <span className="block text-muted-foreground">{EFFECTS[def.cat][idx]}</span>
                                        <span className="block text-muted-foreground">HP {previewPerformance.horsepower} / Grip {previewPerformance.traction.toFixed(1)}</span>
                                        <span className="block font-mono font-bold">
                                          {owned ? "Sell" : locked ? "Installed below" : `GBP ${currentTier > 0 ? diffCost : tier.cost}`}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex-wrap gap-2">
                      <Button
                        variant={isExpanded ? "secondary" : "outline"}
                        className="flex-1 uppercase font-bold"
                        onClick={() => setExpanded(isExpanded ? null : key)}
                      >
                        <Wrench className="mr-2 h-4 w-4" /> Manage
                      </Button>
                      <Button
                        className="flex-1 uppercase font-bold"
                        disabled={vehicle.isActive || working === `${vehicle.canonicalVehicleKey}-active`}
                        onClick={() => setActiveCar(vehicle)}
                      >
                        <Settings2 className="mr-2 h-4 w-4" /> Select
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 uppercase font-bold"
                        disabled={repairCost <= 0 || working === `${vehicle.canonicalVehicleKey}-repair`}
                        onClick={() => repairCar(vehicle)}
                        data-testid={`button-repair-${key}`}
                      >
                        <Wrench className="mr-2 h-4 w-4" /> {repairCost > 0 ? `Repair GBP ${repairCost}` : "Repaired"}
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 uppercase font-bold"
                        disabled={vehicles.length <= 1 || working === `${vehicle.canonicalVehicleKey}-sell`}
                        onClick={() => sellCar(vehicle)}
                        data-testid={`button-sell-${key}`}
                      >
                        <BadgeDollarSign className="mr-2 h-4 w-4" /> Sell GBP {saleValue}
                      </Button>
                      <Link href={`/drag-race?mode=board&vehicle=${encodeURIComponent(vehicle.canonicalVehicleKey)}`}>
                        <Button variant="outline" className="flex-1 uppercase font-bold" aria-label={`Drag race ${vehicle.name}`}>
                          <Gauge className="mr-2 h-4 w-4" /> Drag Race
                        </Button>
                      </Link>
                    </CardFooter>
                  </Card>
                );
              })}
              </div>
            )}

            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                <div>
                  <div className="flex items-center gap-2 text-primary">
                    <ShoppingCart className="h-5 w-5" />
                    <h3 className="text-2xl font-black uppercase tracking-tight">Vehicle Showroom</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Campaign cars appear here before you own them. Future episode cars stay locked until reached.</p>
                </div>
                <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs font-black uppercase text-muted-foreground">
                  Starter cars now - completed through episode {completedEpisode}
                </div>
              </div>

              {showroomQuery.isLoading ? (
                <div className="rounded-md border border-border bg-card p-6 text-muted-foreground">Loading showroom...</div>
              ) : showroomCars.length === 0 ? (
                <div className="rounded-md border border-border bg-card p-6 text-muted-foreground">No showroom cars available.</div>
              ) : (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {showroomCars.map((car) => {
                    const canonicalKey = canonicalVehicleKey(car.name);
                    const owned = ownedKeys.has(canonicalKey);
                    const tier = showroomTier(car);
                    const locked = !isShowroomUnlocked(car, completedEpisode);
                    const affordable = Boolean(garage) && garage.profile.credits >= car.price;
                    const disabled = owned || locked || !affordable || working === `buy-${canonicalKey}`;
                    return (
                      <Card key={`${car.missionId}-${car.id}-${canonicalKey}`} className={cn("flex flex-col", locked && "opacity-70")}>
                        <CardHeader>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <CardTitle className="uppercase">{car.year} {car.name}</CardTitle>
                              <p className="text-xs text-muted-foreground">{car.missionTitle}</p>
                            </div>
                            {locked ? (
                              <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs font-black uppercase text-muted-foreground">
                                <LockKeyhole className="h-3 w-3" /> Locked
                              </span>
                            ) : owned ? (
                              <span className="rounded bg-primary/20 px-2 py-1 text-xs font-black uppercase text-primary">Owned</span>
                            ) : (
                              <span className="rounded bg-amber-500/20 px-2 py-1 text-xs font-black uppercase text-amber-200">{tier}</span>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="flex-1 space-y-4">
                          <VehicleSprite vehicle={car} className="h-28 w-full" />
                          <p className="min-h-[3rem] text-sm text-muted-foreground">{car.description}</p>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            {[
                              ["Reliability", car.reliability],
                              ["Power", car.power],
                              ["Off-road", car.offRoad],
                            ].map(([label, value]) => (
                              <div key={label} className="rounded-md border border-border bg-muted/30 p-2">
                                <p className="font-bold uppercase text-muted-foreground">{label}</p>
                                <p className="font-mono text-lg font-black">{Number(value) * 10}/100</p>
                              </div>
                            ))}
                          </div>
                          <div className="rounded-md border border-border bg-muted/20 p-3">
                            <p className="text-xs font-black uppercase text-muted-foreground">Price</p>
                            <p className="font-mono text-xl font-black">GBP {car.price.toLocaleString()}</p>
                          </div>
                        </CardContent>
                        <CardFooter>
                          <Button
                            className="w-full uppercase font-bold"
                            disabled={disabled}
                            onClick={() => buyShowroomCar(car)}
                            data-testid={`button-showroom-buy-${canonicalKey}`}
                          >
                            {owned ? "Owned" : locked ? `Complete Episode ${car.missionId}` : !affordable ? "Not Enough Garage GBP" : "Buy Car"}
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {garage.raceHistory.length > 0 && (
              <div className="rounded-md border border-border bg-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  <h3 className="font-black uppercase">Race History</h3>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {garage.raceHistory.slice(0, 6).map((race) => (
                    <div key={race.id} className="rounded-md border border-border bg-muted/20 p-3 text-sm">
                      <div className="flex justify-between gap-3 font-bold">
                        <span>{race.opponentName}</span>
                        <span className={race.won ? "text-green-400" : "text-red-400"}>{race.won ? "Won" : "Lost"}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        ET {formatTime(race.elapsedMs)} vs {formatTime(race.opponentElapsedMs)} · {race.trapSpeed} mph · GBP +{race.rewardCredits}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
