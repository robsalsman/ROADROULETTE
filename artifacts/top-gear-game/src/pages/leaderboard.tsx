import { Link } from "wouter";
import { useListLeaderboard, getListLeaderboardQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Trophy, Home, Medal } from "lucide-react";
import { motion } from "framer-motion";

const AVATARS: Record<string, string> = {
  jeremy: "/images/jeremy.png",
  richard: "/images/hammond.png",
  james: "/images/james.png",
};

const RANK_COLORS = ["text-amber-400", "text-slate-300", "text-orange-400"];

export default function Leaderboard() {
  const { data: entries, isLoading } = useListLeaderboard(
    { limit: 50 },
    { query: { queryKey: getListLeaderboardQueryKey({ limit: 50 }) } },
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
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

        <div className="bg-card border border-border rounded-xl overflow-hidden">
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
