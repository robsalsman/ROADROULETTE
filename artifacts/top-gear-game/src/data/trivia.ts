import { GRAND_TOUR_EPISODE_STAGES } from "@/data/grand-tour-episode-stages";

export interface TriviaQuestion {
  id: string;
  type?: "episode" | "vehicle" | "mechanics" | "geography" | "motorsport";
  difficulty?: "easy" | "medium" | "hard";
  question: string;
  options: string[];
  answer: number;
  explanation?: string;
  relatedVehicles?: string[];
  episodeId?: number;
}

export const MECHANICS_TRIVIA: TriviaQuestion[] = [
  {
    id: "mech-bhp",
    type: "mechanics",
    difficulty: "easy",
    question: "What does 'BHP' stand for?",
    options: ["Brake Horse Power", "British Horse Power", "Boosted High Pressure", "Big Heavy Pistons"],
    answer: 0,
    explanation: "Brake horsepower measures engine output before drivetrain losses.",
  },
  {
    id: "mech-clutch",
    type: "mechanics",
    difficulty: "easy",
    question: "In a manual car, what does the clutch pedal do?",
    options: ["Applies the brakes", "Disengages the engine from the wheels", "Increases fuel flow", "Locks the differential"],
    answer: 1,
  },
  {
    id: "mech-torque",
    type: "mechanics",
    difficulty: "easy",
    question: "What does 'torque' measure?",
    options: ["Top speed", "Rotational force", "Fuel economy", "Tyre grip"],
    answer: 1,
  },
  {
    id: "mech-engine-light",
    type: "mechanics",
    difficulty: "easy",
    question: "What does the warning light shaped like an engine usually indicate?",
    options: ["Low fuel", "A door is open", "An engine fault", "Time for a service only"],
    answer: 2,
  },
  {
    id: "mech-hybrid-regen",
    type: "mechanics",
    difficulty: "easy",
    question: "Which of these is a hybrid powertrain feature?",
    options: ["A second steering wheel", "Regenerative braking", "Square wheels", "Twin exhausts"],
    answer: 1,
  },
  {
    id: "mech-4x4",
    type: "mechanics",
    difficulty: "easy",
    question: "What does 4x4 normally refer to?",
    options: ["Four seats and four doors", "Four-wheel drive", "A 4-litre engine", "Four cup holders"],
    answer: 1,
  },
  {
    id: "mech-turbo",
    type: "mechanics",
    difficulty: "easy",
    question: "What does a turbocharger use to help boost power?",
    options: ["Exhaust gases", "Brake fluid", "Window washer fluid", "Static electricity"],
    answer: 0,
  },
  {
    id: "mech-pedal-layout",
    type: "mechanics",
    difficulty: "easy",
    question: "Which pedal layout is standard in a UK manual car, left to right?",
    options: ["Brake, clutch, accelerator", "Clutch, brake, accelerator", "Accelerator, brake, clutch", "Clutch, accelerator, brake"],
    answer: 1,
  },
  {
    id: "mech-understeer",
    type: "mechanics",
    difficulty: "medium",
    question: "What is understeer?",
    options: ["The rear sliding out", "The car turning less than intended", "Steering that is too light", "Braking too early"],
    answer: 1,
  },
  {
    id: "mech-diesel-spark",
    type: "mechanics",
    difficulty: "easy",
    question: "Which component do diesel engines not typically need for ignition?",
    options: ["Diesel", "Spark plugs", "Air", "A fuel tank"],
    answer: 1,
  },
  {
    id: "mech-mpg",
    type: "mechanics",
    difficulty: "easy",
    question: "What does MPG measure?",
    options: ["Miles per gallon", "Maximum power gain", "Metres per gear", "Manual park gear"],
    answer: 0,
  },
  {
    id: "mech-abs",
    type: "mechanics",
    difficulty: "easy",
    question: "What is ABS designed to help prevent under braking?",
    options: ["Wheel lock-up", "Low oil pressure", "Turbo lag", "A flat battery"],
    answer: 0,
  },
  {
    id: "mech-differential",
    type: "mechanics",
    difficulty: "medium",
    question: "What does a differential allow driven wheels to do while cornering?",
    options: ["Rotate at different speeds", "Change tyre size", "Switch fuel type", "Open the boot"],
    answer: 0,
  },
  {
    id: "mech-downforce",
    type: "mechanics",
    difficulty: "medium",
    question: "What does aerodynamic downforce mainly improve?",
    options: ["Grip at speed", "Fuel tank capacity", "Seat comfort", "Radio reception"],
    answer: 0,
  },
];

export const VEHICLE_TRIVIA: TriviaQuestion[] = [
  {
    id: "veh-mclaren-p1-hybrid",
    type: "vehicle",
    difficulty: "medium",
    question: "What kind of powertrain does the McLaren P1 use?",
    options: ["Hybrid petrol-electric", "Pure battery electric", "Diesel-electric", "Hydrogen fuel cell"],
    answer: 0,
    relatedVehicles: ["McLaren P1"],
    episodeId: 1,
    explanation: "The P1 combines a twin-turbo V8 with electric assistance.",
  },
  {
    id: "veh-porsche-918",
    type: "vehicle",
    difficulty: "medium",
    question: "The Porsche 918 Spyder is best described as what?",
    options: ["Plug-in hybrid supercar", "Front-engined diesel coupe", "Rear-engined city car", "Body-on-frame pickup"],
    answer: 0,
    relatedVehicles: ["Porsche 918 Spyder"],
    episodeId: 1,
  },
  {
    id: "veh-laferrari",
    type: "vehicle",
    difficulty: "medium",
    question: "LaFerrari used hybrid assistance with which type of combustion engine?",
    options: ["V12", "Flat-six", "Inline-four", "Rotary"],
    answer: 0,
    relatedVehicles: ["LaFerrari"],
    episodeId: 1,
  },
  {
    id: "veh-audi-s8-plus",
    type: "vehicle",
    difficulty: "medium",
    question: "The Audi S8 Plus belongs to which vehicle class?",
    options: ["Performance luxury saloon", "Compact roadster", "Three-wheeled microcar", "Pickup truck"],
    answer: 0,
    relatedVehicles: ["Audi S8 Plus"],
    episodeId: 2,
  },
  {
    id: "veh-aston-vulcan",
    type: "vehicle",
    difficulty: "medium",
    question: "The Aston Martin Vulcan is primarily known as what sort of car?",
    options: ["Track-only hypercar", "Economy hatchback", "Family MPV", "Diesel estate"],
    answer: 0,
    relatedVehicles: ["Aston Martin Vulcan"],
    episodeId: 2,
  },
  {
    id: "veh-rolls-dawn",
    type: "vehicle",
    difficulty: "easy",
    question: "The Rolls-Royce Dawn is a luxury version of which body style?",
    options: ["Convertible", "Pickup", "Motorcycle", "Rally hatchback"],
    answer: 0,
    relatedVehicles: ["Rolls-Royce Dawn"],
    episodeId: 3,
  },
  {
    id: "veh-dodge-hellcat",
    type: "vehicle",
    difficulty: "easy",
    question: "The Dodge Challenger SRT Hellcat is associated most strongly with which country?",
    options: ["United States", "Japan", "Sweden", "France"],
    answer: 0,
    relatedVehicles: ["Dodge Challenger SRT Hellcat"],
    episodeId: 3,
  },
  {
    id: "veh-land-rover-discovery",
    type: "vehicle",
    difficulty: "easy",
    question: "The Land Rover Discovery is most naturally suited to which role?",
    options: ["Off-road family SUV", "Single-seat race car", "Italian city scooter", "Track-only prototype"],
    answer: 0,
    relatedVehicles: ["Land Rover Discovery eco builds"],
    episodeId: 4,
  },
  {
    id: "veh-mazda-mx5",
    type: "vehicle",
    difficulty: "easy",
    question: "The Mazda MX-5 is famous for being a lightweight what?",
    options: ["Roadster", "Limousine", "Heavy goods vehicle", "Amphibious truck"],
    answer: 0,
    relatedVehicles: ["Mazda MX-5"],
    episodeId: 5,
  },
  {
    id: "veh-ford-gt40",
    type: "motorsport",
    difficulty: "medium",
    question: "The Ford GT40 is famous for success at which endurance race?",
    options: ["24 Hours of Le Mans", "Indianapolis 500", "Monte Carlo Rally", "Pikes Peak"],
    answer: 0,
    relatedVehicles: ["Ford GT40"],
    episodeId: 6,
  },
  {
    id: "veh-honda-nsx",
    type: "vehicle",
    difficulty: "medium",
    question: "The original Honda NSX is known for pairing everyday usability with which layout?",
    options: ["Mid-engine sports car", "Front-engined pickup", "Rear-engined city car", "Steam-powered saloon"],
    answer: 0,
    relatedVehicles: ["Honda NSX"],
    episodeId: 9,
  },
  {
    id: "veh-maserati-biturbo",
    type: "vehicle",
    difficulty: "medium",
    question: "The Maserati Biturbo name refers to what feature?",
    options: ["Two turbochargers", "Two steering wheels", "Two fuel tanks only", "Two reverse gears"],
    answer: 0,
    relatedVehicles: ["Maserati Biturbo S Coupe"],
    episodeId: 11,
  },
  {
    id: "veh-rimac",
    type: "vehicle",
    difficulty: "medium",
    question: "Rimac is best known for building which type of performance car?",
    options: ["Electric hypercars", "Steam trucks", "Diesel taxis", "Vintage tractors"],
    answer: 0,
    relatedVehicles: ["Rimac Concept One"],
    episodeId: 14,
  },
  {
    id: "veh-audi-quattro",
    type: "motorsport",
    difficulty: "medium",
    question: "The Audi Quattro became famous partly because of which drivetrain advantage?",
    options: ["All-wheel drive", "No gearbox", "Pedal power", "Front wheels only"],
    answer: 0,
    relatedVehicles: ["Audi Quattro"],
    episodeId: 20,
  },
  {
    id: "veh-lancia-037",
    type: "motorsport",
    difficulty: "hard",
    question: "The Lancia Rally 037 is remembered from which motorsport era?",
    options: ["Group B rallying", "Modern Formula E", "NASCAR stock cars", "Pre-war Grand Prix"],
    answer: 0,
    relatedVehicles: ["Lancia Rally 037"],
    episodeId: 20,
  },
  {
    id: "veh-f150-raptor",
    type: "vehicle",
    difficulty: "easy",
    question: "The Ford F-150 Raptor is built around what sort of vehicle?",
    options: ["High-performance pickup", "Tiny city hatchback", "Luxury limousine", "Track-only single-seater"],
    answer: 0,
    relatedVehicles: ["Ford F-150 Raptor"],
    episodeId: 23,
  },
  {
    id: "veh-subaru-sti",
    type: "motorsport",
    difficulty: "easy",
    question: "The Subaru Impreza WRX STI is strongly associated with which discipline?",
    options: ["Rallying", "Powerboat racing", "Truck trials", "Karting only"],
    answer: 0,
    relatedVehicles: ["Subaru Impreza WRX STI"],
    episodeId: 43,
  },
  {
    id: "veh-mitsubishi-evo",
    type: "motorsport",
    difficulty: "easy",
    question: "The Mitsubishi Lancer Evolution is a long-time rival of which rally-inspired car?",
    options: ["Subaru Impreza WRX STI", "Rolls-Royce Dawn", "Citroen Berlingo", "Ford Transit"],
    answer: 0,
    relatedVehicles: ["Mitsubishi Lancer Evolution VIII"],
    episodeId: 43,
  },
  {
    id: "veh-citroen-sm",
    type: "vehicle",
    difficulty: "hard",
    question: "The Citroen SM is known for mixing French design with an engine from which Italian brand?",
    options: ["Maserati", "Fiat", "Lancia", "Ferrari"],
    answer: 0,
    relatedVehicles: ["Citroen SM"],
    episodeId: 42,
  },
  {
    id: "veh-triumph-stag",
    type: "vehicle",
    difficulty: "medium",
    question: "The Triumph Stag is a British classic most commonly associated with which body style?",
    options: ["Grand touring convertible", "Pickup truck", "Rally hatchback", "Luxury SUV"],
    answer: 0,
    relatedVehicles: ["Triumph Stag"],
    episodeId: 46,
  },
];

export const GENERAL_TRIVIA: TriviaQuestion[] = [
  {
    id: "general-koenigsegg",
    type: "vehicle",
    difficulty: "easy",
    question: "Which country is the car maker Koenigsegg from?",
    options: ["Germany", "Italy", "Sweden", "Norway"],
    answer: 2,
  },
  {
    id: "general-corolla",
    type: "vehicle",
    difficulty: "medium",
    question: "What is widely regarded as the best-selling car nameplate of all time?",
    options: ["Volkswagen Beetle", "Toyota Corolla", "Ford Model T", "Honda Civic"],
    answer: 1,
  },
  {
    id: "general-rolls-ornament",
    type: "vehicle",
    difficulty: "easy",
    question: "Which luxury brand uses a Spirit of Ecstasy bonnet ornament?",
    options: ["Bentley", "Jaguar", "Rolls-Royce", "Aston Martin"],
    answer: 2,
  },
  {
    id: "general-ferrari-red",
    type: "motorsport",
    difficulty: "easy",
    question: "What colour is traditionally associated with Ferrari racing cars?",
    options: ["British Racing Green", "Rosso Corsa red", "French Blue", "Silver"],
    answer: 1,
  },
  {
    id: "general-nurburgring",
    type: "motorsport",
    difficulty: "easy",
    question: "The Nurburgring, famous for lap times, is in which country?",
    options: ["Belgium", "France", "Germany", "Austria"],
    answer: 2,
  },
];

export const EPISODE_TRIVIA: TriviaQuestion[] = GRAND_TOUR_EPISODE_STAGES.map((stage) => ({
  id: `gt-${stage.episodeNumber}`,
  type: "episode",
  difficulty: stage.difficulty === "easy" ? "easy" : stage.difficulty === "medium" ? "medium" : "hard",
  question: stage.trivia.question,
  options: stage.trivia.options,
  answer: stage.trivia.answer,
  episodeId: stage.id,
  relatedVehicles: stage.featuredVehicles,
  explanation: `Episode ${stage.episodeNumber}, ${stage.title}, is set around ${stage.locationTheme}.`,
}));

export const ALL_TRIVIA = [...EPISODE_TRIVIA, ...VEHICLE_TRIVIA, ...MECHANICS_TRIVIA, ...GENERAL_TRIVIA];
export const TRIVIA = [...MECHANICS_TRIVIA, ...GENERAL_TRIVIA];

export function triviaByType(type: TriviaQuestion["type"] | "mixed"): TriviaQuestion[] {
  if (type === "mixed") return ALL_TRIVIA;
  return ALL_TRIVIA.filter((question) => question.type === type);
}

export function pickTrivia(used: Set<string>, missionId?: number): TriviaQuestion {
  const episodeQuestion = missionId ? EPISODE_TRIVIA.find((q) => q.id === `gt-${missionId}`) : undefined;
  const source = episodeQuestion && !used.has(episodeQuestion.id) ? [episodeQuestion] : ALL_TRIVIA;
  const pool = source.filter((q) => !used.has(q.id));
  const list = pool.length > 0 ? pool : source;
  return list[Math.floor(Math.random() * list.length)];
}
