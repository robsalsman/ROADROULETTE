import { Link } from "wouter";
import { ArrowLeft, Award, Backpack, CheckCircle2, Circle, Clock, MapPinned, Play, Trophy } from "lucide-react";
import { useListSaves, getListSavesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { GRAND_TOUR_EPISODE_STAGES } from "@/data/grand-tour-episode-stages";
import { loadBadges, loadCampaignState, loadInventory } from "@/data/campaign";
import { cn } from "@/lib/utils";

const COORDS: Record<number, [number, number]> = {
  1: [42, 45], 2: [56, 50], 3: [48, 42], 4: [45, 37], 5: [47, 52], 6: [52, 25],
  7: [51, 72], 8: [52, 74], 9: [44, 37], 10: [32, 58], 11: [47, 43], 12: [48, 39],
  13: [47, 38], 14: [49, 38], 15: [25, 37], 16: [47, 39], 17: [50, 43], 18: [45, 37],
  19: [22, 43], 20: [50, 40], 21: [46, 42], 22: [43, 34], 23: [22, 28], 24: [55, 70],
  25: [23, 39], 26: [30, 60], 27: [30, 60], 28: [45, 37], 29: [52, 26], 30: [70, 47],
  31: [44, 31], 32: [18, 45], 33: [27, 48], 34: [45, 38], 35: [54, 43], 36: [48, 38],
  37: [65, 43], 38: [45, 36], 39: [72, 62], 40: [56, 74], 41: [44, 31], 42: [45, 37],
  43: [52, 23], 44: [50, 38], 45: [49, 64], 46: [53, 73],
};

function latestSeriesSave(saves: any[] | undefined) {
  return [...(saves ?? [])]
    .filter((save) => save.mode === "series")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
}

function continueHref(save: any | undefined) {
  if (!save) return "/series-start";
  if (save.status === "completed" || save.status === "failed") return `/results/${save.id}`;
  if (save.status === "car_selection" || !save.carId) return `/mission/${save.missionId}?saveId=${save.id}&series=1`;
  return `/game/${save.id}`;
}

export default function WorldMap() {
  const { data: saves, isLoading } = useListSaves({ query: { queryKey: getListSavesQueryKey() } });
  const save = latestSeriesSave(saves);
  const campaignState = loadCampaignState(save?.id);
  const badges = loadBadges(save?.id);
  const inventory = loadInventory(save?.id);
  const currentIndex = save ? Math.max(0, Math.min(save.seriesStageIndex ?? 0, GRAND_TOUR_EPISODE_STAGES.length - 1)) : 0;
  const completeCampaign = save?.status === "completed";
  const completedEpisodeIds = new Set(campaignState?.completedEpisodes ?? []);
  const completedCount = completeCampaign
    ? GRAND_TOUR_EPISODE_STAGES.length
    : Math.max(completedEpisodeIds.size, currentIndex);
  const unlockedBadges = badges.filter((badge) => badge.unlockedAt || badge.progress >= badge.target).length;
  const inventoryCount = inventory.reduce((total, item) => total + item.qty, 0);

  return (
    <div className="flex-1 p-6 md:p-12">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <MapPinned className="h-6 w-6" />
              <h1 className="text-3xl font-black uppercase">World Map</h1>
            </div>
            <p className="text-muted-foreground">All 46 Grand Tour episode stages as a campaign route.</p>
          </div>
          <div className="flex gap-2">
            <Link href={continueHref(save)}>
              <Button className="uppercase font-bold">
                <Play className="mr-2 h-4 w-4" /> {save ? "Continue" : "Start Series"}
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="uppercase">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="relative min-h-[520px] overflow-hidden rounded-md border border-border bg-[#101820]">
            <div className="absolute inset-0 bg-[url('/images/bolivia.png')] bg-cover bg-center opacity-25 mix-blend-screen" />
            <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(34,197,94,0.16)_0_18%,transparent_18%_33%,rgba(34,197,94,0.12)_33%_48%,transparent_48%_66%,rgba(34,197,94,0.13)_66%_81%,transparent_81%)] opacity-80" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:64px_64px]" />
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polyline
                points={GRAND_TOUR_EPISODE_STAGES.map((stage) => `${COORDS[stage.id]?.[0] ?? 50},${COORDS[stage.id]?.[1] ?? 50}`).join(" ")}
                fill="none"
                stroke="rgba(251,191,36,0.45)"
                strokeWidth="0.35"
                strokeDasharray="1.4 1.2"
              />
            </svg>
            {GRAND_TOUR_EPISODE_STAGES.map((stage, index) => {
              const [left, top] = COORDS[stage.id] ?? [50, 50];
              const completed = completeCampaign || completedEpisodeIds.has(stage.id) || index < currentIndex;
              const active = !completeCampaign && index === currentIndex;
              return (
                <Link key={stage.id} href={save ? `/series-progress/${save.id}` : "/series-start"}>
                  <button
                    type="button"
                    className={cn(
                      "absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-[10px] font-black shadow-lg transition-transform hover:scale-125",
                      completed
                        ? "border-green-300 bg-green-500 text-black"
                        : active
                          ? "border-primary bg-primary text-black"
                          : "border-zinc-500 bg-zinc-900 text-zinc-300",
                    )}
                    style={{ left: `${left}%`, top: `${top}%` }}
                    title={`Episode ${stage.episodeNumber}: ${stage.title}`}
                  >
                    {stage.episodeNumber}
                  </button>
                </Link>
              );
            })}
          </div>

          <div className="space-y-4">
            <div className="rounded-md border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-amber-400">
                <Trophy className="h-5 w-5" />
                <p className="font-black uppercase">Campaign Status</p>
              </div>
              {isLoading ? (
                <p className="mt-2 text-sm text-muted-foreground">Loading saves...</p>
              ) : save ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Save #{save.id}: episode {Math.min(currentIndex + 1, GRAND_TOUR_EPISODE_STAGES.length)} of {GRAND_TOUR_EPISODE_STAGES.length}.
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No series save yet. Start a campaign to track map progress.</p>
              )}
            </div>

            {save && (
              <div className="grid grid-cols-2 gap-3">
                <Link href={`/series-progress/${save.id}`}>
                  <div className="rounded-md border border-border bg-card p-3 hover:border-primary">
                    <Trophy className="mb-2 h-4 w-4 text-amber-400" />
                    <p className="text-xs font-black uppercase text-muted-foreground">Episodes</p>
                    <p className="font-mono text-xl font-black">{completedCount}/{GRAND_TOUR_EPISODE_STAGES.length}</p>
                  </div>
                </Link>
                <Link href="/character">
                  <div className="rounded-md border border-border bg-card p-3 hover:border-primary">
                    <Clock className="mb-2 h-4 w-4 text-primary" />
                    <p className="text-xs font-black uppercase text-muted-foreground">Journey</p>
                    <p className="font-mono text-xl font-black">D{campaignState?.currentDay ?? 1}</p>
                  </div>
                </Link>
                <Link href="/inventory">
                  <div className="rounded-md border border-border bg-card p-3 hover:border-primary">
                    <Backpack className="mb-2 h-4 w-4 text-green-400" />
                    <p className="text-xs font-black uppercase text-muted-foreground">Inventory</p>
                    <p className="font-mono text-xl font-black">{inventoryCount}</p>
                  </div>
                </Link>
                <Link href="/badges">
                  <div className="rounded-md border border-border bg-card p-3 hover:border-primary">
                    <Award className="mb-2 h-4 w-4 text-blue-400" />
                    <p className="text-xs font-black uppercase text-muted-foreground">Badges</p>
                    <p className="font-mono text-xl font-black">{unlockedBadges}/{badges.length}</p>
                  </div>
                </Link>
              </div>
            )}

            {campaignState && campaignState.discoveredLocations.length > 0 && (
              <div className="rounded-md border border-border bg-card p-4">
                <p className="mb-2 text-xs font-black uppercase text-muted-foreground">Discovered Places</p>
                <div className="flex flex-wrap gap-1.5">
                  {campaignState.discoveredLocations.slice(-8).map((location) => (
                    <span key={location} className="rounded border border-border bg-muted/30 px-2 py-1 text-[10px] font-bold text-muted-foreground">
                      {location}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="max-h-[520px] space-y-2 overflow-auto pr-1">
              {GRAND_TOUR_EPISODE_STAGES.map((stage, index) => {
                const completed = completeCampaign || completedEpisodeIds.has(stage.id) || index < currentIndex;
                const active = !completeCampaign && index === currentIndex;
                return (
                  <div key={stage.id} className={cn("rounded-md border bg-card p-3", active ? "border-primary" : "border-border")}>
                    <div className="flex gap-2">
                      {completed ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" /> : <Circle className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />}
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase text-muted-foreground">Episode {stage.episodeNumber} - S{stage.series}E{stage.episodeInSeries}</p>
                        <p className="truncate font-bold">{stage.title}</p>
                        <p className="text-xs text-muted-foreground">{stage.locationTheme}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
