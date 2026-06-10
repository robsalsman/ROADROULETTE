import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Effect */}
      <div className="absolute inset-0 z-0 bg-[url('/images/bolivia.png')] bg-cover bg-center opacity-20 pointer-events-none mix-blend-overlay"></div>
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-background via-transparent to-transparent pointer-events-none"></div>

      <div className="relative z-10 max-w-2xl w-full space-y-12">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center space-y-4"
        >
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter uppercase text-primary drop-shadow-md">
            Road Roulette
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground uppercase tracking-widest font-mono">
            How hard can it be?
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="flex flex-col gap-4 w-full max-w-sm mx-auto"
        >
          <Link href="/character-select" className="w-full">
            <Button size="lg" className="w-full text-lg uppercase tracking-wide h-14" data-testid="button-arcade-mode">
              Arcade Mode
            </Button>
          </Link>
          <Link href="/series-start" className="w-full">
            <Button size="lg" className="w-full text-lg uppercase tracking-wide h-14 bg-amber-500 text-black hover:bg-amber-400" data-testid="button-series-mode">
              Series Mode
            </Button>
          </Link>
          <Link href="/mini-games" className="w-full">
            <Button size="lg" variant="secondary" className="w-full text-lg uppercase tracking-wide h-14" data-testid="button-mini-games">
              Mini Games
            </Button>
          </Link>
          <Link href="/garage" className="w-full">
            <Button size="lg" variant="secondary" className="w-full text-lg uppercase tracking-wide h-14" data-testid="button-garage">
              Garage
            </Button>
          </Link>
          <Link href="/saves" className="w-full">
            <Button size="lg" variant="outline" className="w-full text-lg uppercase tracking-wide h-14" data-testid="button-continue-game">
              Continue
            </Button>
          </Link>
          <Link href="/leaderboard" className="w-full">
            <Button size="lg" variant="outline" className="w-full text-lg uppercase tracking-wide h-14" data-testid="button-leaderboard">
              Leaderboard
            </Button>
          </Link>
          <Link href="/text-presenter" className="w-full">
            <Button size="lg" variant="outline" className="w-full text-lg uppercase tracking-wide h-14" data-testid="button-text-presenter">
              Text a Presenter
            </Button>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="max-w-sm mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] leading-snug text-muted-foreground"
        >
          <div className="rounded-lg border border-border bg-card/50 p-3">
            <p className="font-bold uppercase text-foreground text-xs mb-1">Arcade</p>
            Pick a presenter and a single stage. One car, one road, one score.
          </div>
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
            <p className="font-bold uppercase text-amber-400 text-xs mb-1">Series</p>
            Join the lads as the fourth member. Drive every stage, money &amp; kit carry over.
          </div>
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
            <p className="font-bold uppercase text-primary text-xs mb-1">Mini Games</p>
            Jump straight into Road Trials like ski slalom, river runs, and repair chaos.
          </div>
        </motion.div>
      </div>
    </div>
  );
}
