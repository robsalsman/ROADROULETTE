import { Link } from "wouter";
import { ArrowLeft, Award, LockKeyhole, Trophy } from "lucide-react";
import { useListSaves, getListSavesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { loadBadges, type Badge } from "@/data/campaign";
import { cn } from "@/lib/utils";

function latestSeriesSave(saves: any[] | undefined) {
  return [...(saves ?? [])]
    .filter((save) => save.mode === "series")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
}

const CATEGORY_LABEL: Record<Badge["category"], string> = {
  campaign: "Campaign",
  trivia: "Trivia",
  driving: "Driving",
  garage: "Garage",
  inventory: "Inventory",
  survival: "Survival",
};

export default function Badges() {
  const { data: saves, isLoading } = useListSaves({ query: { queryKey: getListSavesQueryKey() } });
  const save = latestSeriesSave(saves);
  const badges = loadBadges(save?.id);
  const unlocked = badges.filter((badge) => badge.unlockedAt || badge.progress >= badge.target).length;

  return (
    <div className="flex-1 p-6 md:p-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <Award className="h-6 w-6" />
              <h1 className="text-3xl font-black uppercase">Badges</h1>
            </div>
            <p className="text-muted-foreground">Campaign achievements for trivia, driving, survival, collecting, and terrible judgement.</p>
          </div>
          <Link href="/">
            <Button variant="outline" className="uppercase">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="rounded-md border border-border bg-card p-8 text-muted-foreground">Loading badges...</div>
        ) : !save ? (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-10 text-center">
            <Trophy className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <p className="mb-2 text-lg font-black uppercase">No campaign badge book yet</p>
            <p className="mx-auto mb-6 max-w-xl text-muted-foreground">Start Series Mode to unlock achievements.</p>
            <Link href="/series-start">
              <Button className="uppercase font-bold">Start Series</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="rounded-md border border-border bg-card p-4">
              <p className="font-black uppercase">Save #{save.id} - {unlocked}/{badges.length} badges unlocked</p>
              <Progress value={(unlocked / badges.length) * 100} className="mt-2" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {badges.map((badge) => {
                const isUnlocked = Boolean(badge.unlockedAt || badge.progress >= badge.target);
                return (
                  <div
                    key={badge.id}
                    className={cn(
                      "rounded-md border bg-card p-4",
                      isUnlocked ? "border-primary" : "border-border opacity-75",
                    )}
                  >
                    <div className="mb-3 flex items-start gap-3">
                      <div className={cn("rounded-md border p-2", isUnlocked ? "border-primary text-primary" : "border-border text-muted-foreground")}>
                        {isUnlocked ? <Award className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase text-muted-foreground">{CATEGORY_LABEL[badge.category]}</p>
                        <h2 className="font-black uppercase">{badge.name}</h2>
                      </div>
                    </div>
                    <p className="mb-3 text-sm text-muted-foreground">{badge.description}</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold uppercase text-muted-foreground">
                        <span>{isUnlocked ? "Unlocked" : "Progress"}</span>
                        <span>{Math.min(badge.progress, badge.target)}/{badge.target}</span>
                      </div>
                      <Progress value={(Math.min(badge.progress, badge.target) / badge.target) * 100} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
