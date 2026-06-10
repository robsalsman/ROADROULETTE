import type { EventChoice, RoadEventTemplate } from "@/data/roadEvents";

type MissionLike = {
  id: number;
  title: string;
  location?: string | null;
};

const TERRAIN_HINTS: Record<string, string[]> = {
  desert: ["dust track", "dry riverbed", "salt road"],
  snow: ["icy pass", "forest road", "frozen service track"],
  water: ["river channel", "dockside road", "ferry ramp"],
  jungle: ["logging track", "mud road", "village path"],
  mountain: ["high pass", "switchback road", "valley shortcut"],
  coastal: ["beach road", "harbour road", "causeway"],
  urban: ["industrial road", "market street", "ring road"],
  farm: ["farm lane", "tractor track", "service road"],
  track: ["test route", "service lane", "timed section"],
  road: ["main road", "back road", "old highway"],
  mixed: ["back road", "rough track", "market road"],
};

function routeNoun(terrain?: string | null, index = 0) {
  const key = (terrain ?? "road").toLowerCase();
  const options = TERRAIN_HINTS[key] ?? TERRAIN_HINTS.road;
  return options[index % options.length];
}

function choice(
  id: string,
  proposer: EventChoice["proposer"],
  label: string,
  flavor: string,
  risk: EventChoice["risk"],
  outcome: string,
  distanceEffect: number,
  damageEffect: number,
  fundsEffect = 0,
  timeEffectHours = 2,
): EventChoice {
  return {
    id,
    proposer,
    label,
    flavor,
    risk,
    outcome,
    distanceEffect,
    damageEffect,
    fundsEffect,
    timeEffectHours,
  };
}

export function buildNavigationPrompt(mission: MissionLike, terrain?: string | null, turn = 0): RoadEventTemplate {
  const place = mission.location ?? mission.title;
  const routeA = routeNoun(terrain, turn);
  const routeB = routeNoun(terrain, turn + 1);
  const routeC = routeNoun(terrain, turn + 2);

  return {
    id: `nav-${mission.id}-${turn}`,
    type: "navigation",
    title: "Pick The Route",
    situation: `The convoy has reached a junction outside ${place}. The map, the satnav, and local advice all disagree. Naturally, everyone is completely certain they are right.`,
    choices: [
      choice(
        `steady-${turn}`,
        "james",
        `Take the sensible ${routeA}`,
        "Measured, boring, and annoyingly defensible.",
        "safe",
        `You take the ${routeA}. It is slower than promised but the car remains in one piece and tempers mostly stay under control.`,
        45,
        0,
        0,
        3,
      ),
      choice(
        `shortcut-${turn}`,
        "richard",
        `Try the local ${routeB}`,
        "A shortcut in the heroic sense, meaning it may be longer.",
        "risky",
        `The ${routeB} is rough and occasionally imaginary, but it cuts a useful chunk off the stage.`,
        65,
        -12,
        0,
        2,
      ),
      choice(
        `attack-${turn}`,
        "jeremy",
        `Attack the ${routeC}`,
        "Speed, noise, confidence, and consequences.",
        "mad",
        `The ${routeC} is tackled with entirely too much enthusiasm. Progress is excellent. Several mechanical components file complaints.`,
        85,
        -24,
        20,
        1,
      ),
    ],
  };
}

export function buildForwardPrompt(mission: MissionLike, turn = 0): RoadEventTemplate {
  return {
    id: `forward-${mission.id}-${turn}`,
    type: "forward",
    title: "Choose The Next Push",
    situation:
      "The immediate problem has been dealt with. The road ahead is open for the moment, so the group needs to decide how to spend the next stretch.",
    choices: [
      choice(
        `drive-${turn}`,
        "jeremy",
        "Turn it into a driving challenge",
        "Because if there is a road, there is a race.",
        "mad",
        "The group agrees this should become a proper timed driving section.",
        0,
        0,
        0,
        1,
      ),
      choice(
        `quiz-${turn}`,
        "james",
        "Settle it with a pub quiz",
        "Facts, points, and unbearable smugness.",
        "safe",
        "The next stretch becomes a rolling trivia argument with money and pride at stake.",
        0,
        0,
        0,
        1,
      ),
      choice(
        `press-${turn}`,
        "richard",
        "Press on and cover miles",
        "No ceremony. Just road, fuel, and minor fear.",
        "risky",
        "The convoy pushes onward without stopping, accepting wear and fuel burn for steady progress.",
        0,
        0,
        0,
        2,
      ),
    ],
  };
}
