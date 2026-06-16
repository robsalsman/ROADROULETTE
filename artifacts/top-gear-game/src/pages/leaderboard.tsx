import { Link } from "wouter";
import { useListLeaderboard, getListLeaderboardQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Trophy, Home, Medal, Gauge } from "lucide-react";
import { motion } from "framer-motion";
import DriverLoginPanel from "@/components/DriverLoginPanel";
import { garageApi } from "@/services/garageApi";
import { driverScopedQueryKey } from "@/data/driverIdentity";

const AVATARS: Record<string, string> = {
  jeremy: "/images/jeremy.png",
  richard: "/images/hammond.png",
  james: "/images/james.png",
};

const RANK_COLORS = ["text-amber-400", "text-slate-300", "text-orange-400"];

function formatTime(ms: number): string {
  return `${(ms / 1000).toFixed(3)}s`;
}

function carLabel(canonicalKey: string): string {
  return canonicalKey
    .split("-")
    .map((part) => part.length <= 3 ? part.toUpperCase() : `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export default function Leaderboard() {
  const { data: entries, isLoading } = useListLeaderboard(
    { limit: 50 },
    { query: { queryKey: getListLeaderboardQueryKey({ limit: 50 }) } },
  );
  const { data: dragEntries, isLoading: isLoadingDrag } = useQuery({
    queryKey: ["drag-leaderboard", "global"],
    queryFn: () => garageApi.dragLeaderboard({ limit: 50 }),
  });
  const { data: myDragEntries, isLoading: isLoadingMine } = useQuery({
    queryKey: driverScopedQueryKey("drag-leaderboard-mine"),
    queryFn: () => garageApi.dragLeaderboard({ limit: 20, scope: "mine" }),
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-8 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border-4 border-primary bg-primary/10">
            <Trophy className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold uppercase tracking-tighter">Hall of Fame</h1>
          <p className="text-muted-foreground">The greatest road trips ever attempted. Allegedly.</p>
        </motion.div>

        <DriverLoginPanel />

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border p-4">
              <Gauge className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-black uppercase">Drag Strip Board</h2>
                <p className="text-xs text-muted-foreground">Fastest verified garage runs from every driver code.</p>
              </div>
            </div>
            {isLoadingDrag ? (
              <div className="py-16 flex justify-center">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !dragEntries || dragEntries.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Medal className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-bold">No drag records yet.</p>
                <p className="text-sm">Win a garage drag race to post a time.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {dragEntries.map((entry, i) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.5) }}
                    className="grid grid-cols-[2rem_1fr_auto] gap-3 px-4 py-3"
                  >
                    <span className={`font-mono font-black text-lg text-center ${RANK_COLORS[i] ?? "text-muted-foreground"}`}>
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{entry.driverName}</p>
                      <p className="truncate text-xs text-muted-foreground">{carLabel(entry.canonicalVehicleKey)} vs {entry.opponentName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-lg font-black text-primary">{formatTime(entry.elapsedMs)}</p>
                      <p className="text-[10px] text-muted-foreground">{entry.trapSpeed} mph</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border p-4">
              <Medal className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-black uppercase">My Drag Times</h2>
                <p className="text-xs text-muted-foreground">Records for the active driver code.</p>
              </div>
            </div>
            {isLoadingMine ? (
              <div className="py-12 flex justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !myDragEntries || myDragEntries.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <p className="font-bold">No personal times yet.</p>
                <p className="text-sm">Enter a driver code and win a race.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {myDragEntries.map((entry, i) => (
                  <div key={entry.id} className="grid grid-cols-[2rem_1fr_auto] gap-3 px-4 py-3">
                    <span className="font-mono font-black text-muted-foreground">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{carLabel(entry.canonicalVehicleKey)}</p>
                      <p className="truncate text-xs text-muted-foreground">vs {entry.opponentName} - GBP {entry.rewardCredits.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-black text-primary">{formatTime(entry.elapsedMs)}</p>
                      <p className="text-[10px] text-muted-foreground">{entry.trapSpeed} mph</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border p-4">
            <Trophy className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-black uppercase">Road Trip Hall of Fame</h2>
              <p className="text-xs text-muted-foreground">Original Series and Arcade score board.</p>
            </div>
          </div>
          {isLoading ? (
            <div className="py-16 flex justify-center">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !entries || entries.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Medal className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold">No legends yet.</p>
              <p className="text-sm">Complete a journey to claim the top spot.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {entries.map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.5) }}
                  className="px-4 py-3 flex items-center gap-4"
                >
                  <span className={`font-mono font-black text-lg w-8 text-center shrink-0 ${RANK_COLORS[i] ?? "text-muted-foreground"}`}>
                    {i + 1}
                  </span>
                  <img
                    src={AVATARS[entry.characterSlug ?? "jeremy"] ?? "/images/jeremy.png"}
                    alt={entry.playerName}
                    className="w-10 h-10 rounded-full border border-border object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{entry.playerName}</p>
                    <p className="text-xs text-muted-foreground truncate">{entry.missionTitle || "An unknown road"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono font-bold text-primary text-lg">{entry.score.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">{entry.distance} km</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-center pb-4">
          <Link href="/">
            <Button size="lg" variant="outline" className="uppercase font-bold px-10 h-14 tracking-widest">
              <Home className="mr-2 h-5 w-5" />
              Main Menu
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
