export type EventRisk = "safe" | "risky" | "mad";

export type EventChoice = {
  id: string;
  label: string;
  flavor: string;
  risk: EventRisk;
  outcome: string;
  fundsEffect: number;
  distanceEffect: number;
  damageEffect: number;
};

export type RoadEventTemplate = {
  id: string;
  type: string;
  title: string;
  situation: string;
  choices: [EventChoice, EventChoice, EventChoice];
};

export const ROAD_EVENTS: RoadEventTemplate[] = [
  {
    id: "engine_temp",
    type: "breakdown" as const,
    title: "Temperature Warning Light",
    situation:
      "A warning light has appeared on the dashboard. You are reasonably confident it is the temperature gauge. It could also be the 'everything is fine' light. You cannot remember which because the handbook is in a language you do not speak.",
    choices: [
      {
        id: "stop_cool",
        label: "Stop and let it cool down",
        flavor: "Sensible. Boring. Probably right.",
        risk: "safe",
        outcome:
          "You pull over, let the engine cool, and top up the water from a helpful local's garden hose. It takes 40 minutes. The car is fine.",
        fundsEffect: -30,
        distanceEffect: 40,
        damageEffect: 0,
      },
      {
        id: "press_on",
        label: "Press on — it will probably be fine",
        flavor: "It probably will not be fine.",
        risk: "risky",
        outcome:
          "The engine runs extremely hot but does not actually explode. A new and concerning noise has joined the repertoire.",
        fundsEffect: 0,
        distanceEffect: 65,
        damageEffect: -20,
      },
      {
        id: "soft_drink",
        label: "Pour your soft drink into the radiator",
        flavor: "Hammond once did this. It worked once.",
        risk: "mad",
        outcome:
          "The radiator now smells of cola. The temperature drops. The car sounds — different. Not worse, exactly. Just different.",
        fundsEffect: -5,
        distanceEffect: 60,
        damageEffect: -10,
      },
    ],
  },
  {
    id: "river_crossing",
    type: "obstacle",
    title: "The Road Is a River",
    situation:
      "The map calls this a road. The road is currently a river. A depth of approximately two feet, though it is difficult to be certain. A local is watching from the bank with the expression of someone who has seen this before and finds it entertaining.",
    choices: [
      {
        id: "find_shallow",
        label: "Find the shallowest point and go slowly",
        flavor: "Cautious. The local seems amused.",
        risk: "safe",
        outcome:
          "You inch through carefully. The engine coughs twice but makes it. The local applauds slowly, without enthusiasm.",
        fundsEffect: 0,
        distanceEffect: 35,
        damageEffect: -10,
      },
      {
        id: "floor_it",
        label: "Floor it — momentum is everything",
        flavor: "This is probably true. Probably.",
        risk: "risky",
        outcome:
          "You make it through at speed, trailing a magnificent bow wave. The car makes a new sound from underneath but keeps going.",
        fundsEffect: 0,
        distanceEffect: 60,
        damageEffect: -25,
      },
      {
        id: "tractor_tow",
        label: "Pay a farmer with a tractor to tow you across",
        flavor: "Expensive. Undignified. Safe.",
        risk: "safe",
        outcome:
          "The farmer quotes an extortionate price. You pay it. The car is towed across bone-dry. Everyone loses except the farmer.",
        fundsEffect: -180,
        distanceEffect: 30,
        damageEffect: 0,
      },
    ],
  },
  {
    id: "police_checkpoint",
    type: "hazard",
    title: "Unexpected Police Checkpoint",
    situation:
      "Two men in impressive hats are flagging you down. They have clipboards. Their expressions suggest this will cost money. Whether it costs money because of a genuine infraction or simply because you are there is unclear.",
    choices: [
      {
        id: "stop_polite",
        label: "Stop, smile, and show your documents",
        flavor: "You are a British television presenter. That means nothing here.",
        risk: "safe",
        outcome:
          "They study your documents for eleven minutes. They find something irregular. You pay a fine. They wave you through with expressions of deep satisfaction.",
        fundsEffect: -120,
        distanceEffect: 40,
        damageEffect: 0,
      },
      {
        id: "smile_drive",
        label: "Wave confidently and keep moving",
        flavor: "Confidence is everything.",
        risk: "risky",
        outcome:
          "You wave. They wave back, apparently confused. You accelerate past before anyone works out what happened. Brilliant.",
        fundsEffect: 0,
        distanceEffect: 65,
        damageEffect: 0,
      },
      {
        id: "three_point",
        label: "Do a three-point turn and find an alternative route",
        flavor: "The scenic route.",
        risk: "mad",
        outcome:
          "The alternative route adds considerable distance and goes through a village where every road leads back to a chicken farm. Eventually you find the main road again, further along.",
        fundsEffect: 0,
        distanceEffect: 25,
        damageEffect: -5,
      },
    ],
  },
  {
    id: "wrong_turn",
    type: "navigation",
    title: "Navigator Catastrophe",
    situation:
      "This is not the right road. This becomes apparent when the road ends at a farmyard gate. A very large dog has noticed your arrival and is coming over to discuss it. The farmer is watching from the doorway of his house with an expression of pure neutrality.",
    choices: [
      {
        id: "reverse_out",
        label: "Apologise sincerely and reverse out carefully",
        flavor: "British and correct.",
        risk: "safe",
        outcome:
          "You reverse out slowly. The dog follows you to the gate. The farmer remains neutral throughout.",
        fundsEffect: 0,
        distanceEffect: 25,
        damageEffect: 0,
      },
      {
        id: "drive_through",
        label: "Drive through the farm — there must be a track",
        flavor: "Probably not, but possibly.",
        risk: "risky",
        outcome:
          "There is a track. It is not maintained. The car makes it through, though one wing mirror makes a heroic sacrifice against a fence post.",
        fundsEffect: -40,
        distanceEffect: 55,
        damageEffect: -20,
      },
      {
        id: "tea_farmer",
        label: "Ask the farmer for directions over a cup of tea",
        flavor: "You are already here. Might as well.",
        risk: "safe",
        outcome:
          "The farmer turns out to be extremely helpful. He knows a shortcut through the valley that adds almost no distance but requires driving through a stream.",
        fundsEffect: -10,
        distanceEffect: 70,
        damageEffect: -5,
      },
    ],
  },
  {
    id: "the_pothole",
    type: "obstacle",
    title: "The Pothole",
    situation:
      "Less a pothole, more a geological event. It is approximately two feet deep and four feet across. You see it at the last possible moment. You must go left, go right, or go directly through it at whatever speed you are currently travelling.",
    choices: [
      {
        id: "brake_navigate",
        label: "Brake hard and navigate carefully around it",
        flavor: "Slow but intact.",
        risk: "safe",
        outcome:
          "You brake, swerve, and squeeze past on the left. The passenger-side wheels drop into the edge. The suspension makes a sound like a question mark.",
        fundsEffect: 0,
        distanceEffect: 45,
        damageEffect: -5,
      },
      {
        id: "maintain_speed",
        label: "Hold speed and go through it",
        flavor: "The only way is through.",
        risk: "risky",
        outcome:
          "The impact is spectacular. Everything rattles. Two things fall off. The car continues moving in the correct direction, which is more than you deserved.",
        fundsEffect: -60,
        distanceEffect: 65,
        damageEffect: -30,
      },
      {
        id: "opposite_lane",
        label: "Swerve dramatically into the oncoming lane",
        flavor: "Hope nothing is coming.",
        risk: "mad",
        outcome:
          "Nothing is coming. You miss the pothole entirely. Your heart rate will return to normal by tomorrow.",
        fundsEffect: 0,
        distanceEffect: 60,
        damageEffect: -5,
      },
    ],
  },
  {
    id: "fuel_emergency",
    type: "breakdown",
    title: "The Petrol Light",
    situation:
      "The low fuel light has been on for two hours and forty minutes. You have been meaning to address this. The next village is marked on the map, though the map is from 2003 and that village may no longer exist in the form depicted.",
    choices: [
      {
        id: "find_village",
        label: "Find a village and pay whatever they ask",
        flavor: "You are over a barrel. They know it.",
        risk: "safe",
        outcome:
          "There is a village. The fuel costs three times the going rate. You pay without argument because the alternative is walking.",
        fundsEffect: -220,
        distanceEffect: 45,
        damageEffect: 0,
      },
      {
        id: "coast_downhill",
        label: "Turn the engine off on the downhills and coast",
        flavor: "James May does this recreationally.",
        risk: "risky",
        outcome:
          "This actually works. You make it to a fuel stop on fumes and dignity, in roughly equal measure.",
        fundsEffect: -80,
        distanceEffect: 55,
        damageEffect: 0,
      },
      {
        id: "drain_locals",
        label: "Siphon a small amount from a parked vehicle",
        flavor: "Absolutely not. And yet.",
        risk: "mad",
        outcome:
          "The parked vehicle belongs to a man who is currently watching you from his front door. You explain your situation. He is unexpectedly sympathetic and sells you a jerrycan for a reasonable price.",
        fundsEffect: -100,
        distanceEffect: 65,
        damageEffect: 0,
      },
    ],
  },
  {
    id: "livestock",
    type: "obstacle",
    title: "Livestock Situation",
    situation:
      "Approximately thirty animals are occupying the full width of the road. They are comfortable. The herdsman is visible in a field to the left, possibly asleep. There is no timeline for when this might resolve itself.",
    choices: [
      {
        id: "wait_patiently",
        label: "Wait. They will move eventually.",
        flavor: "They will move eventually.",
        risk: "safe",
        outcome:
          "They move eventually. It takes forty-five minutes. The herdsman wakes up and looks slightly embarrassed.",
        fundsEffect: 0,
        distanceEffect: 25,
        damageEffect: 0,
      },
      {
        id: "honk_edge",
        label: "Honk repeatedly and edge forward",
        flavor: "This is the method of choice for local drivers.",
        risk: "risky",
        outcome:
          "The animals part, mostly. The car acquires a new scratch along the driver's door from an animal that disagreed with your approach.",
        fundsEffect: -30,
        distanceEffect: 50,
        damageEffect: -10,
      },
      {
        id: "herd_yourself",
        label: "Get out and herd them yourself",
        flavor: "How difficult can it be.",
        risk: "mad",
        outcome:
          "Extremely difficult. However you succeed after twenty minutes, and the herdsman, now awake, gives you a thumbs up and what appears to be a blessing.",
        fundsEffect: 0,
        distanceEffect: 55,
        damageEffect: 0,
      },
    ],
  },
  {
    id: "new_noise",
    type: "breakdown",
    title: "A New And Worrying Noise",
    situation:
      "Your car has developed a sound. It is a metallic scraping with lower notes of grinding and an intermittent higher-pitched squeal. This sound was not present when you set off. You have been hearing it for about an hour and have been choosing not to think about it.",
    choices: [
      {
        id: "stop_investigate",
        label: "Stop and find the source",
        flavor: "Probably a good idea.",
        risk: "safe",
        outcome:
          "A heat shield has worked itself loose and is dragging on the road. You remove it with a firm kick and some determination. The noise stops. You feel briefly like a mechanic.",
        fundsEffect: 0,
        distanceEffect: 40,
        damageEffect: 5,
      },
      {
        id: "radio_louder",
        label: "Turn the radio up",
        flavor: "The classic solution.",
        risk: "risky",
        outcome:
          "You cannot hear the noise any more. You tell yourself this means it has resolved itself. The noise has not resolved itself.",
        fundsEffect: 0,
        distanceEffect: 65,
        damageEffect: -25,
      },
      {
        id: "remove_panel",
        label: "Remove the offending panel entirely",
        flavor: "James would disapprove. Hammond would help.",
        risk: "risky",
        outcome:
          "You find the panel, identify that it is non-structural, and remove it. The noise stops. A piece of your car is now on the roadside. The car continues.",
        fundsEffect: 0,
        distanceEffect: 60,
        damageEffect: -5,
      },
    ],
  },
  {
    id: "shortcut",
    type: "navigation",
    title: "The Shortcut Opportunity",
    situation:
      "A dirt track leads off the main road at a promising angle. The map does not show it, which could mean it is a genuine local shortcut unknown to cartographers, or that it goes nowhere. There is no way to know which without committing.",
    choices: [
      {
        id: "main_road",
        label: "Stay on the main road",
        flavor: "Slow but guaranteed.",
        risk: "safe",
        outcome:
          "The main road is the main road. You stay on it. You make predictable progress.",
        fundsEffect: 0,
        distanceEffect: 45,
        damageEffect: 0,
      },
      {
        id: "take_shortcut",
        label: "Take the shortcut",
        flavor: "Commit.",
        risk: "risky",
        outcome:
          "The track is rough and the car suffers but it is genuinely shorter. You rejoin the main road considerably ahead of where you would have been. Tremendous.",
        fundsEffect: 0,
        distanceEffect: 80,
        damageEffect: -20,
      },
      {
        id: "shortcut_flat_out",
        label: "Take the shortcut at full speed",
        flavor: "Commitment maximised.",
        risk: "mad",
        outcome:
          "The track is extremely rough. The speed is extremely high. The car survives by what can only be described as an act of goodwill from the universe. You are considerably ahead.",
        fundsEffect: -50,
        distanceEffect: 95,
        damageEffect: -35,
      },
    ],
  },
  {
    id: "helpful_local",
    type: "encounter",
    title: "A Helpful Stranger",
    situation:
      "A man at the roadside is waving you down with great enthusiasm. He is smiling. He may want to help you. He may want to sell you something. In this part of the world these are often the same thing.",
    choices: [
      {
        id: "ignore_drive",
        label: "Smile and drive past",
        flavor: "Safe. Possibly rude.",
        risk: "safe",
        outcome:
          "He watches you pass with the expression of someone whose act of kindness has been rejected. You feel briefly guilty. The road continues.",
        fundsEffect: 0,
        distanceEffect: 50,
        damageEffect: 0,
      },
      {
        id: "stop_chat",
        label: "Stop and hear what he has to say",
        flavor: "It could be anything.",
        risk: "risky",
        outcome:
          "He sells you a bottle of 'special fuel additive'. It is water with green colouring. The car is unaffected. He seems pleased with this transaction.",
        fundsEffect: -60,
        distanceEffect: 45,
        damageEffect: 0,
      },
      {
        id: "take_navigator",
        label: "Let him get in and navigate",
        flavor: "Mad. Possibly brilliant.",
        risk: "mad",
        outcome:
          "He knows every back road in the region and guides you through three consecutive shortcuts with the confidence of a man who has done this for years. You drop him at his village considerably further along than expected.",
        fundsEffect: -20,
        distanceEffect: 85,
        damageEffect: 0,
      },
    ],
  },
  {
    id: "weather",
    type: "hazard",
    title: "Sudden Weather",
    situation:
      "The sky has turned a colour not found in standard weather forecasting. Whatever is coming is coming quickly. Your wipers operate in two speeds: slow and slightly faster, both inadequate. The road ahead is disappearing into grey.",
    choices: [
      {
        id: "find_shelter",
        label: "Stop and wait it out under a tree",
        flavor: "Patient and probably wise.",
        risk: "safe",
        outcome:
          "You shelter for two hours. The storm passes. The road is extremely muddy but passable. You make slow, cautious progress.",
        fundsEffect: 0,
        distanceEffect: 30,
        damageEffect: 0,
      },
      {
        id: "drive_through",
        label: "Drive through it at a sensible speed",
        flavor: "You are British. You drive through everything.",
        risk: "risky",
        outcome:
          "Visibility drops to almost nothing. You keep going. The car stays on the road. By some margin.",
        fundsEffect: 0,
        distanceEffect: 55,
        damageEffect: -15,
      },
      {
        id: "drive_faster",
        label: "Drive faster through it",
        flavor: "Less time in the rain.",
        risk: "mad",
        outcome:
          "The logic is sound even if the execution is terrifying. You emerge from the other side of the storm having covered considerable distance in a state of concentrated focus.",
        fundsEffect: 0,
        distanceEffect: 75,
        damageEffect: -25,
      },
    ],
  },
  {
    id: "bridge_concern",
    type: "obstacle",
    title: "The Bridge",
    situation:
      "The bridge ahead carries a sign with a weight limit. The number is concerning. You estimate your car weighs more than that. You may be wrong. You do not have bathroom scales. The bridge looks old but possibly confident.",
    choices: [
      {
        id: "find_ford",
        label: "Find an alternative crossing downstream",
        flavor: "Takes time. Saves car.",
        risk: "safe",
        outcome:
          "There is a ford two kilometres downstream. It is shallow. You cross without incident, rejoining the road further along with your structural integrity intact.",
        fundsEffect: 0,
        distanceEffect: 30,
        damageEffect: 0,
      },
      {
        id: "cross_carefully",
        label: "Cross very slowly, weight distributed",
        flavor: "Probably fine.",
        risk: "risky",
        outcome:
          "The bridge makes sounds that bridges probably should not make. You make it across. You do not look back to see if the bridge is still standing.",
        fundsEffect: 0,
        distanceEffect: 55,
        damageEffect: -10,
      },
      {
        id: "cross_fast",
        label: "Cross at speed — less time on the bridge",
        flavor: "The physics of this are disputed.",
        risk: "mad",
        outcome:
          "You are across in 2.4 seconds. The bridge is still there. Whether this was brave or simply lucky is a question for philosophers.",
        fundsEffect: 0,
        distanceEffect: 65,
        damageEffect: -15,
      },
    ],
  },
  {
    id: "inspiration",
    type: "good",
    title: "A Moment of Mechanical Inspiration",
    situation:
      "While stopped to consult the map, you notice something. The air filter cover is loose. Actually — looking closer — the filter is completely blocked with dust and debris. You have a small toolkit in the boot. You are not James May, but you are not entirely useless.",
    choices: [
      {
        id: "clean_filter",
        label: "Clean and refit the air filter properly",
        flavor: "Five minutes. Free horsepower.",
        risk: "safe",
        outcome:
          "You clear the filter, refit everything correctly, and restart the engine. It sounds immediately more willing. Car condition improves noticeably.",
        fundsEffect: 0,
        distanceEffect: 55,
        damageEffect: 15,
      },
      {
        id: "probably_imagining",
        label: "You are probably imagining it. Press on.",
        flavor: "You are not imagining it.",
        risk: "safe",
        outcome:
          "You press on. The car continues as it was — which is to say, not at its best.",
        fundsEffect: 0,
        distanceEffect: 50,
        damageEffect: 0,
      },
      {
        id: "remove_filter",
        label: "Remove the filter entirely — maximum airflow",
        flavor: "James would be horrified.",
        risk: "mad",
        outcome:
          "The engine breathes more freely and briefly seems more alive. Then dust gets into things it should not be in. A trade-off has been made.",
        fundsEffect: 0,
        distanceEffect: 65,
        damageEffect: -10,
      },
    ],
  },
  {
    id: "toll",
    type: "encounter",
    title: "The Unofficial Toll",
    situation:
      "A rope hangs across the road. A man sits on a plastic chair beside it. He has a notebook and the serene confidence of someone who has been doing this for a long time. This was not on the map because it is not official in any recognised sense.",
    choices: [
      {
        id: "pay_full",
        label: "Pay whatever he asks",
        flavor: "You are over a barrel. He knows it.",
        risk: "safe",
        outcome:
          "He asks for an amount. You pay it. The rope drops. He makes a note in his book. You drive through with your dignity only slightly reduced.",
        fundsEffect: -100,
        distanceEffect: 50,
        damageEffect: 0,
      },
      {
        id: "negotiate",
        label: "Negotiate firmly",
        flavor: "You have done this before.",
        risk: "risky",
        outcome:
          "He counters. You counter. He considers. You settle at half. He writes it in the book under a different column. Both parties seem satisfied.",
        fundsEffect: -50,
        distanceEffect: 50,
        damageEffect: 0,
      },
      {
        id: "claim_press",
        label: "Claim to be international press on urgent business",
        flavor: "Technically not untrue.",
        risk: "mad",
        outcome:
          "He has never heard of Top Gear or The Grand Tour. He waves you through anyway because you said it with such certainty. The power of conviction.",
        fundsEffect: 0,
        distanceEffect: 55,
        damageEffect: 0,
      },
    ],
  },
  {
    id: "mechanical_failure",
    type: "breakdown",
    title: "Something Has Fallen Off",
    situation:
      "A piece of your car is now on the road behind you. You saw it in the mirror. It was dark coloured and roughly the size of a briefcase. You do not know what it was. The car is still moving. Nothing obviously bad has happened yet.",
    choices: [
      {
        id: "reverse_retrieve",
        label: "Reverse back and retrieve it",
        flavor: "You might need it.",
        risk: "safe",
        outcome:
          "It is the underside cover for the spare wheel well. Non-critical. You cable-tie it back. It holds. You continue with slightly more confidence.",
        fundsEffect: -20,
        distanceEffect: 35,
        damageEffect: 5,
      },
      {
        id: "assess_continue",
        label: "Assess from the driver's seat and continue",
        flavor: "It is probably fine.",
        risk: "risky",
        outcome:
          "Everything seems fine. You continue. A new noise suggests it was not entirely fine, but the car is moving and that is what matters.",
        fundsEffect: 0,
        distanceEffect: 60,
        damageEffect: -20,
      },
      {
        id: "ignore_completely",
        label: "Ignore it entirely",
        flavor: "What you cannot identify cannot hurt you.",
        risk: "mad",
        outcome:
          "The car runs fine for a worrying amount of time, leading you to believe whatever fell off was probably decorative. You choose to maintain this belief.",
        fundsEffect: 0,
        distanceEffect: 70,
        damageEffect: -30,
      },
    ],
  },

  // ── Positive & neutral events (sightseeing, good fortune, Grand Tour antics) ──
  {
    id: "roadside_museum",
    type: "good",
    title: "The Unexpected Museum",
    situation:
      "A hand-painted sign points down a side road to what it claims is 'THE MUSEUM OF LOCAL HISTORY & TRACTORS.' It is exactly the sort of magnificent nonsense one cannot drive past. There is a small entry fee.",
    choices: [
      {
        id: "museum_full_tour",
        label: "Pay for the full guided tour",
        flavor: "There will be tractors. So many tractors.",
        risk: "safe",
        outcome:
          "It is genuinely wonderful. The curator is ninety and has opinions about everything. You leave two hours later having learned far too much about regional ploughing. Morale soars.",
        fundsEffect: -25,
        distanceEffect: 30,
        damageEffect: 5,
      },
      {
        id: "museum_quick_look",
        label: "Have a quick free look round the gift shop",
        flavor: "Classic British museum strategy.",
        risk: "safe",
        outcome:
          "You buy a postcard and a small carved tractor. Money well spent. The shopkeeper even tops up your water bottles for the road.",
        fundsEffect: -8,
        distanceEffect: 40,
        damageEffect: 0,
      },
      {
        id: "museum_skip",
        label: "Drive on — there is a schedule",
        flavor: "There is no schedule.",
        risk: "risky",
        outcome:
          "You make good progress, but you will think about that tractor museum for the rest of your life. The others will not let you forget it.",
        fundsEffect: 0,
        distanceEffect: 70,
        damageEffect: 0,
      },
    ],
  },
  {
    id: "scenic_viewpoint",
    type: "good",
    title: "A Genuinely Spectacular View",
    situation:
      "You round a bend and the entire landscape opens up below you. It is, without exaggeration, one of the most beautiful things you have ever seen. There is a layby specifically for stopping and gawping.",
    choices: [
      {
        id: "view_photos",
        label: "Stop and take a thousand photographs",
        flavor: "For the production, obviously.",
        risk: "safe",
        outcome:
          "The footage is glorious. A passing tour guide is so impressed with your enthusiasm they tip you off about a cracking fuel stop ahead. Spirits high.",
        fundsEffect: 30,
        distanceEffect: 35,
        damageEffect: 5,
      },
      {
        id: "view_picnic",
        label: "Break out the snacks and have a moment",
        flavor: "A rare instance of all three agreeing on something.",
        risk: "safe",
        outcome:
          "You sit in companionable silence eating biscuits and watching the clouds. It is perfect. Nobody mentions the car for ten whole minutes.",
        fundsEffect: 0,
        distanceEffect: 30,
        damageEffect: 8,
      },
      {
        id: "view_drive",
        label: "Admire it through the windscreen at speed",
        flavor: "Multitasking.",
        risk: "risky",
        outcome:
          "You see roughly 60% of the view while keeping the car mostly on the road. Efficient, if not exactly safe.",
        fundsEffect: 0,
        distanceEffect: 60,
        damageEffect: 0,
      },
    ],
  },
  {
    id: "local_festival",
    type: "encounter",
    title: "You Have Driven Into a Festival",
    situation:
      "The road ahead is full of music, bunting, and what appears to be an enormous communal feast. The locals are delighted to see a battered foreign car arrive and are waving you in enthusiastically.",
    choices: [
      {
        id: "festival_join",
        label: "Join in completely. Dance. Eat everything.",
        flavor: "It would be rude not to.",
        risk: "safe",
        outcome:
          "You have the time of your lives. Someone even fixes a rattling panel for free while you eat. You leave full, happy, and with snacks for the road.",
        fundsEffect: 20,
        distanceEffect: 25,
        damageEffect: 12,
      },
      {
        id: "festival_polite",
        label: "Politely accept some food and press on",
        flavor: "The sensible middle ground.",
        risk: "safe",
        outcome:
          "You are handed an alarming quantity of food through the window and waved off with cheers. Genuinely lovely. Onwards.",
        fundsEffect: 0,
        distanceEffect: 45,
        damageEffect: 4,
      },
      {
        id: "festival_buy",
        label: "Buy a stack of local crafts to sell later",
        flavor: "A risky entrepreneurial venture.",
        risk: "risky",
        outcome:
          "You load up on hand-woven goods. Whether they are worth anything remains to be seen, but the boot now smells wonderful.",
        fundsEffect: -40,
        distanceEffect: 35,
        damageEffect: 0,
      },
    ],
  },
  {
    id: "abandoned_supplies",
    type: "good",
    title: "An Unattended Pile of Useful Things",
    situation:
      "By the side of the road sits a small stack of jerry cans and what looks like a box of mechanical bits. There is no one around. A faded note reads 'TAKE WHAT YOU NEED' in three languages.",
    choices: [
      {
        id: "supplies_take",
        label: "Gratefully take the supplies",
        flavor: "The note did say.",
        risk: "safe",
        outcome:
          "Free fuel and a genuinely useful spare hose. The road trip gods are smiling on you for once. You leave a thank-you note of your own.",
        fundsEffect: 50,
        distanceEffect: 40,
        damageEffect: 8,
      },
      {
        id: "supplies_some",
        label: "Take only what you absolutely need",
        flavor: "Leave some for the next idiots.",
        risk: "safe",
        outcome:
          "You top up a little and take one part. Honourable. The karma will surely pay off later. Probably.",
        fundsEffect: 20,
        distanceEffect: 45,
        damageEffect: 3,
      },
      {
        id: "supplies_suspicious",
        label: "Suspect a trap and drive on",
        flavor: "Trust no one. Especially generous notes.",
        risk: "risky",
        outcome:
          "It was almost certainly not a trap. You have driven past free fuel out of pure paranoia. The others are baffled.",
        fundsEffect: 0,
        distanceEffect: 60,
        damageEffect: 0,
      },
    ],
  },
  {
    id: "lucky_find",
    type: "good",
    title: "Money. Just... Money.",
    situation:
      "Wedged behind the sun visor, which you have only just thought to check, is a roll of local currency left by a previous owner. It is a not-insignificant amount. This is the single greatest thing to happen all trip.",
    choices: [
      {
        id: "find_celebrate",
        label: "Treat the crew to a proper meal",
        flavor: "Share the wealth.",
        risk: "safe",
        outcome:
          "A magnificent roadside feast is had by all. Morale is at an all-time high and you still come out ahead. A perfect outcome.",
        fundsEffect: 60,
        distanceEffect: 30,
        damageEffect: 10,
      },
      {
        id: "find_save",
        label: "Pocket it sensibly for emergencies",
        flavor: "Boring. Correct.",
        risk: "safe",
        outcome:
          "Straight into the kitty. You will need it. You always need it. The car will see to that.",
        fundsEffect: 90,
        distanceEffect: 35,
        damageEffect: 0,
      },
      {
        id: "find_gamble",
        label: "Double it at the next roadside card game",
        flavor: "What could possibly go wrong.",
        risk: "mad",
        outcome:
          "Astonishingly, you win. The locals are gracious losers and even point you towards a shortcut. Never do this again.",
        fundsEffect: 120,
        distanceEffect: 50,
        damageEffect: 0,
      },
    ],
  },
  {
    id: "wildlife_spectacle",
    type: "encounter",
    title: "A Breathtaking Wildlife Moment",
    situation:
      "An enormous herd of animals is crossing the plains ahead, golden light behind them. It is the kind of scene wildlife documentaries spend months waiting for, and you have simply driven into it.",
    choices: [
      {
        id: "wildlife_film",
        label: "Film it all in respectful silence",
        flavor: "Even this lot can appreciate a moment.",
        risk: "safe",
        outcome:
          "The footage is award-worthy. A passing ranger is so pleased you stayed back that they radio ahead and clear the next checkpoint for you.",
        fundsEffect: 25,
        distanceEffect: 30,
        damageEffect: 6,
      },
      {
        id: "wildlife_wait",
        label: "Wait patiently for them to pass",
        flavor: "Patience. A novel concept.",
        risk: "safe",
        outcome:
          "It takes a while, but it is worth every second. You continue refreshed, recharged, and only slightly behind schedule.",
        fundsEffect: 0,
        distanceEffect: 35,
        damageEffect: 5,
      },
      {
        id: "wildlife_edge",
        label: "Edge slowly around the edge of the herd",
        flavor: "Threading a very large, very alive needle.",
        risk: "risky",
        outcome:
          "You make it through with nothing more than a curious headbutt to the door from a large and unbothered beast. Onwards.",
        fundsEffect: 0,
        distanceEffect: 55,
        damageEffect: -5,
      },
    ],
  },
  {
    id: "village_garage",
    type: "navigation",
    title: "A Suspiciously Good Garage",
    situation:
      "A tidy little garage appears in a village, run by a mechanic who clearly knows exactly what they are doing. Prices are chalked on a board and they are, frankly, a bargain. There must be a catch. There is no catch.",
    choices: [
      {
        id: "garage_service",
        label: "Get a proper, honest service",
        flavor: "When did that last happen.",
        risk: "safe",
        outcome:
          "The car runs better than it has in days. The mechanic even throws in a spare part 'for luck.' You drive off slightly emotional.",
        fundsEffect: -50,
        distanceEffect: 45,
        damageEffect: 25,
      },
      {
        id: "garage_chat",
        label: "Just ask for local route advice",
        flavor: "Free wisdom is the best wisdom.",
        risk: "safe",
        outcome:
          "They draw you a map on a napkin that turns out to be better than any satnav. A glorious shortcut opens up ahead.",
        fundsEffect: 0,
        distanceEffect: 75,
        damageEffect: 0,
      },
      {
        id: "garage_haggle",
        label: "Try to haggle the bargain price even lower",
        flavor: "Pushing your luck, as ever.",
        risk: "risky",
        outcome:
          "The mechanic finds your cheek hilarious and gives you a small discount anyway. You leave having saved the price of a sandwich.",
        fundsEffect: -35,
        distanceEffect: 40,
        damageEffect: 20,
      },
    ],
  },
  {
    id: "impromptu_race",
    type: "encounter",
    title: "A Friendly Challenge",
    situation:
      "A local in an even worse car than yours pulls alongside, revs theatrically, and grins. This is a clear and unambiguous invitation to race to the edge of town. The honour of the entire crew is now at stake.",
    choices: [
      {
        id: "race_accept",
        label: "Accept. Obviously. Immediately.",
        flavor: "There was never any choice here.",
        risk: "risky",
        outcome:
          "It is glorious, ridiculous, and you somehow win by a bonnet. The locals cheer and stand you a celebratory drink. Worth it.",
        fundsEffect: 30,
        distanceEffect: 65,
        damageEffect: -8,
      },
      {
        id: "race_wager",
        label: "Accept, and put money on yourself",
        flavor: "Confidence bordering on stupidity.",
        risk: "mad",
        outcome:
          "A nail-biting finish goes your way. The wager pays off handsomely and a legend is born in this small town. Probably.",
        fundsEffect: 80,
        distanceEffect: 60,
        damageEffect: -15,
      },
      {
        id: "race_decline",
        label: "Wave politely and maintain a dignified pace",
        flavor: "The mature option. How disappointing.",
        risk: "safe",
        outcome:
          "You let them go. It is the sensible thing to do and you hate every second of it. The car, at least, is unharmed.",
        fundsEffect: 0,
        distanceEffect: 50,
        damageEffect: 5,
      },
    ],
  },
];

export function pickNextEvent(shownIds: Set<string>): RoadEventTemplate | null {
  const available = ROAD_EVENTS.filter((e) => !shownIds.has(e.id));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}
