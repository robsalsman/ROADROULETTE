import { Link } from "wouter";
import { useListSaves, getListSavesQueryKey, useDeleteSave } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Play, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

export default function Saves() {
  const queryClient = useQueryClient();
  const { data: saves, isLoading } = useListSaves({
    query: { queryKey: getListSavesQueryKey() }
  });

  const deleteSave = useDeleteSave();

  const handleDelete = async (id: number) => {
    try {
      await deleteSave.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListSavesQueryKey() });
      toast({ title: "Save deleted" });
    } catch (e) {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const getSaveLink = (save: any) => {
    if (save.status === 'completed' || save.status === 'failed') return `/results/${save.id}`;
    const storedRoute = localStorage.getItem(`tgrr-resume-route-${save.id}`);
    if (storedRoute) return storedRoute;
    if (save.status === 'challenge') return `/challenge/${save.id}`;
    if (save.mode === 'series' && (save.status === 'car_selection' || !save.carId)) {
      return `/mission/${save.missionId}?saveId=${save.id}&series=1`;
    }
    return `/game/${save.id}`;
  };

  return (
    <div className="flex-1 p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold uppercase tracking-wide">Saved Journeys</h2>
            <p className="text-muted-foreground">Resume your terrible decisions.</p>
          </div>
          <Link href="/">
            <Button variant="outline" className="uppercase" data-testid="button-back">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-[120px] w-full" />)}
          </div>
        ) : saves?.length === 0 ? (
          <div className="text-center py-20 bg-muted/30 rounded-lg border border-dashed">
            <p className="text-muted-foreground text-lg mb-4">No saved games found.</p>
            <Link href="/character-select">
              <Button className="uppercase">Start New Game</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {saves?.map(save => (
              <Card key={save.id} className="flex flex-col sm:flex-row items-center justify-between p-4 bg-card hover:bg-muted/10 transition-colors" data-testid={`card-save-${save.id}`}>
                <div className="flex-1 flex items-center gap-6 mb-4 sm:mb-0">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold uppercase text-lg">Save #{save.id}</span>
                      <span className="text-xs px-2 py-1 bg-muted rounded uppercase font-bold text-muted-foreground">
                        {save.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground font-mono">
                      Started: {format(new Date(save.createdAt), "MMM d, yyyy HH:mm")}
                    </p>
                    <div className="flex gap-4 text-sm mt-2">
                      <span className="font-bold text-primary">{save.distanceTravelled}km</span>
                      <span className="font-bold text-green-500">£{save.funds}</span>
                      {save.score > 0 && <span className="font-bold text-accent">Score: {save.score}</span>}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button 
                    variant="destructive" 
                    size="icon" 
                    onClick={() => handleDelete(save.id)}
                    disabled={deleteSave.isPending}
                    data-testid={`button-delete-save-${save.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Link href={getSaveLink(save)} className="flex-1 sm:w-auto">
                    <Button className="w-full uppercase font-bold" data-testid={`button-resume-save-${save.id}`}>
                      <Play className="mr-2 h-4 w-4" /> Resume
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
