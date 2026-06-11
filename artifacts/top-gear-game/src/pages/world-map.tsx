import { Link } from "wouter";
import { ArrowLeft, Award, Backpack, CheckCircle2, Circle, Clock, MapPinned, Play, Trophy } from "lucide-react";
import { geoEquirectangular, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import worldAtlas from "world-atlas/countries-110m.json";
import { useListSaves, getListSavesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { GRAND_TOUR_EPISODE_STAGES } from "@/data/grand-tour-episode-stages";
import { loadBadges, loadCampaignState, loadInventory } from "@/data/campaign";
import { cn } from "@/lib/utils";

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 520;
const MAP_PADDING = 18;

type EpisodeGeo = {
  lat: number;
  lon: number;
  label: string;
};

const EPISODE_GEO: Record<number, EpisodeGeo> = {
  1: { lat: 39.5, lon: -8, label: "Portugal launch route" },
  2: { lat: 31, lon: 36, label: "Jordan special forces course" },
  3: { lat: 45.4, lon: 10, label: "Northern Italy grand tour" },
  4: { lat: 52.3, lon: -3.7, label: "Wales rally terrain" },
  5: { lat: 31.8, lon: -7.1, label: "Morocco desert crossing" },
  6: { lat: 64, lon: 26, label: "Finland winter roads" },
  7: { lat: -22.6, lon: 14.5, label: "Namibia beach buggies" },
  8: { lat: -17.2, lon: 13.5, label: "Namibia and Angola border" },
  9: { lat: 52, lon: -1.5, label: "British SUV proving ground" },
  10: { lat: 13.2, lon: -59.5, label: "Barbados reef challenge" },
  11: { lat: 49.5, lon: 0.1, label: "French coast run" },
  12: { lat: 48.5, lon: 11, label: "German road trip" },
  13: { lat: 52, lon: -1, label: "UK test circuit" },
  14: { lat: 46.8, lon: 8.2, label: "Swiss Alps" },
  15: { lat: 43.1, lon: -79, label: "Niagara Falls" },
  16: { lat: 44.5, lon: 7.5, label: "Alpine sports car route" },
  17: { lat: 45.1, lon: 15.2, label: "Croatia grand tour" },
  18: { lat: 52.5, lon: -1.8, label: "English farm course" },
  19: { lat: 39.1, lon: -108.6, label: "Colorado road trip" },
  20: { lat: 45, lon: 10, label: "European rally history" },
  21: { lat: 42.5, lon: 1.2, label: "Pau to Barcelona" },
  22: { lat: 52, lon: 1, label: "British amphibious roads" },
  23: { lat: 51, lon: -116, label: "Canadian mountains" },
  24: { lat: -26, lon: 32.6, label: "Mozambique coast" },
  25: { lat: 42.3, lon: -83, label: "Detroit muscle" },
  26: { lat: 4.6, lon: -74.1, label: "Colombia roads" },
  27: { lat: 5, lon: -75.5, label: "Colombian mountains" },
  28: { lat: 52.3, lon: -3.7, label: "Welsh test route" },
  29: { lat: 62, lon: 15, label: "Swedish snow route" },
  30: { lat: 29.6, lon: 106.6, label: "Chongqing, China" },
  31: { lat: 57.5, lon: -4, label: "Scottish Highlands" },
  32: { lat: 38.8, lon: -116.4, label: "Nevada desert" },
  33: { lat: 28.5, lon: -81, label: "Florida road trip" },
  34: { lat: 52, lon: -1.2, label: "British hot hatch route" },
  35: { lat: 41.7, lon: 44.8, label: "Georgia and Azerbaijan" },
  36: { lat: 50.1, lon: 8.6, label: "German performance test" },
  37: { lat: 46.8, lon: 103, label: "Mongolia" },
  38: { lat: 52, lon: -1, label: "Ford tribute route" },
  39: { lat: 11.6, lon: 105, label: "Mekong Delta" },
  40: { lat: -20.9, lon: 47, label: "Reunion and Madagascar" },
  41: { lat: 56.8, lon: -4.2, label: "Scotland lockdown route" },
  42: { lat: 52.4, lon: -2, label: "British caravanning route" },
  43: { lat: 66, lon: 20, label: "Scandinavian Arctic Circle" },
  44: { lat: 49, lon: 18, label: "Central Europe road trip" },
  45: { lat: 20, lon: -12, label: "Mauritania and Senegal" },
  46: { lat: -20, lon: 26, label: "Zimbabwe and Botswana finale" },
};

const worldAtlasData = worldAtlas as any;
const worldCountries = (
  feature(worldAtlasData, worldAtlasData.objects.countries) as unknown as { features: any[] }
).features;
const mapProjection = geoEquirectangular().fitExtent(
  [
    [MAP_PADDING, MAP_PADDING],
    [MAP_WIDTH - MAP_PADDING, MAP_HEIGHT - MAP_PADDING],
  ],
  { type: "Sphere" },
);
const worldPath = geoPath(mapProjection);

function projectGeo({ lat, lon }: EpisodeGeo) {
  const projected = mapProjection([lon, lat]) ?? [MAP_WIDTH / 2, MAP_HEIGHT / 2];
  const [x, y] = projected;
  return {
    x,
    y,
    left: `${(x / MAP_WIDTH) * 100}%`,
    top: `${(y / MAP_HEIGHT) * 100}%`,
  };
}

const routePoints = GRAND_TOUR_EPISODE_STAGES.map((stage) => {
  const geo = EPISODE_GEO[stage.id] ?? { lat: 0, lon: 0, label: "Episode location" };
  const point = projectGeo(geo);
  return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
}).join(" ");

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

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
          <div className="relative h-[360px] min-w-0 overflow-hidden rounded-md border border-border bg-[#061722] shadow-2xl sm:h-[460px] lg:h-[560px]">
            <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <radialGradient id="mapOcean" cx="50%" cy="42%" r="72%">
                  <stop offset="0%" stopColor="#12394b" />
                  <stop offset="58%" stopColor="#082433" />
                  <stop offset="100%" stopColor="#041018" />
                </radialGradient>
                <linearGradient id="mapLand" x1="0%" x2="100%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="#2f6f48" />
                  <stop offset="48%" stopColor="#234932" />
                  <stop offset="100%" stopColor="#172f24" />
                </linearGradient>
                <filter id="landShadow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#000" floodOpacity="0.35" />
                </filter>
              </defs>
              <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#mapOcean)" />
              <g opacity="0.16" stroke="#c7f9ff" strokeWidth="1">
                {Array.from({ length: 13 }, (_, i) => (
                  <line key={`lon-${i}`} x1={(i * MAP_WIDTH) / 12} x2={(i * MAP_WIDTH) / 12} y1="0" y2={MAP_HEIGHT} />
                ))}
                {Array.from({ length: 7 }, (_, i) => (
                  <line key={`lat-${i}`} x1="0" x2={MAP_WIDTH} y1={(i * MAP_HEIGHT) / 6} y2={(i * MAP_HEIGHT) / 6} />
                ))}
              </g>
              <g filter="url(#landShadow)">
                {worldCountries.map((country, index) => (
                  <path
                    key={index}
                    d={worldPath(country) ?? undefined}
                    fill="url(#mapLand)"
                    stroke="#5a8f68"
                    strokeWidth="0.65"
                    opacity="0.92"
                  />
                ))}
              </g>
              <polyline
                points={routePoints}
                fill="none"
                stroke="rgba(0,0,0,0.28)"
                strokeWidth="8"
                strokeDasharray="10 9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points={routePoints}
                fill="none"
                stroke="rgba(251,191,36,0.58)"
                strokeWidth="3"
                strokeDasharray="10 9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="absolute left-4 top-4 max-w-[260px] rounded border border-white/10 bg-black/45 p-3 backdrop-blur">
              <p className="text-xs font-black uppercase tracking-wide text-primary">Episode Atlas</p>
              <p className="text-xs text-zinc-300">Pins use approximate real-world filming and challenge locations.</p>
            </div>
            {GRAND_TOUR_EPISODE_STAGES.map((stage, index) => {
              const geo = EPISODE_GEO[stage.id] ?? { lat: 0, lon: 0, label: "Episode location" };
              const point = projectGeo(geo);
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
                    style={{ left: point.left, top: point.top, zIndex: active ? 30 : completed ? 20 : 10 }}
                    title={`Episode ${stage.episodeNumber}: ${stage.title} - ${geo.label}`}
                  >
                    {stage.episodeNumber}
                  </button>
                </Link>
              );
            })}
          </div>

          <div className="min-w-0 space-y-4">
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
