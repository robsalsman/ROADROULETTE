import { GRAND_TOUR_EPISODE_STAGES } from "@/data/grand-tour-episode-stages";

export interface TriviaQuestion {
  id: string;
  question: string;
  options: string[];
  answer: number;
}

export const TRIVIA: TriviaQuestion[] = [
  {
    id: "t1",
    question: "What does 'BHP' stand for?",
    options: ["Brake Horse Power", "British Horse Power", "Boosted High Pressure", "Big Heavy Pistons"],
    answer: 0,
  },
  {
    id: "t2",
    question: "Which country is the car maker Koenigsegg from?",
    options: ["Germany", "Italy", "Sweden", "Norway"],
    answer: 2,
  },
  {
    id: "t3",
    question: "What is the best-selling car of all time?",
    options: ["Volkswagen Beetle", "Toyota Corolla", "Ford Model T", "Honda Civic"],
    answer: 1,
  },
  {
    id: "t4",
    question: "In a manual car, what does the clutch pedal do?",
    options: ["Applies the brakes", "Disengages the engine from the wheels", "Increases fuel flow", "Locks the differential"],
    answer: 1,
  },
  {
    id: "t5",
    question: "What does 'torque' measure?",
    options: ["Top speed", "Rotational force", "Fuel economy", "Tyre grip"],
    answer: 1,
  },
  {
    id: "t6",
    question: "Which luxury brand uses a 'Spirit of Ecstasy' bonnet ornament?",
    options: ["Bentley", "Jaguar", "Rolls-Royce", "Aston Martin"],
    answer: 2,
  },
  {
    id: "t7",
    question: "What colour is traditionally associated with Ferrari racing cars?",
    options: ["British Racing Green", "Rosso Corsa red", "French Blue", "Silver"],
    answer: 1,
  },
  {
    id: "t8",
    question: "What does the warning light shaped like an engine indicate?",
    options: ["Low fuel", "A door is open", "An engine fault", "Time for a service"],
    answer: 2,
  },
  {
    id: "t9",
    question: "Which of these is a hybrid powertrain feature?",
    options: ["A second steering wheel", "Regenerative braking", "Square wheels", "Twin exhausts"],
    answer: 1,
  },
  {
    id: "t10",
    question: "What does 4x4 (four by four) refer to?",
    options: ["Four seats and four doors", "Four-wheel drive", "A 4-litre engine", "Four cup holders"],
    answer: 1,
  },
  {
    id: "t11",
    question: "The Nürburgring, famous for lap times, is in which country?",
    options: ["Belgium", "France", "Germany", "Austria"],
    answer: 2,
  },
  {
    id: "t12",
    question: "What does a turbocharger use to boost power?",
    options: ["Exhaust gases", "Brake fluid", "Window washer fluid", "Static electricity"],
    answer: 0,
  },
  {
    id: "t13",
    question: "Which pedal layout is standard in a UK manual car (left to right)?",
    options: ["Brake, clutch, accelerator", "Clutch, brake, accelerator", "Accelerator, brake, clutch", "Clutch, accelerator, brake"],
    answer: 1,
  },
  {
    id: "t14",
    question: "What is 'understeer'?",
    options: ["The rear sliding out", "The car turning less than intended", "Steering that is too light", "Braking too early"],
    answer: 1,
  },
  {
    id: "t15",
    question: "Which fuel do diesel engines NOT typically need?",
    options: ["Diesel", "Spark plugs", "Air", "A fuel tank"],
    answer: 1,
  },
  {
    id: "t16",
    question: "What does 'MPG' measure?",
    options: ["Miles per gallon", "Maximum power gain", "Metres per gear", "Manual park gear"],
    answer: 0,
  },
];

const EPISODE_TRIVIA: TriviaQuestion[] = GRAND_TOUR_EPISODE_STAGES.map((stage) => ({
  id: `gt-${stage.episodeNumber}`,
  question: stage.trivia.question,
  options: stage.trivia.options,
  answer: stage.trivia.answer,
}));

export function pickTrivia(used: Set<string>, missionId?: number): TriviaQuestion {
  const episodeQuestion = missionId ? EPISODE_TRIVIA.find((q) => q.id === `gt-${missionId}`) : undefined;
  const source = episodeQuestion && !used.has(episodeQuestion.id) ? [episodeQuestion] : [...EPISODE_TRIVIA, ...TRIVIA];
  const pool = source.filter((q) => !used.has(q.id));
  const list = pool.length > 0 ? pool : source;
  return list[Math.floor(Math.random() * list.length)];
}
