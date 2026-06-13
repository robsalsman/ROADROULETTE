import { Link } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Car, Gauge, Paintbrush, Settings2, Trophy, Wrench, Zap, BadgeDollarSign, GitCompare, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import VehicleSprite from "@/components/VehicleSprite";
import {
  adjustedCarStats,
  loadGarage,
  loadUpgradeSpend,
  loadUpgrades,
  saveUpgrades as saveLocalUpgrades,
  type UpgradeCat,
  type Upgrades,
} from "@/data/garage";
import { canonicalVehicleKey } from "@/data/vehicles";
import { DEFS, EFFECTS } from "@/pages/upgrade-shop";
import {
  garageApi,
  carToBuyInput,
  ownedToGarageCar,
  type GarageResponse,
  type OwnedVehicle,
} from "@/services/garageApi";
import { deriveVehiclePerformance, repairCostForVehicle, saleValueForVehicle } from "@/data/vehiclePerformance";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const GARAGE_QUERY_KEY = ["garage"];
const MIGRATION_FLAG = "tgrr-persistent-garage-migrated-v1";

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

export default function Garage() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<GarageSort>("active");
  const [filterMode, setFilterMode] = useState<GarageFilter>("all");
  const [compareKeys, setCompareKeys] = useState<[string | null, string | null]>([null, null]);

  const garageQuery = useQuery({
    queryKey: GARAGE_QUERY_KEY,
    queryFn: garageApi.getGarage,
  });

  const refreshGarage = async () => {
    await queryClient.invalidateQueries({ queryKey: GARAGE_QUERY_KEY });
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
    onSuccess: refreshGarage,
  });

  const activeMutation = useMutation({
    mutationFn: (key: string) => garageApi.setActive(key),
    onSuccess: refreshGarage,
  });

  const upgradeMutation = useMutation({
    mutationFn: ({ vehicle, upgrades, spent, creditsDelta }: { vehicle: OwnedVehicle; upgrades: Upgrades; spent: number; creditsDelta: number }) =>
      garageApi.saveUpgrades(vehicle.canonicalVehicleKey, upgrades, spent, creditsDelta),
    onSuccess: refreshGarage,
  });

  const repairMutation = useMutation({
    mutationFn: (vehicle: OwnedVehicle) => garageApi.repairVehicle(vehicle.canonicalVehicleKey),
    onSuccess: refreshGarage,
  });

  const sellMutation = useMutation({
    mutationFn: (vehicle: OwnedVehicle) => garageApi.sellVehicle(vehicle.canonicalVehicleKey),
    onSuccess: refreshGarage,
  });

  const garage = garageQuery.data;
  const vehicles = garage?.vehicles ?? [];
  const activeVehicle = vehicles.find((vehicle) => vehicle.isActive) ?? vehicles[0];
  const raceHistory = garage?.raceHistory ?? [];

  const stats = useMemo(() => {
    const totalValue = vehicles.reduce((total, vehicle) => total + Math.max(50, Math.floor(vehicle.purchasePrice * 0.65 + vehicle.upgradeSpend * 0.35)), 0);
    const upgradedCars = vehicles.filter((vehicle) => Object.keys(vehicle.upgrades).length > 0).length;
    const raceWins = raceHistory.filter((race) => race.won).length;
    return { totalValue, upgradedCars, raceWins };
  }, [raceHistory, vehicles]);

  const vehicleRows = useMemo(() => {
    return vehicles.map((vehicle) => {
      const garageCar = ownedToGarageCar(vehicle);
      const adjusted = adjustedCarStats(garageCar, vehicle.upgrades);
      const performance = deriveVehiclePerformance(vehicle, vehicle.upgrades);
      const vehicleRaces = raceHistory.filter((race) => race.canonicalVehicleKey === vehicle.canonicalVehicleKey);
      const wins = vehicleRaces.filter((race) => race.won).length;
      const bestEt = vehicleRaces.length > 0 ? Math.min(...vehicleRaces.map((race) => race.elapsedMs)) : null;
      const saleValue = saleValueForVehicle(vehicle);
      const repairCost = repairCostForVehicle(vehicle);
      return { vehicle, garageCar, adjusted, performance, races: vehicleRaces.length, wins, bestEt, saleValue, repairCost };
    });
  }, [raceHistory, vehicles]);

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

  const buyTier = async (vehicle: OwnedVehicle, cat: UpgradeCat, tier: 1 | 2 | 3) => {
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
      } else {
        if (diffCost > garage.profile.credits) {
          toast({ title: "Not enough credits", variant: "destructive" });
          return;
        }
        const nextUpgrades = { ...vehicle.upgrades, [cat]: tier };
        const nextSpent = vehicle.upgradeSpend + diffCost;
        await upgradeMutation.mutateAsync({ vehicle, upgrades: nextUpgrades, spent: nextSpent, creditsDelta: -diffCost });
        if (vehicle.sourceCarId != null) saveLocalUpgrades(vehicle.sourceMissionId ?? "garage", vehicle.sourceCarId, nextUpgrades, nextSpent);
      }
    } catch {
      toast({ title: "Upgrade failed", variant: "destructive" });
    } finally {
      setWorking(null);
    }
  };

  const repairCar = async (vehicle: OwnedVehicle) => {
    const cost = repairCostForVehicle(vehicle);
    if (!garage || cost <= 0) return;
    if (cost > garage.profile.credits) {
      toast({ title: "Not enough credits", description: `Repair needs CR ${cost}.`, variant: "destructive" });
      return;
    }
    setWorking(`${vehicle.canonicalVehicleKey}-repair`);
    try {
      await repairMutation.mutateAsync(vehicle);
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
    if (!window.confirm(`Sell ${vehicle.year} ${vehicle.name} for CR ${saleValueForVehicle(vehicle)}?`)) return;
    setWorking(`${vehicle.canonicalVehicleKey}-sell`);
    try {
      await sellMutation.mutateAsync(vehicle);
      toast({ title: "Vehicle sold", description: `CR ${saleValueForVehicle(vehicle)} added to your profile.` });
    } catch {
      toast({ title: "Sale failed", variant: "destructive" });
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className="flex-1 p-6 md:p-12">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary">
              <Car className="h-6 w-6" />
              <h2 className="text-3xl font-bold uppercase tracking-wide">Garage</h2>
            </div>
            <p className="text-muted-foreground">
              Persistent profile garage, credits, upgrades, tuning, and race history.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeVehicle && (
              <Link href={`/drag-race?vehicle=${encodeURIComponent(activeVehicle.canonicalVehicleKey)}`}>
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
        ) : !garage || vehicles.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-10 text-center">
            <p className="mb-4 text-lg font-bold uppercase">No garage cars yet</p>
            <p className="mx-auto mb-6 max-w-xl text-muted-foreground">
              Buy cars in Series Mode or Arcade Mode. They will appear here as one persistent collection.
            </p>
            <Link href="/series-start">
              <Button className="uppercase font-bold">Start Series Mode</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                ["Credits", `CR ${garage.profile.credits.toLocaleString()}`],
                ["Cars", vehicles.length.toLocaleString()],
                ["Upgraded", stats.upgradedCars.toLocaleString()],
                ["Wins", stats.raceWins.toLocaleString()],
                ["Garage Value", `CR ${stats.totalValue.toLocaleString()}`],
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
                          <span>CR {row.saleValue}</span>
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

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {visibleRows.map(({ vehicle, garageCar, adjusted, performance, races, wins, bestEt, saleValue, repairCost }) => {
                const key = vehicle.canonicalVehicleKey;
                const isExpanded = expanded === key;

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
                          ["Reliability", adjusted.reliability],
                          ["Power", adjusted.power],
                          ["Off-road", adjusted.offRoad],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-md border border-border bg-muted/30 p-2">
                            <p className="font-bold uppercase text-muted-foreground">{label}</p>
                            <p className="font-mono text-lg font-black">{value}/10</p>
                            <Progress value={Number(value) * 10} className="h-1.5" />
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
                          <p className="font-mono text-lg font-black">CR {vehicle.upgradeSpend}</p>
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
                          ["Traction", performance.traction.toFixed(1)],
                          ["Resale", `CR ${saleValue}`],
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
                          {DEFS.map((def) => {
                            const currentTier = vehicle.upgrades[def.cat] ?? 0;
                            return (
                              <div key={def.cat} className="space-y-2">
                                <div className="flex items-center gap-2 text-xs font-black uppercase">
                                  {def.icon}
                                  <span>{def.label}</span>
                                  {currentTier > 0 && <span className="ml-auto text-primary">Tier {currentTier}</span>}
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  {def.tiers.map((tier, idx) => {
                                    const tierNum = (idx + 1) as 1 | 2 | 3;
                                    const previousCost = currentTier > 0 ? def.tiers[currentTier - 1].cost : 0;
                                    const diffCost = tier.cost - previousCost;
                                    const owned = currentTier === tierNum;
                                    const locked = tierNum < currentTier;
                                    const affordable = owned || diffCost <= garage.profile.credits;
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
                                        <span className="block font-mono font-bold">
                                          {owned ? "Sell" : `CR ${currentTier > 0 ? diffCost : tier.cost}`}
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
                        <Wrench className="mr-2 h-4 w-4" /> {repairCost > 0 ? `Repair CR ${repairCost}` : "Repaired"}
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 uppercase font-bold"
                        disabled={vehicles.length <= 1 || working === `${vehicle.canonicalVehicleKey}-sell`}
                        onClick={() => sellCar(vehicle)}
                        data-testid={`button-sell-${key}`}
                      >
                        <BadgeDollarSign className="mr-2 h-4 w-4" /> Sell CR {saleValue}
                      </Button>
                      <Link href={`/drag-race?vehicle=${encodeURIComponent(vehicle.canonicalVehicleKey)}`}>
                        <Button variant="outline" size="icon" aria-label={`Drag race ${vehicle.name}`}>
                          <Gauge className="h-4 w-4" />
                        </Button>
                      </Link>
                    </CardFooter>
                  </Card>
                );
              })}
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
                        ET {formatTime(race.elapsedMs)} vs {formatTime(race.opponentElapsedMs)} · {race.trapSpeed} mph · CR +{race.rewardCredits}
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
