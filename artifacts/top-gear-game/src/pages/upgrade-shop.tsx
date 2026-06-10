import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useGetSave, getGetSaveQueryKey, useGetMission, getGetMissionQueryKey, useGetCharacter, getGetCharacterQueryKey, useUpdateSave } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Zap, Settings, Fuel, Shield, Circle, Megaphone, Clover } from "lucide-react";
import VehicleSprite from "@/components/VehicleSprite";
import {
  loadGarage,
  loadUpgradeSpend,
  loadUpgrades,
  saveUpgrades,
  type UpgradeCat,
  type Upgrades,
} from "@/data/garage";

export interface UpgradeDef {
  cat: UpgradeCat;
  label: string;
  icon: React.ReactNode;
  color: string;
  tiers: { name: string; cost: number; desc: string }[];
}

export const DEFS: UpgradeDef[] = [
  {
    cat: "engine",
    label: "Engine",
    icon: <Zap className="w-5 h-5" />,
    color: "border-orange-500/60 bg-orange-500/10 text-orange-400",
    tiers: [
      { name: "Carburettor Clean", cost: 60, desc: "Minor power improvement. Gets you there slightly faster and angrier." },
      { name: "Turbo Kit", cost: 120, desc: "Substantial boost. Jeremy will approve, at volume." },
      { name: "Racing Engine", cost: 220, desc: "Full engine rebuild. Probably inappropriate for this vehicle." },
    ],
  },
  {
    cat: "suspension",
    label: "Suspension",
    icon: <Settings className="w-5 h-5" />,
    color: "border-blue-500/60 bg-blue-500/10 text-blue-400",
    tiers: [
      { name: "Shock Absorbers", cost: 50, desc: "Basic replacement shocks. No longer bottoms out on speed bumps." },
      { name: "Sport Suspension", cost: 110, desc: "Vastly improved handling. Lane changes become satisfying." },
      { name: "Racing Suspension", cost: 200, desc: "Track-spec setup. Possibly wasted on this road." },
    ],
  },
  {
    cat: "fuel",
    label: "Fuel System",
    icon: <Fuel className="w-5 h-5" />,
    color: "border-green-500/60 bg-green-500/10 text-green-400",
    tiers: [
      { name: "Fuel Filter", cost: 40, desc: "Cleaner fuel delivery. Measurably better economy." },
      { name: "High-Flow Injectors", cost: 90, desc: "Significant efficiency gain. Range nearly doubled." },
      { name: "Long-Range Tank", cost: 170, desc: "Extra capacity. James considers this the only sensible upgrade." },
    ],
  },
  {
    cat: "bodywork",
    label: "Bodywork",
    icon: <Shield className="w-5 h-5" />,
    color: "border-red-500/60 bg-red-500/10 text-red-400",
    tiers: [
      { name: "Bash Plates", cost: 55, desc: "Basic underbody protection. Slightly reassuring." },
      { name: "Roll Cage", cost: 115, desc: "Structural reinforcement. Hammond asks if this is necessary." },
      { name: "Full Armour", cost: 210, desc: "Comprehensive protection. May attract attention from customs." },
    ],
  },
  {
    cat: "tyres",
    label: "Tyres",
    icon: <Circle className="w-5 h-5" />,
    color: "border-purple-500/60 bg-purple-500/10 text-purple-400",
    tiers: [
      { name: "All-Season Tyres", cost: 65, desc: "Decent grip in most conditions. Wider pickup radius." },
      { name: "Performance Tyres", cost: 130, desc: "Excellent grip. Collectibles practically leap into the car." },
      { name: "Slicks", cost: 190, desc: "Maximum grip. Questionable for unpaved roads, but impressive." },
    ],
  },
  {
    cat: "sponsor",
    label: "Sponsorship",
    icon: <Megaphone className="w-5 h-5" />,
    color: "border-pink-500/60 bg-pink-500/10 text-pink-400",
    tiers: [
      { name: "Local Garage Decal", cost: 70, desc: "A small sticker. A small percentage. It all adds up." },
      { name: "Energy Drink Livery", cost: 150, desc: "Garish, loud, lucrative. Every pound earned is worth more." },
      { name: "Full Works Team", cost: 260, desc: "Plastered in logos. The accountants are delighted." },
    ],
  },
  {
    cat: "charm",
    label: "Lucky Charm",
    icon: <Clover className="w-5 h-5" />,
    color: "border-emerald-500/60 bg-emerald-500/10 text-emerald-400",
    tiers: [
      { name: "Fuzzy Dice", cost: 45, desc: "Purely decorative. Definitely improves your final tally." },
      { name: "St. Christopher", cost: 95, desc: "Patron saint of travellers. And of bigger bonuses." },
      { name: "Golden Spanner", cost: 175, desc: "A talisman of pure mechanical fortune. A hefty score bonus." },
    ],
  },
];

export const EFFECTS: Record<UpgradeCat, string[]> = {
  engine:    ["Distance per second +15%", "Distance per second +30%", "Distance per second +50%"],
  suspension:["Lane switch speed +2", "Lane switch speed +4", "Lane switch speed +6"],
  fuel:      ["Fuel drain −15%", "Fuel drain −30%", "Fuel drain −50%"],
  bodywork:  ["Collision damage −20%", "Collision damage −40%", "Collision damage −60%"],
  tyres:     ["Collectible radius +8px", "Collectible radius +16px", "Collectible radius +24px"],
  sponsor:   ["Final score +15%", "Final score +30%", "Final score +50%"],
  charm:     ["Final score +£75 per drive", "Final score +£175 per drive", "Final score +£350 per drive"],
};

export default function UpgradeShop() {
  const { saveId } = useParams();
  const [, setLocation] = useLocation();

  const [upgrades, setUpgrades] = useState<Upgrades>({});
  const [spent, setSpent] = useState(0);
  const [remainingFunds, setRemainingFunds] = useState<number | null>(null);

  const { data: save } = useGetSave(Number(saveId), {
    query: { enabled: !!saveId, queryKey: getGetSaveQueryKey(Number(saveId)) },
  });
  const updateSave = useUpdateSave();
  const { data: character } = useGetCharacter(Number(save?.characterId), {
    query: { enabled: !!save?.characterId, queryKey: getGetCharacterQueryKey(Number(save?.characterId)) },
  });
  const { data: mission } = useGetMission(Number(save?.missionId), {
    query: { enabled: !!save?.missionId, queryKey: getGetMissionQueryKey(Number(save?.missionId)) },
  });

  const activeCarId = save?.carId ?? null;

  useEffect(() => {
    if (!save) return;
    setRemainingFunds(save.funds);
  }, [save]);

  useEffect(() => {
    if (!saveId || !activeCarId) return;
    setUpgrades(loadUpgrades(saveId, activeCarId));
    setSpent(loadUpgradeSpend(saveId, activeCarId));
  }, [saveId, activeCarId]);

  const budget = remainingFunds ?? save?.funds ?? 0;

  const buyTier = async (cat: UpgradeCat, tier: 1 | 2 | 3) => {
    if (!save || !saveId || !activeCarId) return;
    const def = DEFS.find(d => d.cat === cat)!;
    const currentTier = upgrades[cat] ?? 0;
    const targetTierIdx = tier - 1;
    const baseCost = def.tiers[targetTierIdx].cost;
    const prevCost = currentTier > 0 ? def.tiers[currentTier - 1].cost : 0;
    const diffCost = baseCost - prevCost;

    if (currentTier === tier) {
      // Sell (refund)
      const newUpgrades = { ...upgrades };
      delete newUpgrades[cat];
      const newSpent = spent - baseCost;
      const nextFunds = budget + baseCost;
      setUpgrades(newUpgrades);
      setSpent(newSpent);
      setRemainingFunds(nextFunds);
      saveUpgrades(saveId!, activeCarId!, newUpgrades, newSpent);
      await updateSave.mutateAsync({ id: save.id, data: { funds: nextFunds } });
      return;
    }
    if (tier < (upgrades[cat] ?? 0)) return; // can't downgrade
    if (diffCost > budget) return; // can't afford

    const newUpgrades = { ...upgrades, [cat]: tier };
    const newSpent = spent + diffCost;
    const nextFunds = budget - diffCost;
    setUpgrades(newUpgrades);
    setSpent(newSpent);
    setRemainingFunds(nextFunds);
    saveUpgrades(saveId!, activeCarId!, newUpgrades, newSpent);
    await updateSave.mutateAsync({ id: save.id, data: { funds: nextFunds } });
  };

  const handleStart = () => {
    setLocation(`/game/${saveId}`);
  };

  if (!save || !mission) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isSeries = save.mode === "series";
  const driverName = isSeries ? (save.playerName ?? "The Tourist") : (character?.name ?? "Driver");
  const driverInitial = (driverName || "?").charAt(0).toUpperCase();
  const avatarSrc = !isSeries && character
    ? (character.slug === "richard" ? "/images/hammond.png" : `/images/${character.slug}.png`)
    : null;
  const upgradeCount = Object.keys(upgrades).length;
  const activeCar = activeCarId
    ? loadGarage(saveId!).cars.find((garageCar) => garageCar.id === activeCarId)
      ?? mission.availableCars?.find((missionCar: { id: number }) => missionCar.id === activeCarId)
    : null;

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wide">Upgrade Shop</h1>
          <p className="text-sm text-muted-foreground">{mission.location} — spend wisely. Or recklessly. Your call.</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase font-bold text-muted-foreground">Remaining Budget</p>
          <p className={`font-mono text-2xl font-bold ${budget < 100 ? "text-red-400" : "text-green-400"}`}>
            £{budget.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Car info strip */}
      <div className="bg-card/50 border-b border-border px-6 py-3 flex items-center gap-4">
        <VehicleSprite
          vehicle={activeCar}
          className="h-16 w-24 shrink-0"
          label={activeCar ? `${activeCar.year} ${activeCar.name}` : "Selected vehicle"}
        />
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt={driverName}
            className="w-10 h-10 rounded-full border border-primary object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full border border-amber-500 bg-amber-500/20 text-amber-300 text-sm font-black flex items-center justify-center">
            {driverInitial}
          </div>
        )}
        <div>
          <p className="text-sm font-bold">
            {driverName} · {mission.title}
            {isSeries && <span className="ml-1 text-amber-400">· Stage {(save.seriesStageIndex ?? 0) + 1}</span>}
          </p>
          <p className="text-xs text-muted-foreground">Car budget spent · {upgradeCount} upgrade{upgradeCount !== 1 ? "s" : ""} selected</p>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <Button
            onClick={handleStart}
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold uppercase tracking-widest px-8"
          >
            {upgradeCount === 0 ? "Skip Upgrades →" : "Floor It! →"}
          </Button>
        </div>
      </div>

      {/* Upgrades grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {DEFS.map(def => {
            const currentTier = upgrades[def.cat] ?? 0;
            return (
              <motion.div
                key={def.cat}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-xl overflow-hidden"
              >
                <div className={`flex items-center gap-3 px-4 py-3 border-b border-border ${def.color}`}>
                  {def.icon}
                  <span className="font-bold uppercase tracking-wide text-sm">{def.label}</span>
                  {currentTier > 0 && (
                    <span className="ml-auto text-xs font-bold bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                      Tier {currentTier} installed
                    </span>
                  )}
                </div>
                <div className="divide-y divide-border">
                  {def.tiers.map((tier, idx) => {
                    const tierNum = (idx + 1) as 1 | 2 | 3;
                    const isOwned = currentTier === tierNum;
                    const isUpgrade = tierNum > currentTier;
                    const tierCostRaw = tier.cost;
                    const prevCost = currentTier > 0 ? def.tiers[currentTier - 1].cost : 0;
                    const diffCost = tierCostRaw - prevCost;
                    const canAfford = isUpgrade ? diffCost <= budget : true;
                    const isLocked = tierNum < currentTier;

                    return (
                      <div key={tierNum} className={`px-4 py-3 ${isOwned ? "bg-primary/5" : isLocked ? "opacity-40" : ""}`}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div>
                            <p className="text-sm font-bold">{tier.name}</p>
                            <p className="text-xs text-muted-foreground">{tier.desc}</p>
                            <p className="text-xs text-primary mt-1">✦ {EFFECTS[def.cat][idx]}</p>
                          </div>
                          <button
                            disabled={isLocked || (!canAfford && !isOwned)}
                            onClick={() => buyTier(def.cat, tierNum)}
                            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all border ${
                              isOwned
                                ? "border-primary bg-primary/20 text-primary hover:bg-red-500/20 hover:border-red-500 hover:text-red-400"
                                : isLocked
                                ? "border-muted text-muted-foreground cursor-not-allowed"
                                : canAfford
                                ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20"
                                : "border-muted text-muted-foreground opacity-50 cursor-not-allowed"
                            }`}
                          >
                            {isOwned
                              ? "Sell"
                              : isLocked
                              ? "✓"
                              : `£${isUpgrade && currentTier > 0 ? `+${diffCost}` : tierCostRaw}`}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="max-w-6xl mx-auto mt-6 p-4 bg-card border border-border rounded-xl">
          <p className="text-xs text-muted-foreground text-center">
            <strong className="text-foreground">Tip:</strong> Fuel System upgrades are the most reliable investment.
            Engine upgrades get you there faster but the road gets harder. Bodywork forgives mistakes.
            Tyres help you collect resources. Suspension makes it all feel very satisfying.
          </p>
        </div>
      </div>
    </div>
  );
}
