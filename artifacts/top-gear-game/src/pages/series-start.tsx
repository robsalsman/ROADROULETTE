import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useListMissions, getListMissionsQueryKey, useCreateSave } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Trophy, ChevronLeft, Flag } from "lucide-react";
import { initializeCampaignSave, PLAYER_STYLES, type PlayerStyle } from "@/data/campaign";

export default function SeriesStart() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [style, setStyle] = useState<PlayerStyle>("balanced");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const { data: missions } = useListMissions({
    query: { queryKey: getListMissionsQueryKey() },
  });
  const createSave = useCreateSave();

  const stages = [...(missions ?? [])].sort((a, b) => a.id - b.id);

  const handleStart = async () => {
    const clean = name.trim();
    if (!clean) { setError("Go on, give yourself a name."); return; }
    if (stages.length === 0) { setError("No stages available."); return; }
    setStarting(true);
    setError("");
    try {
      const first = stages[0];
      const save = await createSave.mutateAsync({
        data: {
          missionId: first.id,
          mode: "series",
          playerName: clean.slice(0, 40),
          seriesStageIndex: 0,
        },
      });
      initializeCampaignSave(save.id, clean.slice(0, 40), style);
      setLocation(`/mission/${first.id}?saveId=${save.id}&series=1`);
    } catch {
      setError("Couldn't start the series. Try again.");
      setStarting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 z-0 bg-[url('/images/vietnam.png')] bg-cover bg-center opacity-20 pointer-events-none mix-blend-overlay" />
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-background via-transparent to-transparent pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-lg space-y-8"
      >
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-4 h-4" /> Back
        </Link>

        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border-4 border-amber-500 bg-amber-500/10">
            <Trophy className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-4xl font-bold uppercase tracking-tighter">The Grand Series</h1>
          <p className="text-muted-foreground">
            You're the fourth member of the team. Drive every stage with Clarkson, Hammond and May.
            Buy a fresh car each leg, but your money, supplies, upgrades and camaraderie carry over.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your name</label>
            <Input
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleStart(); }}
              maxLength={40}
              placeholder="e.g. The New Bloke"
              data-testid="input-series-name"
              autoFocus
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Driver style</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(PLAYER_STYLES).map(([key, option]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStyle(key as PlayerStyle)}
                  className={`rounded-md border p-3 text-left transition-colors ${
                    style === key
                      ? "border-amber-400 bg-amber-500/15 text-amber-100"
                      : "border-border bg-muted/30 hover:border-muted-foreground"
                  }`}
                >
                  <span className="block text-sm font-black uppercase">{option.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{option.description}</span>
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleStart}
            disabled={starting}
            size="lg"
            data-testid="button-start-series"
            className="w-full uppercase font-bold tracking-widest bg-amber-500 text-black hover:bg-amber-400"
          >
            {starting ? "Loading the convoy..." : "Begin the Series ->"}
          </Button>
        </div>

        {stages.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Flag className="w-3 h-3" /> {stages.length} stages ahead
            </p>
            <div className="flex flex-wrap gap-2">
              {stages.map((m, i) => (
                <span key={m.id} className="text-[11px] px-2 py-1 rounded-full border border-border bg-card text-muted-foreground">
                  {i + 1}. {m.title}
                </span>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
