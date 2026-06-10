import { Link } from "wouter";
import { useState } from "react";
import { ArrowLeft, Award, Backpack, Play, Trophy, UserRound, Zap } from "lucide-react";
import { useListSaves, getListSavesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  PLAYER_STYLES,
  loadBadges,
  loadCampaignState,
  loadInventory,
  loadPlayerCharacter,
  upgradePlayerStat,
  type PlayerStat,
} from "@/data/campaign";

const STATS: Array<{ id: PlayerStat; label: string; desc: string }> = [
  { id: "navigation", label: "Navigation", desc: "Shortcuts, wrong turns, route choices." },
  { id: "mechanical", label: "Mechanical", desc: "Repairs, diagnosis, bodges that work." },
  { id: "charm", label: "Charm", desc: "Locals, shops, border queues, haggling." },
  { id: "confidence", label: "Confidence", desc: "Risky choices and high-pressure moments." },
  { id: "endurance", label: "Endurance", desc: "Long days, fatigue, bad weather." },
  { id: "luck", label: "Luck", desc: "Rare saves from stupid consequences." },
];

function latestSeriesSave(saves: any[] | undefined) {
  return [...(saves ?? [])]
    .filter((save) => save.mode === "series")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
}

export default function Character() {
  const { data: saves, isLoading } = useListSaves({ query: { queryKey: getListSavesQueryKey() } });
  const save = latestSeriesSave(saves);
  const [version, setVersion] = useState(0);
  const character = save ? loadPlayerCharacter(save.id, save.playerName ?? "The New Bloke") : null;
  const campaignState = save ? loadCampaignState(save.id) : null;
  const inventory = save ? loadInventory(save.id) : [];
  const badges = save ? loadBadges(save.id) : [];
  const style = character ? PLAYER_STYLES[character.style] : null;
  const xpToNext = character ? 250 - (character.xp % 250) : 250;
  const unlockedBadges = badges.filter((badge) => badge.unlockedAt || badge.progress >= badge.target).length;
  const continueHref = !save
    ? "/series-start"
    : save.status === "car_selection" || !save.carId
      ? `/mission/${save.missionId}?saveId=${save.id}&series=1`
      : save.status === "completed" || save.status === "failed"
        ? `/results/${save.id}`
        : `/game/${save.id}`;

  const upgrade = (stat: PlayerStat) => {
    if (!save) return;
    upgradePlayerStat(save.id, stat, save.playerName ?? undefined);
    setVersion((value) => value + 1);
  };

  return (
    <div className="flex-1 p-6 md:p-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <UserRound className="h-6 w-6" />
              <h1 className="text-3xl font-black uppercase">Character</h1>
            </div>
            <p className="text-muted-foreground">Your fourth-presenter RPG sheet for the campaign. Choices, trivia, repairs, and trials now earn XP.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {save && (
              <Link href={continueHref}>
                <Button className="uppercase font-bold">
                  <Play className="mr-2 h-4 w-4" /> Continue
                </Button>
              </Link>
            )}
            <Link href="/">
              <Button variant="outline" className="uppercase">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-md border border-border bg-card p-8 text-muted-foreground">Loading character...</div>
        ) : !character ? (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-10 text-center">
            <p className="mb-2 text-lg font-black uppercase">No campaign character yet</p>
            <p className="mx-auto mb-6 max-w-xl text-muted-foreground">Start Series Mode to create and upgrade your character.</p>
            <Link href="/series-start">
              <Button className="uppercase font-bold">Start Series</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
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
              </div>
              <div className="mt-5 rounded-md border border-border bg-muted/30 p-3">
                <p className="text-xs font-bold uppercase text-muted-foreground">Unspent points</p>
                <p className="font-mono text-3xl font-black text-primary">{character.unspentPoints}</p>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
                <Link href={save ? `/series-progress/${save.id}` : "/series-start"} className="rounded-md border border-border bg-muted/20 p-2 hover:border-primary">
                  <Trophy className="mx-auto mb-1 h-4 w-4 text-amber-400" />
                  <p className="font-mono font-black">{campaignState?.completedEpisodes.length ?? 0}</p>
                  <p className="text-muted-foreground">episodes</p>
                </Link>
                <Link href="/inventory" className="rounded-md border border-border bg-muted/20 p-2 hover:border-primary">
                  <Backpack className="mx-auto mb-1 h-4 w-4 text-green-400" />
                  <p className="font-mono font-black">{inventory.reduce((total, item) => total + item.qty, 0)}</p>
                  <p className="text-muted-foreground">items</p>
                </Link>
                <Link href="/badges" className="rounded-md border border-border bg-muted/20 p-2 hover:border-primary">
                  <Award className="mx-auto mb-1 h-4 w-4 text-blue-400" />
                  <p className="font-mono font-black">{unlockedBadges}</p>
                  <p className="text-muted-foreground">badges</p>
                </Link>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {STATS.map((stat) => {
                const value = character.stats[stat.id];
                return (
                  <div key={`${stat.id}-${version}`} className="rounded-md border border-border bg-card p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
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
        )}
      </div>
    </div>
  );
}
