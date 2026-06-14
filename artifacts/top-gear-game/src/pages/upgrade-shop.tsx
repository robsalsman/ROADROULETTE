import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useGetSave, getGetSaveQueryKey, useGetMission, getGetMissionQueryKey, useGetCharacter, getGetCharacterQueryKey, useUpdateSave } from "@workspace/api-client-react";
import { upgradeCost } from "@workspace/economy";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Zap, Settings, Fuel, Shield, Circle, Megaphone, Clover, Gauge } from "lucide-react";
import VehicleSprite from "@/components/VehicleSprite";
import {
  loadGarage,
  loadUpgradeSpend,
  loadUpgrades,
  saveUpgrades,
  adjustedCarStats,
  type UpgradeCat,
  type UpgradeTier,
  type Upgrades,
} from "@/data/garage";
import { canonicalVehicleKey } from "@/data/vehicles";
import { garageApi } from "@/services/garageApi";

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
      { name: "Tune-Up", cost: upgradeCost(180), desc: "Fresh plugs, belts, and timing. A small but honest power gain." },
      { name: "Intake & Exhaust", cost: upgradeCost(450), desc: "The car breathes properly. So does Jeremy, briefly." },
      { name: "Fast Road Cam", cost: upgradeCost(900), desc: "Sharper throttle response with a lumpier idle." },
      { name: "Forged Internals", cost: upgradeCost(1500), desc: "Built to survive proper boost and repeated abuse." },
      { name: "Race Head", cost: upgradeCost(2400), desc: "Serious flow work. Not cheap, not subtle." },
      { name: "Full Race Engine", cost: upgradeCost(3600), desc: "A top-tier rebuild for cars earning their place." },
    ],
  },
  {
    cat: "turbo",
    label: "Turbo",
    icon: <Zap className="w-5 h-5" />,
    color: "border-sky-500/60 bg-sky-500/10 text-sky-300",
    tiers: [
      { name: "Low-Boost Kit", cost: upgradeCost(220), desc: "A cautious turbo setup with manageable lag." },
      { name: "Intercooler", cost: upgradeCost(520), desc: "Cooler charge air, safer pulls, less heroic smoke." },
      { name: "Ball Bearing Turbo", cost: upgradeCost(980), desc: "Fast spool and serious midrange punch." },
      { name: "Boost Controller", cost: upgradeCost(1650), desc: "More precise pressure, more precise trouble." },
      { name: "Hybrid Turbo", cost: upgradeCost(2800), desc: "A large step toward genuinely frightening pace." },
      { name: "Twin Turbo Setup", cost: upgradeCost(4200), desc: "Expensive forced induction for cars with something to prove." },
    ],
  },
  {
    cat: "supercharger",
    label: "Supercharger",
    icon: <Gauge className="w-5 h-5" />,
    color: "border-violet-500/60 bg-violet-500/10 text-violet-300",
    tiers: [
      { name: "Street Pulley", cost: upgradeCost(240), desc: "A mild pulley change for instant low-end shove." },
      { name: "Roots Blower", cost: upgradeCost(560), desc: "Instant torque. Subtle as a brick through a window." },
      { name: "Charge Cooler", cost: upgradeCost(1050), desc: "Keeps the shove from cooking itself." },
      { name: "Twin-Screw Charger", cost: upgradeCost(1800), desc: "Hard launch power with less waiting around." },
      { name: "Race Pulley Set", cost: upgradeCost(3000), desc: "More boost, more belt whine, more tyre bills." },
      { name: "Race Supercharger", cost: upgradeCost(4400), desc: "Massive shove off the line, if the tyres agree." },
    ],
  },
  {
    cat: "suspension",
    label: "Suspension",
    icon: <Settings className="w-5 h-5" />,
    color: "border-blue-500/60 bg-blue-500/10 text-blue-400",
    tiers: [
      { name: "Fresh Dampers", cost: upgradeCost(120), desc: "Basic replacement dampers. No longer bottoms out on speed bumps." },
      { name: "Lowering Springs", cost: upgradeCost(260), desc: "A firmer stance and better launch control." },
      { name: "Sport Suspension", cost: upgradeCost(520), desc: "Better weight transfer and cleaner lane changes." },
      { name: "Adjustable Coilovers", cost: upgradeCost(900), desc: "Proper tuning range for grip and stability." },
      { name: "Corner Balance", cost: upgradeCost(1450), desc: "Gets the chassis working instead of guessing." },
      { name: "Racing Suspension", cost: upgradeCost(2200), desc: "Track-spec setup. Possibly wasted on this road." },
    ],
  },
  {
    cat: "fuel",
    label: "Fuel System",
    icon: <Fuel className="w-5 h-5" />,
    color: "border-green-500/60 bg-green-500/10 text-green-400",
    tiers: [
      { name: "Fuel Filter", cost: upgradeCost(95), desc: "Cleaner fuel delivery. Measurably better economy." },
      { name: "Uprated Pump", cost: upgradeCost(210), desc: "Feeds modest power without drama." },
      { name: "High-Flow Injectors", cost: upgradeCost(430), desc: "Supports harder pulls and cleaner fueling." },
      { name: "Fuel Rail", cost: upgradeCost(760), desc: "More stable pressure for upgraded engines." },
      { name: "Race ECU Map", cost: upgradeCost(1200), desc: "Squeezes power without guessing at the mixture." },
      { name: "Long-Range Race Tank", cost: upgradeCost(1800), desc: "Extra capacity. James considers this the only sensible upgrade." },
    ],
  },
  {
    cat: "bodywork",
    label: "Bodywork",
    icon: <Shield className="w-5 h-5" />,
    color: "border-red-500/60 bg-red-500/10 text-red-400",
    tiers: [
      { name: "Panel Repair", cost: upgradeCost(110), desc: "Straightens the important bits and saves weight where possible." },
      { name: "Bash Plates", cost: upgradeCost(240), desc: "Basic underbody protection. Slightly reassuring." },
      { name: "Strut Bracing", cost: upgradeCost(480), desc: "Tightens the shell without building a tank." },
      { name: "Roll Cage", cost: upgradeCost(820), desc: "Structural reinforcement. Hammond asks if this is necessary." },
      { name: "Lightweight Panels", cost: upgradeCost(1350), desc: "Less mass, more expense, better acceleration." },
      { name: "Full Race Shell", cost: upgradeCost(2100), desc: "Comprehensive preparation. May attract attention from customs." },
    ],
  },
  {
    cat: "tyres",
    label: "Tyres",
    icon: <Circle className="w-5 h-5" />,
    color: "border-purple-500/60 bg-purple-500/10 text-purple-400",
    tiers: [
      { name: "Fresh Road Tyres", cost: upgradeCost(130), desc: "Decent grip in most conditions." },
      { name: "Sport Compound", cost: upgradeCost(300), desc: "Noticeably better launch and braking feel." },
      { name: "Performance Tyres", cost: upgradeCost(580), desc: "Excellent grip. Collectibles practically leap into the car." },
      { name: "Drag Radials", cost: upgradeCost(950), desc: "A proper quarter-mile tyre, not a fashion statement." },
      { name: "Semi-Slicks", cost: upgradeCost(1450), desc: "Maximum dry grip with some road manners left." },
      { name: "Slicks", cost: upgradeCost(2100), desc: "Maximum grip. Questionable for unpaved roads, but impressive." },
    ],
  },
  {
    cat: "nitrous",
    label: "Nitrous",
    icon: <Gauge className="w-5 h-5" />,
    color: "border-cyan-500/60 bg-cyan-500/10 text-cyan-300",
    tiers: [
      { name: "Bottle Mount", cost: upgradeCost(180), desc: "The hardware to start loading small shots." },
      { name: "Dry Shot", cost: upgradeCost(420), desc: "A cautious jet. Enough to wake up a cheap car." },
      { name: "Wet Kit", cost: upgradeCost(820), desc: "More fuel, more oxygen, more trouble." },
      { name: "Progressive Controller", cost: upgradeCost(1350), desc: "Feeds the hit in without instantly vaporising traction." },
      { name: "Direct Port Nitrous", cost: upgradeCost(2100), desc: "Cylinder-by-cylinder lunacy. Supercar bait if the tyres can take it." },
      { name: "Competition Bottle System", cost: upgradeCost(3100), desc: "Big-shot hardware for cars built to take it." },
    ],
  },
  {
    cat: "sponsor",
    label: "Sponsorship",
    icon: <Megaphone className="w-5 h-5" />,
    color: "border-pink-500/60 bg-pink-500/10 text-pink-400",
    tiers: [
      { name: "Local Garage Decal", cost: upgradeCost(120), desc: "A small sticker. A small percentage. It all adds up." },
      { name: "Parts Shop Deal", cost: upgradeCost(280), desc: "Discounts, favours, and one suspicious invoice." },
      { name: "Energy Drink Livery", cost: upgradeCost(560), desc: "Garish, loud, lucrative. Every pound earned is worth more." },
      { name: "Regional Sponsor", cost: upgradeCost(950), desc: "A proper backer with expectations." },
      { name: "Factory Support", cost: upgradeCost(1500), desc: "The accountants begin to smile." },
      { name: "Full Works Team", cost: upgradeCost(2300), desc: "Plastered in logos. The accountants are delighted." },
    ],
  },
  {
    cat: "charm",
    label: "Lucky Charm",
    icon: <Clover className="w-5 h-5" />,
    color: "border-emerald-500/60 bg-emerald-500/10 text-emerald-400",
    tiers: [
      { name: "Fuzzy Dice", cost: upgradeCost(90), desc: "Purely decorative. Definitely improves your final tally." },
      { name: "Lucky Keyring", cost: upgradeCost(190), desc: "Small charm, small bonus, large superstition." },
      { name: "St. Christopher", cost: upgradeCost(390), desc: "Patron saint of travellers. And of bigger bonuses." },
      { name: "Signed Haynes Manual", cost: upgradeCost(680), desc: "Nobody reads it, but it radiates competence." },
      { name: "Golden Spanner", cost: upgradeCost(1100), desc: "A talisman of pure mechanical fortune." },
      { name: "Blessed Toolbox", cost: upgradeCost(1700), desc: "A hefty score bonus with ceremonial nonsense included." },
    ],
  },
];

export const EFFECTS: Record<UpgradeCat, string[]> = {
  engine:    ["Distance per second +7%", "Distance per second +15%", "Distance per second +22%", "Distance per second +30%", "Distance per second +40%", "Distance per second +50%"],
  turbo:     ["High-rpm boost +9%", "High-rpm boost +18%", "High-rpm boost +26%", "High-rpm boost +34%", "High-rpm boost +45%", "High-rpm boost +55%"],
  supercharger:["Launch torque +8%", "Launch torque +16%", "Launch torque +24%", "Launch torque +32%", "Launch torque +41%", "Launch torque +50%"],
  suspension:["Lane switch speed +1", "Lane switch speed +2", "Lane switch speed +3", "Lane switch speed +4", "Lane switch speed +5", "Lane switch speed +6"],
  fuel:      ["Fuel drain -8%", "Fuel drain -15%", "Fuel drain -22%", "Fuel drain -30%", "Fuel drain -40%", "Fuel drain -50%"],
  bodywork:  ["Collision damage -10%", "Collision damage -20%", "Collision damage -30%", "Collision damage -40%", "Collision damage -50%", "Collision damage -60%"],
  tyres:     ["Collectible radius +4px", "Collectible radius +8px", "Collectible radius +12px", "Collectible radius +16px", "Collectible radius +20px", "Collectible radius +24px"],
  nitrous:   ["Drag nitrous shot +18%", "Drag nitrous shot +35%", "Drag nitrous shot +45%", "Drag nitrous shot +55%", "Drag nitrous shot +65%", "Drag nitrous shot +75%"],
  sponsor:   ["Final score +7%", "Final score +15%", "Final score +22%", "Final score +30%", "Final score +40%", "Final score +50%"],
  charm:     ["Final score +GBP 35 per drive", "Final score +GBP 75 per drive", "Final score +GBP 125 per drive", "Final score +GBP 175 per drive", "Final score +GBP 260 per drive", "Final score +GBP 350 per drive"],
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

  const buyTier = async (cat: UpgradeCat, tier: UpgradeTier) => {
    if (!save || !saveId || !activeCarId) return;
    const activeGarageCar = loadGarage(saveId).cars.find((garageCar) => garageCar.id === activeCarId)
      ?? mission?.availableCars?.find((missionCar: { id: number }) => missionCar.id === activeCarId);
    const persistentKey = activeGarageCar ? canonicalVehicleKey(activeGarageCar.name) : null;
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
      if (persistentKey) {
        await garageApi.saveUpgrades(persistentKey, newUpgrades, newSpent, baseCost).catch(() => undefined);
      }
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
    if (persistentKey) {
      await garageApi.saveUpgrades(persistentKey, newUpgrades, newSpent, -diffCost).catch(() => undefined);
    }
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
  const previewStats = activeCar ? adjustedCarStats(activeCar, upgrades) : null;

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
        {previewStats && (
          <div className="ml-auto grid grid-cols-3 gap-2 text-xs">
            {[
              ["Power", previewStats.power],
              ["Reliability", previewStats.reliability],
              ["Off-road", previewStats.offRoad],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-border bg-muted/20 px-3 py-2">
                <p className="font-black uppercase text-muted-foreground">{label}</p>
                <p className="font-mono text-base font-black">{value}/10</p>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-4">
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
                    const tierNum = (idx + 1) as UpgradeTier;
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
