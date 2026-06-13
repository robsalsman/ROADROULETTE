import { Link, useLocation } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Flag, Gauge, RotateCcw, Settings2, Trophy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import VehicleSprite from "@/components/VehicleSprite";
import { garageApi, defaultGarageTuning, ownedToGarageCar, type GarageTuning, type OwnedVehicle } from "@/services/garageApi";
import { DRAG_OPPONENTS, simulateDragRace, timingScore, type DragOpponent, type DragRaceResult } from "@/game/dragRaceEngine";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const GARAGE_QUERY_KEY = ["garage"];

type RacePhase = "staging" | "launching" | "shifting" | "result";

function formatTime(ms: number): string {
  return `${(ms / 1000).toFixed(3)}s`;
}

function selectVehicle(vehicles: OwnedVehicle[], key: string | null): OwnedVehicle | undefined {
  return vehicles.find((vehicle) => vehicle.canonicalVehicleKey === key)
    ?? vehicles.find((vehicle) => vehicle.isActive)
    ?? vehicles[0];
}

export default function DragRace() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const searchParams = new URLSearchParams(window.location.search);
  const requestedVehicle = searchParams.get("vehicle");

  const garageQuery = useQuery({
    queryKey: GARAGE_QUERY_KEY,
    queryFn: garageApi.getGarage,
  });

  const garage = garageQuery.data;
  const vehicle = selectVehicle(garage?.vehicles ?? [], requestedVehicle);
  const [opponentKey, setOpponentKey] = useState(DRAG_OPPONENTS[0].key);
  const opponent = DRAG_OPPONENTS.find((item) => item.key === opponentKey) ?? DRAG_OPPONENTS[0];
  const [tuning, setTuning] = useState<GarageTuning>(vehicle?.tuning ?? defaultGarageTuning);
  const [phase, setPhase] = useState<RacePhase>("staging");
  const [needle, setNeedle] = useState(0.35);
  const [launchScore, setLaunchScore] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [result, setResult] = useState<DragRaceResult | null>(null);

  useEffect(() => {
    if (vehicle) setTuning(vehicle.tuning ?? defaultGarageTuning);
  }, [vehicle?.canonicalVehicleKey]);

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
    if (phase !== "launching" && phase !== "shifting") return;
    let frame = 0;
    let raf = 0;
    const tick = () => {
      frame += 1;
      setNeedle((Math.sin(frame / 9) + 1) / 2);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const startRace = async () => {
    if (!vehicle) return;
    setTuning(vehicle.tuning ?? defaultGarageTuning);
    await saveTuningMutation.mutateAsync({ selected: vehicle, nextTuning: tuning }).catch(() => undefined);
    setResult(null);
    setLaunchScore(null);
    setNeedle(0.35);
    setStartedAt(performance.now());
    setPhase("launching");
  };

  const launch = () => {
    setLaunchScore(timingScore(needle, 0.72));
    setPhase("shifting");
  };

  const shift = async () => {
    if (!vehicle || launchScore == null) return;
    const reactionMs = Math.max(80, Math.round(performance.now() - (startedAt ?? performance.now())));
    const final = simulateDragRace({
      vehicle: { ...vehicle, tuning },
      opponent,
      launchScore,
      shiftScore: timingScore(needle, 0.68),
      reactionMs,
    });
    setResult(final);
    setPhase("result");
    await raceMutation.mutateAsync({ ...final, selected: vehicle, opponent }).catch(() => {
      toast({ title: "Race result not saved", variant: "destructive" });
    });
  };

  const resetRace = () => {
    setPhase("staging");
    setResult(null);
    setLaunchScore(null);
    setNeedle(0.35);
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
          <p className="mb-6 text-muted-foreground">Buy a car first, then come back for race night.</p>
          <Link href="/garage">
            <Button className="uppercase font-bold">Open Garage</Button>
          </Link>
        </div>
      </div>
    );
  }

  const garageCar = ownedToGarageCar({ ...vehicle, tuning });

  return (
    <div className="flex-1 bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-primary">Race Night</p>
            <h1 className="text-4xl font-black uppercase tracking-tight">Drag Strip</h1>
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

        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="overflow-hidden border-2 border-primary/30">
            <CardHeader className="bg-black/40">
              <CardTitle className="flex items-center gap-2 uppercase">
                <Flag className="h-5 w-5 text-primary" /> Staging Lane
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 p-5">
              <div className="relative overflow-hidden rounded-md border border-border bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 p-4">
                <div className="absolute inset-x-0 top-1/2 h-1 bg-amber-500/60" />
                <div className="grid grid-cols-2 items-center gap-4">
                  <div>
                    <VehicleSprite vehicle={garageCar} className="h-32 border-0 bg-transparent" />
                    <p className="mt-2 text-center text-sm font-black uppercase">{vehicle.year} {vehicle.name}</p>
                  </div>
                  <div>
                    <div className="flex h-32 items-center justify-center rounded-md border border-red-500/30 bg-red-500/10 text-center">
                      <div>
                        <p className="text-xs font-black uppercase text-red-300">Opponent</p>
                        <p className="font-black uppercase">{opponent.name}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-center text-sm font-black uppercase">Reward CR {opponent.rewardCredits}</p>
                  </div>
                </div>
              </div>

              {(phase === "launching" || phase === "shifting") && (
                <div className="space-y-3 rounded-md border border-border bg-muted/20 p-4">
                  <div className="flex items-center justify-between text-xs font-black uppercase">
                    <span>{phase === "launching" ? "Launch" : "Shift"} timing</span>
                    <span>Hit the amber band</span>
                  </div>
                  <div className="relative h-8 overflow-hidden rounded-full bg-muted">
                    <div className="absolute left-[62%] top-0 h-full w-[18%] bg-amber-500/50" />
                    <div className="absolute top-0 h-full w-2 rounded-full bg-primary shadow-[0_0_18px_rgba(245,158,11,0.8)]" style={{ left: `${needle * 100}%` }} />
                  </div>
                </div>
              )}

              {phase === "staging" && (
                <Button size="lg" className="h-16 w-full text-xl font-black uppercase" onClick={startRace} data-testid="button-start-drag-race">
                  <Zap className="mr-2 h-6 w-6" /> Stage Race
                </Button>
              )}
              {phase === "launching" && (
                <Button size="lg" className="h-20 w-full text-2xl font-black uppercase" onClick={launch} data-testid="button-launch-drag-race">
                  Launch
                </Button>
              )}
              {phase === "shifting" && (
                <Button size="lg" className="h-20 w-full text-2xl font-black uppercase" onClick={shift} data-testid="button-shift-drag-race">
                  Shift
                </Button>
              )}
              {phase === "result" && result && (
                <div className={cn("rounded-md border p-5", result.won ? "border-green-500/50 bg-green-500/10" : "border-red-500/50 bg-red-500/10")}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase text-muted-foreground">Result</p>
                      <p className="text-3xl font-black uppercase">{result.won ? "You Won" : "You Lost"}</p>
                    </div>
                    <Trophy className={cn("h-10 w-10", result.won ? "text-green-400" : "text-red-400")} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-muted-foreground">Your ET</p><p className="font-mono text-xl font-black">{formatTime(result.elapsedMs)}</p></div>
                    <div><p className="text-muted-foreground">Opponent</p><p className="font-mono text-xl font-black">{formatTime(result.opponentElapsedMs)}</p></div>
                    <div><p className="text-muted-foreground">Trap Speed</p><p className="font-mono text-xl font-black">{result.trapSpeed} mph</p></div>
                    <div><p className="text-muted-foreground">Credits</p><p className="font-mono text-xl font-black">+{result.rewardCredits}</p></div>
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
                  <Gauge className="h-5 w-5 text-primary" /> Opponent
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {DRAG_OPPONENTS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    disabled={phase !== "staging"}
                    onClick={() => setOpponentKey(item.key)}
                    className={cn(
                      "w-full rounded-md border p-3 text-left transition-colors",
                      item.key === opponentKey ? "border-primary bg-primary/10" : "border-border bg-muted/20 hover:border-primary/60",
                    )}
                  >
                    <div className="flex justify-between gap-3">
                      <span className="font-black uppercase">{item.name}</span>
                      <span className="font-mono font-bold">CR {item.rewardCredits}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Power {item.power}/10 · Traction {item.traction}/10 · Consistency {item.consistency}/10</p>
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
