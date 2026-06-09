import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ExitControls from "@/components/ExitControls";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
import CharacterSelect from "@/pages/character-select";
import SeriesStart from "@/pages/series-start";
import SeriesProgress from "@/pages/series-progress";
import Missions from "@/pages/missions";
import MissionDetail from "@/pages/mission-detail";
import UpgradeShop from "@/pages/upgrade-shop";
import Game from "@/pages/game";
import Challenge from "@/pages/challenge";
import Results from "@/pages/results";
import Saves from "@/pages/saves";
import Leaderboard from "@/pages/leaderboard";
import PresenterChat from "@/pages/presenter-chat";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/character-select" component={CharacterSelect} />
      <Route path="/series-start" component={SeriesStart} />
      <Route path="/series-progress/:saveId" component={SeriesProgress} />
      <Route path="/missions" component={Missions} />
      <Route path="/mission/:id" component={MissionDetail} />
      <Route path="/upgrade-shop/:saveId" component={UpgradeShop} />
      <Route path="/game/:saveId" component={Game} />
      <Route path="/challenge/:saveId" component={Challenge} />
      <Route path="/results/:saveId" component={Results} />
      <Route path="/saves" component={Saves} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/text-presenter" component={PresenterChat} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <div className="min-h-[100dvh] bg-background text-foreground flex flex-col font-sans selection:bg-primary selection:text-primary-foreground">
            <ExitControls />
            <main className="flex-1 flex flex-col">
              <Router />
            </main>
          </div>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
