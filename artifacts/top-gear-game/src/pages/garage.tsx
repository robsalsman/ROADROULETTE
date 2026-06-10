import { Link } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Car, Paintbrush, Play, Settings2, Trophy, Wrench } from "lucide-react";
import {
  getListSavesQueryKey,
  useListSaves,
  useUpdateSave,
  type GameSave,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import VehicleSprite from "@/components/VehicleSprite";
import {
  adjustedCarStats,
  loadGarage,
  loadUpgradeSpend,
  loadUpgrades,
  saveGarage,
  saveUpgrades,
  type GarageCar,
  type GarageState,
  type UpgradeCat,
  type Upgrades,
} from "@/data/garage";
import { DEFS, EFFECTS } from "@/pages/upgrade-shop";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

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

type GarageEntry = {
  saveId: number;
  save?: GameSave;
  garage: GarageState;
  car: GarageCar;
  upgrades: Upgrades;
  spent: number;
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

function garageEntries(saves: GameSave[] | undefined): GarageEntry[] {
  const savesById = new Map((saves ?? []).map((save) => [save.id, save]));
  return garageSaveIds().flatMap((saveId) => {
    const garage = loadGarage(saveId);
    return garage.cars.map((car) => ({
      saveId,
      save: savesById.get(saveId),
      garage,
      car,
      upgrades: loadUpgrades(saveId, car.id),
      spent: loadUpgradeSpend(saveId, car.id),
    }));
  });
}

function saveRoute(save?: GameSave): string {
  if (!save) return "/";
  const storedRoute = localStorage.getItem(`tgrr-resume-route-${save.id}`);
  if (storedRoute) return storedRoute;
  if (save.status === "completed" || save.status === "failed") return `/results/${save.id}`;
  if (save.status === "challenge") return `/challenge/${save.id}`;
  if (save.mode === "series" && (save.status === "car_selection" || !save.carId)) {
    return `/mission/${save.missionId}?saveId=${save.id}&series=1`;
  }
  return `/game/${save.id}`;
}

function updateGarageCar(saveId: number, carId: number, patch: Partial<GarageCar>): GarageState {
  const garage = loadGarage(saveId);
  const nextGarage = {
    ...garage,
    cars: garage.cars.map((car) => (car.id === carId ? { ...car, ...patch } : car)),
  };
  saveGarage(saveId, nextGarage);
  return nextGarage;
}

export default function Garage() {
  const queryClient = useQueryClient();
  const updateSave = useUpdateSave();
  const { data: saves, isLoading } = useListSaves({
    query: { queryKey: getListSavesQueryKey() },
  });

  const [entries, setEntries] = useState<GarageEntry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const refresh = () => setEntries(garageEntries(saves));

  useEffect(() => {
    refresh();
  }, [saves]);

  const grouped = useMemo(() => {
    const map = new Map<number, GarageEntry[]>();
    for (const entry of entries) {
      map.set(entry.saveId, [...(map.get(entry.saveId) ?? []), entry]);
    }
    return [...map.entries()].sort(([a], [b]) => b - a);
  }, [entries]);

  const setActiveCar = async (entry: GarageEntry) => {
    if (!entry.save) return;
    const token = `${entry.saveId}-${entry.car.id}-active`;
    setWorking(token);
    try {
      saveGarage(entry.saveId, { ...entry.garage, activeCarId: entry.car.id });
      await updateSave.mutateAsync({
        id: entry.save.id,
        data: { carId: entry.car.id, status: "on_road" },
      });
      await queryClient.invalidateQueries({ queryKey: getListSavesQueryKey() });
      refresh();
      toast({ title: "Garage updated", description: `${entry.car.year} ${entry.car.name} is now selected.` });
    } catch {
      toast({ title: "Failed to select car", variant: "destructive" });
    } finally {
      setWorking(null);
    }
  };

  const repaintCar = (entry: GarageEntry, paintColor: string) => {
    updateGarageCar(entry.saveId, entry.car.id, { paintColor });
    refresh();
  };

  const buyTier = async (entry: GarageEntry, cat: UpgradeCat, tier: 1 | 2 | 3) => {
    if (!entry.save) return;
    const def = DEFS.find((item) => item.cat === cat);
    if (!def) return;

    const token = `${entry.saveId}-${entry.car.id}-${cat}-${tier}`;
    const currentTier = entry.upgrades[cat] ?? 0;
    const targetCost = def.tiers[tier - 1].cost;
    const previousCost = currentTier > 0 ? def.tiers[currentTier - 1].cost : 0;
    const diffCost = targetCost - previousCost;
    const budget = entry.save.funds ?? 0;

    if (tier < currentTier) return;
    setWorking(token);
    try {
      if (currentTier === tier) {
        const nextUpgrades = { ...entry.upgrades };
        delete nextUpgrades[cat];
        saveUpgrades(entry.saveId, entry.car.id, nextUpgrades, Math.max(0, entry.spent - targetCost));
        await updateSave.mutateAsync({ id: entry.save.id, data: { funds: budget + targetCost } });
      } else {
        if (diffCost > budget) return;
        const nextUpgrades = { ...entry.upgrades, [cat]: tier };
        saveUpgrades(entry.saveId, entry.car.id, nextUpgrades, entry.spent + diffCost);
        await updateSave.mutateAsync({ id: entry.save.id, data: { funds: budget - diffCost } });
      }
      await queryClient.invalidateQueries({ queryKey: getListSavesQueryKey() });
      refresh();
    } catch {
      toast({ title: "Upgrade failed", variant: "destructive" });
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
              Inspect, repaint, upgrade, and select the cars saved across your series garages.
            </p>
          </div>
          <Link href="/">
            <Button variant="outline" className="uppercase" data-testid="button-garage-back">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="rounded-md border border-border bg-card p-8 text-muted-foreground">Loading garage...</div>
        ) : entries.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-10 text-center">
            <p className="mb-4 text-lg font-bold uppercase">No garage cars yet</p>
            <p className="mx-auto mb-6 max-w-xl text-muted-foreground">
              Buy cars in Series Mode and they will appear here for comparison, repainting, and upgrades.
            </p>
            <Link href="/series-start">
              <Button className="uppercase font-bold">Start Series Mode</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map(([saveId, saveEntries]) => {
              const save = saveEntries[0]?.save;
              return (
                <section key={saveId} className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-black uppercase">Save #{saveId}</h3>
                      <p className="text-sm text-muted-foreground">
                        {save
                          ? `${save.mode.toUpperCase()} · Stage ${(save.seriesStageIndex ?? 0) + 1} · Funds GBP ${(save.funds ?? 0).toLocaleString()}`
                          : "Local garage data without an active save record"}
                      </p>
                    </div>
                    {save && (
                      <Link href={saveRoute(save)}>
                        <Button variant="secondary" className="uppercase font-bold">
                          <Play className="mr-2 h-4 w-4" /> Continue Save
                        </Button>
                      </Link>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {saveEntries.map((entry) => {
                      const stats = adjustedCarStats(entry.car, entry.upgrades);
                      const key = `${entry.saveId}-${entry.car.id}`;
                      const isExpanded = expanded === key;
                      const isActive = entry.garage.activeCarId === entry.car.id || entry.save?.carId === entry.car.id;

                      return (
                        <Card key={key} className={cn("flex flex-col border-2", isActive ? "border-primary" : "border-transparent")}>
                          <CardHeader>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <CardTitle className="uppercase">{entry.car.year} {entry.car.name}</CardTitle>
                                <p className="text-xs text-muted-foreground">Bought in mission {entry.car.missionId}</p>
                              </div>
                              {isActive && <span className="rounded bg-primary/20 px-2 py-1 text-xs font-black uppercase text-primary">Active</span>}
                            </div>
                          </CardHeader>
                          <CardContent className="flex-1 space-y-4">
                            <VehicleSprite vehicle={entry.car} className="h-32 w-full" />
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              {[
                                ["Reliability", stats.reliability],
                                ["Power", stats.power],
                                ["Off-road", stats.offRoad],
                              ].map(([label, value]) => (
                                <div key={label} className="rounded-md border border-border bg-muted/30 p-2">
                                  <p className="font-bold uppercase text-muted-foreground">{label}</p>
                                  <p className="font-mono text-lg font-black">{value}/10</p>
                                  <Progress value={Number(value) * 10} className="h-1.5" />
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
                                    aria-label={`Paint ${entry.car.name} ${paint}`}
                                    className={cn(
                                      "h-6 w-6 rounded-full border-2",
                                      entry.car.paintColor === paint ? "border-primary" : "border-white/30",
                                    )}
                                    style={{ backgroundColor: paint }}
                                    onClick={() => repaintCar(entry, paint)}
                                  />
                                ))}
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
                                {DEFS.map((def) => {
                                  const currentTier = entry.upgrades[def.cat] ?? 0;
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
                                          const affordable = owned || diffCost <= (entry.save?.funds ?? 0);
                                          return (
                                            <button
                                              key={tier.name}
                                              type="button"
                                              disabled={locked || !affordable || working === `${entry.saveId}-${entry.car.id}-${def.cat}-${tierNum}`}
                                              onClick={() => buyTier(entry, def.cat, tierNum)}
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
                                                {owned ? "Sell" : `GBP ${currentTier > 0 ? diffCost : tier.cost}`}
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
                          <CardFooter className="gap-2">
                            <Button
                              variant={isExpanded ? "secondary" : "outline"}
                              className="flex-1 uppercase font-bold"
                              onClick={() => setExpanded(isExpanded ? null : key)}
                            >
                              <Wrench className="mr-2 h-4 w-4" /> Manage
                            </Button>
                            <Button
                              className="flex-1 uppercase font-bold"
                              disabled={!entry.save || working === `${entry.saveId}-${entry.car.id}-active`}
                              onClick={() => setActiveCar(entry)}
                            >
                              <Settings2 className="mr-2 h-4 w-4" /> Select
                            </Button>
                            {entry.save && (
                              <Link href={`/series-progress/${entry.save.id}`}>
                                <Button variant="outline" size="icon" aria-label="Campaign progress">
                                  <Trophy className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                          </CardFooter>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
