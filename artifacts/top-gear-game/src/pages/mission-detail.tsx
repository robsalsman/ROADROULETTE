import { Link, useLocation, useParams } from "wouter";
import { useGetMission, getGetMissionQueryKey, useGetSave, getGetSaveQueryKey, useCreateSave, useUpdateSave } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Gauge, Settings2, Mountain, PoundSterling, Trophy, Warehouse, Wrench, BadgePoundSterling } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import {
  adjustedCarStats,
  loadGarage,
  loadUpgradeSpend,
  loadUpgrades,
  saveGarage,
  sellValue,
  upgradeKey,
  type GarageCar,
  type GarageState,
} from "@/data/garage";

type MissionCar = {
  id: number;
  name: string;
  year: number;
  price: number;
  reliability: number;
  power: number;
  offRoad: number;
  description: string;
};

export default function MissionDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const characterId = searchParams.get("characterId");
  const querySaveId = searchParams.get("saveId");
  const isSeries = searchParams.get("series") === "1" || !!querySaveId;

  const [creating, setCreating] = useState(false);
  const [garage, setGarage] = useState<GarageState>({ activeCarId: null, cars: [] });
  const [seriesFunds, setSeriesFunds] = useState<number | null>(null);

  const { data: mission, isLoading: isLoadingMission } = useGetMission(Number(id), {
    query: { enabled: !!id, queryKey: getGetMissionQueryKey(Number(id)) }
  });

  // For series stages we reuse one save across all legs; load it to read carried funds.
  const { data: existingSave } = useGetSave(Number(querySaveId), {
    query: { enabled: !!querySaveId, queryKey: getGetSaveQueryKey(Number(querySaveId)) },
  });

  const createSave = useCreateSave();
  const updateSave = useUpdateSave();
  const allowSeriesSkip = import.meta.env.VITE_ALLOW_SERIES_SKIP === "1";

  useEffect(() => {
    if (!isSeries || !querySaveId) return;
    setGarage(loadGarage(querySaveId));
  }, [isSeries, querySaveId]);

  useEffect(() => {
    if (!isSeries || !existingSave || !mission || allowSeriesSkip) return;
    if (existingSave.missionId !== mission.id || existingSave.seriesStageIndex !== mission.id - 1) {
      setLocation(`/mission/${existingSave.missionId}?saveId=${existingSave.id}&series=1`);
    }
  }, [allowSeriesSkip, existingSave, isSeries, mission, setLocation]);

  useEffect(() => {
    if (!isSeries || !existingSave) return;
    setSeriesFunds(existingSave.funds);
  }, [isSeries, existingSave]);

  // Money available to spend on the car: carried funds for series, mission budget for arcade.
  const spendable = isSeries ? (seriesFunds ?? existingSave?.funds ?? 0) : (mission?.budget ?? 0);

  const saveGarageState = (nextGarage: GarageState) => {
    if (!querySaveId) return;
    saveGarage(querySaveId, nextGarage);
    setGarage(nextGarage);
  };

  const toGarageCar = (car: MissionCar): GarageCar => ({
    id: car.id,
    missionId: mission?.id ?? 0,
    name: car.name,
    year: car.year,
    price: car.price,
    reliability: car.reliability,
    power: car.power,
    offRoad: car.offRoad,
    description: car.description,
    purchasedAt: Date.now(),
  });

  const selectGarageCar = async (carId: number) => {
    if (!existingSave || !querySaveId) return;
    setCreating(true);
    try {
      saveGarageState({ ...garage, activeCarId: carId });
      await updateSave.mutateAsync({
        id: existingSave.id,
        data: { carId, status: "on_road" },
      });
      setLocation(`/upgrade-shop/${existingSave.id}`);
    } catch {
      toast({ title: "Error", description: "Failed to select garage car.", variant: "destructive" });
      setCreating(false);
    }
  };

  const sellGarageCar = async (car: GarageCar) => {
    if (!existingSave || !querySaveId) return;
    const refund = sellValue(car, loadUpgradeSpend(querySaveId, car.id));
    const nextFunds = spendable + refund;
    setCreating(true);
    try {
      const remainingCars = garage.cars.filter((owned) => owned.id !== car.id);
      const nextActiveId = garage.activeCarId === car.id ? null : garage.activeCarId;
      saveGarageState({ activeCarId: nextActiveId, cars: remainingCars });
      localStorage.removeItem(upgradeKey(querySaveId, car.id));
      await updateSave.mutateAsync({
        id: existingSave.id,
        data: {
          funds: nextFunds,
          carId: nextActiveId,
          status: nextActiveId ? "on_road" : "car_selection",
        },
      });
      setSeriesFunds(nextFunds);
      toast({ title: "Car Sold", description: `${car.year} ${car.name} returned GBP ${refund.toLocaleString()}.` });
    } catch {
      toast({ title: "Error", description: "Failed to sell car.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleBuyCar = async (carId: number, price: number) => {
    if (!mission) return;

    if (isSeries) {
      if (!existingSave) return;
      const selectedCar = mission.availableCars.find((car) => car.id === carId);
      if (!selectedCar) return;
      const alreadyOwned = garage.cars.some((car) => car.id === carId);
      if (alreadyOwned) {
        await selectGarageCar(carId);
        return;
      }
      if (spendable < price) return;
      setCreating(true);
      try {
        saveGarageState({ activeCarId: carId, cars: [...garage.cars, toGarageCar(selectedCar)] });
        await updateSave.mutateAsync({
          id: existingSave.id,
          data: { carId, funds: spendable - price, status: "on_road" },
        });
        toast({ title: "Car Purchased!", description: "Added to the series garage. Now make it less terrible." });
        setLocation(`/upgrade-shop/${existingSave.id}`);
      } catch {
        toast({ title: "Error", description: "Failed to buy car.", variant: "destructive" });
        setCreating(false);
      }
      return;
    }

    if (!characterId) return;
    setCreating(true);
    try {
      // 1. Create save
      const save = await createSave.mutateAsync({
        data: { characterId: Number(characterId), missionId: mission.id }
      });

      // 2. Buy car
      await updateSave.mutateAsync({
        id: save.id,
        data: {
          carId,
          funds: mission.budget - price,
          status: "on_road"
        }
      });

      toast({ title: "Car Purchased!", description: "Right. Now let's spend what's left on improvements." });
      setLocation(`/upgrade-shop/${save.id}`);
    } catch {
      toast({ title: "Error", description: "Failed to buy car.", variant: "destructive" });
      setCreating(false);
    }
  };

  if (isLoadingMission) {
    return <div className="p-12 max-w-6xl mx-auto"><Skeleton className="h-[500px] w-full" /></div>;
  }

  if (!mission) return <div className="p-12 text-center">Mission not found</div>;

  const ownedIds = new Set(garage.cars.map((car) => car.id));

  return (
    <div className="flex-1 p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">

        {isSeries && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-amber-400 text-sm font-bold uppercase tracking-widest">
              <Trophy className="w-4 h-4" />
              Episode {(existingSave?.seriesStageIndex ?? 0) + 1} of 46
            </div>
            {existingSave && (
              <Link href={`/series-progress/${existingSave.id}`}>
                <Button variant="outline" size="sm" className="uppercase font-bold">
                  Campaign Progress
                </Button>
              </Link>
            )}
          </div>
        )}

        <div className="bg-card border rounded-lg p-6 md:p-8 space-y-4">
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <h2 className="text-3xl font-bold uppercase tracking-wide text-primary">{mission.title}</h2>
              <p className="text-lg text-muted-foreground">{mission.location}</p>
            </div>
            <div className="bg-muted px-4 py-2 rounded-md flex items-center gap-2">
              <PoundSterling className="h-5 w-5 text-green-500" />
              <span className="font-mono text-xl font-bold">
                {isSeries ? "Funds" : "Budget"}: GBP {spendable.toLocaleString()}
              </span>
            </div>
          </div>
          <p className="max-w-3xl text-muted-foreground">{mission.description}</p>
          {isSeries && (
            <p className="text-sm text-amber-400/80">
              Your garage carries through the series. Buy, sell, upgrade, and pick the machine for this stage.
            </p>
          )}
        </div>

        {isSeries && garage.cars.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-primary" />
              <h3 className="text-2xl font-bold uppercase tracking-tight">Series Garage</h3>
            </div>
            <p className="text-muted-foreground">Owned cars stay with this series save. Compare upgraded stats before choosing what to risk next.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {garage.cars.map((car) => {
                const upgrades = querySaveId ? loadUpgrades(querySaveId, car.id) : {};
                const stats = adjustedCarStats(car, upgrades);
                const refund = querySaveId ? sellValue(car, loadUpgradeSpend(querySaveId, car.id)) : sellValue(car, 0);
                const isActive = garage.activeCarId === car.id || existingSave?.carId === car.id;
                const upgradeCount = Object.keys(upgrades).length;

                return (
                  <Card key={car.id} className={`flex flex-col border-2 ${isActive ? "border-primary" : "border-transparent"}`}>
                    <CardHeader>
                      <div className="flex justify-between items-start gap-4">
                        <CardTitle className="uppercase font-bold">{car.year} {car.name}</CardTitle>
                        {isActive && <span className="text-xs font-bold uppercase text-primary">Selected</span>}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-4">
                      <p className="text-sm text-muted-foreground min-h-[3rem]">{car.description}</p>
                      <div className="space-y-4 bg-muted/30 p-4 rounded-md">
                        {[
                          { label: "Reliability", icon: Settings2, value: stats.reliability, base: car.reliability },
                          { label: "Power", icon: Gauge, value: stats.power, base: car.power },
                          { label: "Off-Road", icon: Mountain, value: stats.offRoad, base: car.offRoad },
                        ].map(({ label, icon: Icon, value, base }) => (
                          <div key={label} className="space-y-1.5">
                            <div className="flex justify-between text-xs font-medium uppercase">
                              <span className="flex items-center gap-1.5"><Icon className="h-3 w-3"/> {label}</span>
                              <span>{value}/10 {value !== base && <span className="text-green-400">(+{value - base})</span>}</span>
                            </div>
                            <Progress value={value * 10} className="h-2" />
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground gap-2">
                        <span className="flex items-center gap-1"><Wrench className="h-3 w-3" /> {upgradeCount} upgrade{upgradeCount !== 1 ? "s" : ""}</span>
                        <span className="flex items-center gap-1"><BadgePoundSterling className="h-3 w-3" /> Sell: GBP {refund.toLocaleString()}</span>
                      </div>
                    </CardContent>
                    <CardFooter className="gap-2">
                      <Button
                        className="flex-1 uppercase font-bold"
                        disabled={creating}
                        onClick={() => selectGarageCar(car.id)}
                      >
                        {isActive ? "Upgrade" : "Select"}
                      </Button>
                      <Button
                        variant="outline"
                        className="uppercase font-bold"
                        disabled={creating}
                        onClick={() => sellGarageCar(car)}
                      >
                        Sell
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-2xl font-bold uppercase tracking-tight">The Used Car Lot</h3>
          <p className="text-muted-foreground">Pick your poison. It's going to break anyway.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mission.availableCars.map((car) => {
              const owned = ownedIds.has(car.id);
              return (
                <Card key={car.id} className="flex flex-col border-2 border-transparent hover:border-primary transition-colors">
                  <CardHeader>
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <CardTitle className="uppercase font-bold">{car.year} {car.name}</CardTitle>
                      </div>
                      <div className="font-mono font-bold text-lg text-green-500 whitespace-nowrap">GBP {car.price}</div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-6">
                    <p className="text-sm text-muted-foreground min-h-[3rem]">{car.description}</p>

                    <div className="space-y-4 bg-muted/30 p-4 rounded-md">
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium uppercase">
                          <span className="flex items-center gap-1.5"><Settings2 className="h-3 w-3"/> Reliability</span>
                          <span>{car.reliability}/10</span>
                        </div>
                        <Progress value={car.reliability * 10} className="h-2" />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium uppercase">
                          <span className="flex items-center gap-1.5"><Gauge className="h-3 w-3"/> Power</span>
                          <span>{car.power}/10</span>
                        </div>
                        <Progress value={car.power * 10} className="h-2" />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium uppercase">
                          <span className="flex items-center gap-1.5"><Mountain className="h-3 w-3"/> Off-Road</span>
                          <span>{car.offRoad}/10</span>
                        </div>
                        <Progress value={car.offRoad * 10} className="h-2" />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full uppercase font-bold"
                      disabled={creating || (!owned && spendable < car.price)}
                      onClick={() => handleBuyCar(car.id, car.price)}
                      data-testid={`button-buy-car-${car.id}`}
                    >
                      {owned ? "Use Garage Car" : spendable < car.price ? "Too Expensive" : "Buy It"}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
