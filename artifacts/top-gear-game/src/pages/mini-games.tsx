import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import JaguarSkiSlalomGame from "@/components/JaguarSkiSlalomGame";
import { Car, Flag, Gauge, Lock, Mountain, Waves, Wrench } from "lucide-react";

const trials = [
  {
    title: "Jaguar Ski Slalom",
    description: "Slide a questionable Jaguar down a snowy slalom course. Built for portrait play.",
    href: "/mini-games/jaguar-ski-slalom",
    icon: Mountain,
    status: "Playable",
  },
  {
    title: "Road Jump Challenge",
    description: "The current side-scrolling collect-and-jump driving trial used during journeys.",
    href: "/character-select",
    icon: Car,
    status: "In Arcade",
  },
  {
    title: "Garage Drag Race",
    description: "Stage your persistent garage car, tune it, launch it, shift it, and bank credits.",
    href: "/drag-race",
    icon: Gauge,
    status: "Playable",
  },
  {
    title: "Final Timing Challenge",
    description: "Sweet-spot launch timing used by the older final challenge flow.",
    href: "/missions",
    icon: Gauge,
    status: "In Stages",
  },
];

const comingSoon = [
  { title: "River Boat Run", icon: Waves },
  { title: "Repair Bench", icon: Wrench },
  { title: "Border Bluff", icon: Flag },
];

export default function MiniGames() {
  const [location] = useLocation();

  if (location === "/mini-games/jaguar-ski-slalom") {
    return <JaguarSkiSlalomGame />;
  }

  return (
    <div className="flex-1 bg-background p-6">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-primary">Quick Play</p>
            <h1 className="text-4xl font-black uppercase tracking-tight">Mini Games</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Standalone Road Trials for testing and quick chaos outside Arcade and Series Mode.
            </p>
          </div>
          <Link href="/">
            <Button variant="outline" className="uppercase font-bold">Main Menu</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {trials.map((trial) => {
            const Icon = trial.icon;
            return (
              <Card key={trial.title} className="flex flex-col border-2 border-transparent hover:border-primary/60 transition-colors">
                <CardHeader>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="uppercase">{trial.title}</CardTitle>
                  <p className="text-xs font-bold uppercase tracking-widest text-primary">{trial.status}</p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <p className="flex-1 text-sm text-muted-foreground">{trial.description}</p>
                  <Link href={trial.href}>
                    <Button className="w-full uppercase font-bold">
                      {trial.status === "Playable" ? "Play" : "Open"}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-black uppercase tracking-tight">Next Trials</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {comingSoon.map((trial) => {
              const Icon = trial.icon;
              return (
                <div key={trial.title} className="flex items-center gap-3 rounded-md border border-border bg-card/60 p-4 text-muted-foreground">
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="font-bold uppercase">{trial.title}</span>
                  <Lock className="ml-auto h-4 w-4" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
