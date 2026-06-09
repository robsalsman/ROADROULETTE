import { Link, useParams } from "wouter";
import { getGetSaveQueryKey, getListMissionsQueryKey, useGetSave, useListMissions } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { GRAND_TOUR_EPISODE_STAGES } from "@/data/grand-tour-episode-stages";
import { CheckCircle2, Circle, Flag, Play, Trophy } from "lucide-react";

export default function SeriesProgress() {
  const { saveId } = useParams();
  const { data: save } = useGetSave(Number(saveId), {
    query: { enabled: !!saveId, queryKey: getGetSaveQueryKey(Number(saveId)) },
  });
  const { data: missions } = useListMissions({
    query: { queryKey: getListMissionsQueryKey() },
  });

  if (!save) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentIndex = Math.max(0, Math.min(save.seriesStageIndex ?? 0, GRAND_TOUR_EPISODE_STAGES.length - 1));
  const currentStage = GRAND_TOUR_EPISODE_STAGES[currentIndex];
  const nextStage = GRAND_TOUR_EPISODE_STAGES[currentIndex + 1];
  const mission = missions?.find((item) => item.id === save.missionId);
  const progressPct = Math.round((currentIndex / GRAND_TOUR_EPISODE_STAGES.length) * 100);
  const continueHref =
    save.status === "car_selection" || !save.carId
      ? `/mission/${save.missionId}?saveId=${save.id}&series=1`
      : `/game/${save.id}`;

  return (
    <div className="flex-1 p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-bold uppercase tracking-widest">
            <Trophy className="w-4 h-4" />
            Grand Tour Episode Campaign
          </div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
                Episode {currentStage.episodeNumber}: {currentStage.title}
              </h1>
              <p className="text-muted-foreground">
                Series {currentStage.series}, episode {currentStage.episodeInSeries} - released {currentStage.releaseDate}
              </p>
            </div>
            <Link href={continueHref}>
              <Button className="uppercase font-bold" data-testid="button-continue-series">
                <Play className="h-4 w-4" /> Continue
              </Button>
            </Link>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs uppercase font-bold text-muted-foreground">
              <span>{currentIndex} completed</span>
              <span>{GRAND_TOUR_EPISODE_STAGES.length} episodes</span>
            </div>
            <Progress value={progressPct} />
          </div>
        </div>

        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start gap-3">
              <Flag className="h-5 w-5 text-primary mt-1" />
              <div>
                <p className="font-bold uppercase">{mission?.location ?? currentStage.locationTheme}</p>
                <p className="text-sm text-muted-foreground">{currentStage.challengeInspiration}</p>
                {nextStage && (
                  <p className="text-sm text-amber-400 mt-2">
                    Next unlock: Episode {nextStage.episodeNumber}, {nextStage.title}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {GRAND_TOUR_EPISODE_STAGES.map((stage, index) => {
            const completed = index < currentIndex || save.status === "completed";
            const active = index === currentIndex && save.status !== "completed";
            return (
              <div
                key={stage.id}
                className={`border rounded-lg p-4 bg-card flex gap-3 ${active ? "border-primary" : "border-border"}`}
              >
                {completed ? (
                  <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                ) : (
                  <Circle className={`h-5 w-5 shrink-0 mt-0.5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                )}
                <div className="min-w-0">
                  <p className="text-xs uppercase font-bold text-muted-foreground">
                    Episode {stage.episodeNumber} - Series {stage.series}.{stage.episodeInSeries}
                  </p>
                  <p className="font-bold truncate">{stage.title}</p>
                  <p className="text-xs text-muted-foreground">{stage.releaseDate} - {stage.locationTheme}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
