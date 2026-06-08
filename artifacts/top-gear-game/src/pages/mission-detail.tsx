import { useLocation, useParams } from "wouter";
import { useGetMission, getGetMissionQueryKey, useGetSave, getGetSaveQueryKey, useCreateSave, useUpdateSave } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Gauge, Settings2, Mountain, PoundSterling, Trophy } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";

export default function MissionDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const characterId = searchParams.get("characterId");
  const querySaveId = searchParams.get("saveId");
  const isSeries = searchParams.get("series") === "1" || !!querySaveId;

  const [creating, setCreating] = useState(false);

  const { data: mission, isLoading: isLoadingMission } = useGetMission(Number(id), {
    query: { enabled: !!id, queryKey: getGetMissionQueryKey(Number(id)) }
  });

  // For series stages we reuse one save across all legs; load it to read carried funds.
  const { data: existingSave } = useGetSave(Number(querySaveId), {
    query: { enabled: !!querySaveId, queryKey: getGetSaveQueryKey(Number(querySaveId)) },
  });

  const createSave = useCreateSave();
  const updateSave = useUpdateSave();

  // Money available to spend on the car: carried funds for series, mission budget for arcade.
  const spendable = isSeries ? (existingSave?.funds ?? 0) : (mission?.budget ?? 0);

  const handleBuyCar = async (carId: number, price: number) => {
    if (!mission) return;

    if (isSeries) {
      if (!existingSave) return;
      setCreating(true);
      try {
        await updateSave.mutateAsync({
          id: existingSave.id,
          data: { carId, funds: existingSave.funds - price, status: "on_road" },
        });
        toast({ title: "Car Purchased!", description: "Right. Onto the next leg of the series." });
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
          status: 'on_road'
        }
      });

      toast({ title: "Car Purchased!", description: "Right. Now let's spend what's left on improvements." });
      setLocation(`/upgrade-shop/${save.id}`);
    } catch (err) {
      toast({ title: "Error", description: "Failed to buy car.", variant: "destructive" });
      setCreating(false);
    }
  };

  if (isLoadingMission) {
    return <div className="p-12 max-w-6xl mx-auto"><Skeleton className="h-[500px] w-full" /></div>;
  }

  if (!mission) return <div className="p-12 text-center">Mission not found</div>;

  return (
    <div className="flex-1 p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">

        {isSeries && (
          <div className="flex items-center gap-2 text-amber-400 text-sm font-bold uppercase tracking-widest">
            <Trophy className="w-4 h-4" />
            Series · Stage {(existingSave?.seriesStageIndex ?? 0) + 1}
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
                {isSeries ? "Funds" : "Budget"}: £{spendable.toLocaleString()}
              </span>
            </div>
          </div>
          <p className="max-w-3xl text-muted-foreground">{mission.description}</p>
          {isSeries && (
            <p className="text-sm text-amber-400/80">
              Fresh car, same wallet. Spend wisely — whatever's left carries to the next stage.
            </p>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-2xl font-bold uppercase tracking-tight">The Used Car Lot</h3>
          <p className="text-muted-foreground">Pick your poison. It's going to break anyway.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mission.availableCars.map((car) => (
              <Card key={car.id} className="flex flex-col border-2 border-transparent hover:border-primary transition-colors">
                <CardHeader>
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <CardTitle className="uppercase font-bold">{car.year} {car.name}</CardTitle>
                    </div>
                    <div className="font-mono font-bold text-lg text-green-500 whitespace-nowrap">£{car.price}</div>
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
                    disabled={creating || spendable < car.price}
                    onClick={() => handleBuyCar(car.id, car.price)}
                    data-testid={`button-buy-car-${car.id}`}
                  >
                    {spendable < car.price ? "Too Expensive" : "Buy It"}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
