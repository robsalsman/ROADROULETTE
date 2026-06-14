import { Link, useLocation } from "wouter";
import { getGetSaveQueryKey, useGetSave } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Home, Save } from "lucide-react";

function getSaveId(path: string): number | null {
  const routeMatch = path.match(/^\/(?:upgrade-shop|game|challenge|results)\/(\d+)/);
  if (routeMatch?.[1]) return Number(routeMatch[1]);

  const queryIndex = path.indexOf("?");
  if (queryIndex < 0) return null;

  const params = new URLSearchParams(path.slice(queryIndex + 1));
  const rawSaveId = params.get("saveId");
  return rawSaveId ? Number(rawSaveId) : null;
}

export default function ExitControls() {
  const [location] = useLocation();
  const fullLocation = `${window.location.pathname}${window.location.search}`;
  const saveId = getSaveId(fullLocation);
  const isHome = fullLocation === "/";
  const hasLocalNavigation = location === "/garage" || location === "/drag-race";

  const { data: save } = useGetSave(Number(saveId), {
    query: { enabled: !!saveId, queryKey: getGetSaveQueryKey(Number(saveId)) },
  });

  if (isHome || hasLocalNavigation) return null;

  const isFinished = save?.status === "completed" || save?.status === "failed";
  const label = saveId && !isFinished ? "Save & Exit" : "Main Menu";
  const Icon = saveId && !isFinished ? Save : Home;

  const handleExit = () => {
    if (!saveId || isFinished) return;
    localStorage.setItem(`tgrr-resume-route-${saveId}`, fullLocation);
  };

  return (
    <div className="fixed left-3 top-3 z-[80]">
      <Link href="/">
        <Button
          variant="outline"
          size="sm"
          className="bg-background/90 backdrop-blur border-border shadow-lg uppercase font-bold"
          data-testid="button-save-exit"
          onClick={handleExit}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Button>
      </Link>
    </div>
  );
}
