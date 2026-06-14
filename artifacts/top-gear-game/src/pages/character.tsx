import { Link } from "wouter";
import { useState } from "react";
import { ArrowLeft, Award, Backpack, Car, Flag, Gauge, Map, Play, Trophy, UserRound, Wrench, Zap } from "lucide-react";
import { useListSaves, getListSavesQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { garageApi } from "@/services/garageApi";
import { saleValueForVehicle } from "@/data/vehiclePerformance";
import { GRAND_TOUR_EPISODE_COUNT, GRAND_TOUR_EPISODE_STAGES } from "@/data/grand-tour-episode-stages";
import {
  PLAYER_STYLES,
  upgradePlayerStat,
  type Badge,
  type PlayerStat,
} from "@/data/campaign";
import {
  arcadeCompletionPercent,
  campaignCompletionFromLocalStorage,
  loadStandaloneTriviaStats,
  standaloneTriviaCompletion,
} from "@/data/driverStats";
import { continueHrefForCareer, resolveActiveCareer } from "@/data/activeCareer";

const STATS: Array<{ id: PlayerStat; label: string; desc: string }> = [
  { id: "navigation", label: "Navigation", desc: "Shortcuts, wrong turns, route choices." },
  { id: "mechanical", label: "Mechanical", desc: "Repairs, diagnosis, bodges that work." },
  { id: "charm", label: "Charm", desc: "Locals, shops, border queues, haggling." },
  { id: "confidence", label: "Confidence", desc: "Risky choices and high-pressure moments." },
  { id: "endurance", label: "Endurance", desc: "Long days, fatigue, bad weather." },
  { id: "luck", label: "Luck", desc: "Rare saves from stupid consequences." },
];

function formatTime(ms: number | null): string {
  return ms ? `${(ms / 1000).toFixed(3)}s` : "None";
}

function recentUnlocks(badges: Badge[]): Badge[] {
  return badges
    .filter((badge) => badge.unlockedAt || badge.progress >= badge.target)
    .sort((a, b) => new Date(b.unlockedAt ?? 0).getTime() - new Date(a.unlockedAt ?? 0).getTime())
    .slice(0, 4);
}

export default function Character() {
  const { data: saves, isLoading } = useListSaves({ query: { queryKey: getListSavesQueryKey() } });
  const { data: garage } = useQuery({ queryKey: ["garage"], queryFn: garageApi.getGarage });
  const [version, setVersion] = useState(0);
  const activeCareer = resolveActiveCareer(saves, garage);
  const save = activeCareer?.save;
  const character = activeCareer?.character ?? null;
  const campaignState = activeCareer?.campaignState ?? null;
  const inventory = activeCareer?.inventory ?? [];
  const badges = activeCareer?.badges ?? [];
  const dragCareerStats = activeCareer?.dragStats;
  const style = character ? PLAYER_STYLES[character.style] : null;
  const stageIndex = save ? Math.max(0, Math.min(save.seriesStageIndex ?? 0, GRAND_TOUR_EPISODE_STAGES.length - 1)) : 0;
  const stage = GRAND_TOUR_EPISODE_STAGES[stageIndex];
  const completedEpisodes = campaignState?.completedEpisodes.length ?? 0;
  const xpToNext = character ? 250 - (character.xp % 250) : 250;
  const unlockedBadges = badges.filter((badge) => badge.unlockedAt || badge.progress >= badge.target).length;
  const inventoryCount = inventory.reduce((total, item) => total + item.qty, 0);
  const garageVehicles = garage?.vehicles ?? [];
  const garageValue = garageVehicles.reduce((total, vehicle) => total + saleValueForVehicle(vehicle), 0);
  const dragRaces = garage?.raceHistory ?? [];
  const dragWins = dragRaces.filter((race) => race.won).length;
  const dragWinnings = dragRaces.reduce((total, race) => total + race.rewardCredits, 0);
  const bestEt = dragRaces.reduce<number | null>((best, race) => race.elapsedMs > 0 ? Math.min(best ?? race.elapsedMs, race.elapsedMs) : best, null);
  const triviaStats = loadStandaloneTriviaStats();
  const campaignCompletion = campaignCompletionFromLocalStorage();
  const arcadePct = arcadeCompletionPercent(saves);
  const seriesPct = GRAND_TOUR_EPISODE_COUNT > 0 ? Math.round((Math.max(completedEpisodes, campaignCompletion.completedEpisodes) / GRAND_TOUR_EPISODE_COUNT) * 100) : 0;
  const gamePct = Math.max(campaignCompletion.percent, seriesPct, arcadePct);
  const careerWinnings = dragWinnings + triviaStats.winnings;
  const continueHref = continueHrefForCareer(save);
  const activeVehicle = garageVehicles.find((vehicle) => vehicle.isActive) ?? garageVehicles[0];
  const latestUnlocks = recentUnlocks(badges);
  const recentRaces = dragRaces.slice(0, 5);

  const upgrade = (stat: PlayerStat) => {
    if (!save) return;
    upgradePlayerStat(save.id, stat, save.playerName ?? undefined);
    setVersion((value) => value + 1);
  };

  return (
    <div className="flex-1 px-4 pb-6 pt-24 md:p-12">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <UserRound className="h-6 w-6" />
              <h1 className="text-3xl font-black uppercase">Career Hub</h1>
            </div>
            <p className="text-muted-foreground">Active Series driver, road funds, garage GBP, badges, inventory, and race history in one place.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={continueHref}>
              <Button className="uppercase font-bold">
                <Play className="mr-2 h-4 w-4" /> {save ? "Continue Series" : "Start Series"}
              </Button>
            </Link>
            <Link href="/garage">
              <Button variant="outline" className="uppercase font-bold">
                <Wrench className="mr-2 h-4 w-4" /> Garage
              </Button>
            </Link>
            <Link href={activeVehicle ? `/drag-race?mode=board&vehicle=${encodeURIComponent(activeVehicle.canonicalVehicleKey)}` : "/garage"}>
              <Button variant="outline" className="uppercase font-bold">
                <Gauge className="mr-2 h-4 w-4" /> Quick Drag
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="uppercase">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-md border border-border bg-card p-8 text-muted-foreground">Loading career...</div>
        ) : !character || !save ? (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-10 text-center">
            <p className="mb-2 text-lg font-black uppercase">No active career yet</p>
            <p className="mx-auto mb-6 max-w-xl text-muted-foreground">Start Series Mode to create a driver. Garage and Quick Drag still work separately until then.</p>
            <Link href="/series-start">
              <Button className="uppercase font-bold">Start Series</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
            <div className="space-y-5">
              <div className="rounded-md border border-border bg-card p-5">
                <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full border-4 border-primary bg-primary/10 text-4xl font-black text-primary">
                  {character.name.charAt(0).toUpperCase()}
                </div>
                <h2 className="text-2xl font-black uppercase">{character.name}</h2>
                <p className="text-sm font-bold uppercase text-primary">{style?.label}</p>
                <p className="mt-2 text-sm text-muted-foreground">{style?.description}</p>
                <div className="mt-5 space-y-2">
                  <div className="flex justify-between text-xs font-bold uppercase text-muted-foreground">
                    <span>Level {character.level}</span>
                    <span>{xpToNext} XP to next</span>
                  </div>
                  <Progress value={(character.xp % 250) / 2.5} />
                  <p className="font-mono text-sm font-black">{character.xp.toLocaleString()} XP</p>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md border border-border bg-muted/30 p-3">
                    <p className="font-bold uppercase text-muted-foreground">Unspent points</p>
                    <p className="font-mono text-2xl font-black text-primary">{character.unspentPoints}</p>
                  </div>
                  <div className="rounded-md border border-border bg-muted/30 p-3">
                    <p className="font-bold uppercase text-muted-foreground">Active save</p>
                    <p className="font-mono text-2xl font-black">#{save.id}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-border bg-card p-4">
                <h2 className="mb-3 flex items-center gap-2 font-black uppercase">
                  <Flag className="h-5 w-5 text-primary" /> Active Series
                </h2>
                <p className="text-sm font-black uppercase">Episode {stage?.episodeNumber ?? stageIndex + 1}: {stage?.title ?? "Unknown Stage"}</p>
                <p className="text-xs text-muted-foreground">Stage {stageIndex + 1} of {GRAND_TOUR_EPISODE_COUNT} - status {save.status}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md border border-border bg-muted/20 p-2">
                    <p className="font-black uppercase text-muted-foreground">Road Funds</p>
                    <p className="font-mono text-lg font-black">GBP {save.funds.toLocaleString()}</p>
                  </div>
                  <div className="rounded-md border border-border bg-muted/20 p-2">
                    <p className="font-black uppercase text-muted-foreground">Completed</p>
                    <p className="font-mono text-lg font-black">{completedEpisodes}/{GRAND_TOUR_EPISODE_COUNT}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Game", `${gamePct}%`, "overall completion"],
                  ["Series", `${seriesPct}%`, "campaign completion"],
                  ["Arcade", `${arcadePct}%`, "arcade completion"],
                  ["Trivia", `${standaloneTriviaCompletion(triviaStats)}%`, `${triviaStats.correct}/${triviaStats.total} correct`],
                ].map(([label, value, sub]) => (
                  <div key={label} className="rounded-md border border-border bg-card p-4">
                    <p className="text-xs font-black uppercase text-muted-foreground">{label}</p>
                    <p className="font-mono text-3xl font-black">{value}</p>
                    <p className="text-xs text-muted-foreground">{sub}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Garage GBP", `GBP ${(garage?.profile.credits ?? 0).toLocaleString()}`, `Profile #${garage?.profile.id ?? 1}`],
                  ["Road Funds", `GBP ${save.funds.toLocaleString()}`, "Series save balance"],
                  ["Garage Value", `GBP ${garageValue.toLocaleString()}`, `${garageVehicles.length} owned vehicles`],
                  ["Career Winnings", `GBP ${careerWinnings.toLocaleString()}`, "drag + standalone trivia"],
                ].map(([label, value, sub]) => (
                  <div key={label} className="rounded-md border border-border bg-card p-4">
                    <p className="text-xs font-black uppercase text-muted-foreground">{label}</p>
                    <p className="font-mono text-xl font-black">{value}</p>
                    <p className="text-xs text-muted-foreground">{sub}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-md border border-border bg-card p-4">
                  <h2 className="mb-3 flex items-center gap-2 font-black uppercase">
                    <Gauge className="h-5 w-5 text-primary" /> Drag Racing
                  </h2>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      ["Drag record", `${dragWins}/${dragRaces.length}`],
                      ["Best ET", formatTime(bestEt)],
                      ["Drag winnings", `GBP ${dragWinnings.toLocaleString()}`],
                      ["Career drag", `${dragCareerStats?.wins ?? 0}/${dragCareerStats?.races ?? 0}`],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-md border border-border bg-muted/20 p-2">
                        <p className="font-black uppercase text-muted-foreground">{label}</p>
                        <p className="font-mono text-sm font-black">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 space-y-2">
                    {recentRaces.length === 0 ? (
                      <p className="rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground">No drag races recorded yet.</p>
                    ) : recentRaces.map((race) => (
                      <div key={race.id} className="rounded-md border border-border bg-muted/20 p-3 text-xs">
                        <div className="flex justify-between gap-2">
                          <p className="font-black uppercase">{race.won ? "Won" : "Lost"} vs {race.opponentName}</p>
                          <p className="font-mono font-black">{formatTime(race.elapsedMs)}</p>
                        </div>
                        <p className="text-muted-foreground">Trap {race.trapSpeed} mph - GBP {race.rewardCredits.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-md border border-border bg-card p-4">
                  <h2 className="mb-3 flex items-center gap-2 font-black uppercase">
                    <Car className="h-5 w-5 text-primary" /> Garage Summary
                  </h2>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      ["Owned vehicles", garageVehicles.length.toLocaleString()],
                      ["Active vehicle", activeVehicle ? `${activeVehicle.year} ${activeVehicle.name}` : "None"],
                      ["Garage value", `GBP ${garageValue.toLocaleString()}`],
                      ["Garage GBP", `GBP ${(garage?.profile.credits ?? 0).toLocaleString()}`],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-md border border-border bg-muted/20 p-2">
                        <p className="font-black uppercase text-muted-foreground">{label}</p>
                        <p className="font-mono text-sm font-black">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-md border border-border bg-card p-4">
                  <h2 className="mb-3 flex items-center gap-2 font-black uppercase">
                    <Backpack className="h-5 w-5 text-primary" /> Inventory
                  </h2>
                  <p className="mb-3 text-sm text-muted-foreground">{inventoryCount} items carried in this active Series career.</p>
                  <div className="grid gap-2 text-xs sm:grid-cols-2">
                    {inventory.slice(0, 6).map((item) => (
                      <div key={item.id} className="rounded-md border border-border bg-muted/20 p-2">
                        <p className="font-black uppercase">{item.name}</p>
                        <p className="text-muted-foreground">{item.category} - x{item.qty}</p>
                      </div>
                    ))}
                  </div>
                  <Link href="/inventory">
                    <Button variant="outline" className="mt-3 w-full uppercase font-bold">Open Inventory</Button>
                  </Link>
                </div>

                <div className="rounded-md border border-border bg-card p-4">
                  <h2 className="mb-3 flex items-center gap-2 font-black uppercase">
                    <Award className="h-5 w-5 text-primary" /> Badges / Unlocks
                  </h2>
                  <p className="mb-3 text-sm text-muted-foreground">{unlockedBadges}/{badges.length} badges unlocked.</p>
                  <div className="space-y-2">
                    {(latestUnlocks.length > 0 ? latestUnlocks : badges.slice(0, 4)).map((badge) => (
                      <div key={badge.id} className="rounded-md border border-border bg-muted/20 p-2 text-xs">
                        <div className="flex justify-between gap-2">
                          <p className="font-black uppercase">{badge.name}</p>
                          <p className="font-mono font-black">{Math.min(badge.progress, badge.target)}/{badge.target}</p>
                        </div>
                        <Progress value={(Math.min(badge.progress, badge.target) / badge.target) * 100} className="mt-1 h-1.5" />
                      </div>
                    ))}
                  </div>
                  <Link href="/badges">
                    <Button variant="outline" className="mt-3 w-full uppercase font-bold">Achievements</Button>
                  </Link>
                </div>
              </div>

              <div className="rounded-md border border-border bg-card p-4">
                <h2 className="mb-3 flex items-center gap-2 font-black uppercase">
                  <Map className="h-5 w-5 text-primary" /> Driver Stats
                </h2>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {STATS.map((stat) => {
                    const value = character.stats[stat.id];
                    return (
                      <div key={`${stat.id}-${version}`} className="rounded-md border border-border bg-muted/20 p-3">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-black uppercase">{stat.label}</h3>
                            <p className="text-xs text-muted-foreground">{stat.desc}</p>
                          </div>
                          <span className="font-mono text-xl font-black">{value}/10</span>
                        </div>
                        <Progress value={value * 10} />
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 w-full uppercase font-bold"
                          disabled={character.unspentPoints <= 0 || value >= 10}
                          onClick={() => upgrade(stat.id)}
                        >
                          <Zap className="mr-2 h-4 w-4" /> Upgrade
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
