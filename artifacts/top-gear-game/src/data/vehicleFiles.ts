import type { GarageRaceHistory, GarageTuning, OwnedVehicle } from "@/services/garageApi";
import type { TuningProjection } from "@/data/vehiclePerformance";
import { finalDriveForGearing } from "@/data/gearing";

export type TuningSlotId = "slot-1" | "slot-2" | "slot-3";
export type PresenterName = "Jeremy" | "Richard" | "James";

export type TuningPreset = {
  name: string;
  tuning: GarageTuning;
  savedAt: string;
};

export type VehicleServiceRecord = {
  id: string;
  type: "acquired" | "upgrade" | "tuning" | "repair" | "race" | "nitrous";
  summary: string;
  createdAt: string;
};

export type PresenterVehicleMessage = {
  id: string;
  presenter: PresenterName;
  prompt: string;
  response: string;
  createdAt: string;
};

export type VehicleFile = {
  canonicalVehicleKey: string;
  tuningPresets: Partial<Record<TuningSlotId, TuningPreset>>;
  serviceRecords: VehicleServiceRecord[];
  presenterMessages: PresenterVehicleMessage[];
};

export type VehicleFileSummary = {
  file: VehicleFile;
  races: number;
  wins: number;
  bestEtMs: number | null;
  bestTrapMph: number | null;
  winnings: number;
};

const SLOT_IDS: TuningSlotId[] = ["slot-1", "slot-2", "slot-3"];

function storageKey(canonicalVehicleKey: string): string {
  return `tgrr-vehicle-file-${canonicalVehicleKey}`;
}

function nowId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadVehicleFile(canonicalVehicleKey: string): VehicleFile {
  try {
    const raw = localStorage.getItem(storageKey(canonicalVehicleKey));
    if (raw) {
      const parsed = JSON.parse(raw) as VehicleFile;
      return {
        canonicalVehicleKey,
        tuningPresets: parsed.tuningPresets ?? {},
        serviceRecords: parsed.serviceRecords ?? [],
        presenterMessages: parsed.presenterMessages ?? [],
      };
    }
  } catch {
    // Ignore corrupt local overlays; the DB-backed garage remains authoritative.
  }
  return { canonicalVehicleKey, tuningPresets: {}, serviceRecords: [], presenterMessages: [] };
}

export function saveVehicleFile(file: VehicleFile): void {
  localStorage.setItem(storageKey(file.canonicalVehicleKey), JSON.stringify(file));
}

export function tuningSlotIds(): TuningSlotId[] {
  return SLOT_IDS;
}

export function saveTuningPreset(canonicalVehicleKey: string, slot: TuningSlotId, tuning: GarageTuning): VehicleFile {
  const file = loadVehicleFile(canonicalVehicleKey);
  file.tuningPresets[slot] = {
    name: `Slot ${slot.split("-")[1]}`,
    tuning,
    savedAt: new Date().toISOString(),
  };
  saveVehicleFile(file);
  return file;
}

export function recordVehicleService(canonicalVehicleKey: string, record: Omit<VehicleServiceRecord, "id" | "createdAt">): VehicleFile {
  const file = loadVehicleFile(canonicalVehicleKey);
  file.serviceRecords = [
    { ...record, id: nowId(), createdAt: new Date().toISOString() },
    ...file.serviceRecords,
  ].slice(0, 50);
  saveVehicleFile(file);
  return file;
}

export function appendPresenterMessage(canonicalVehicleKey: string, message: Omit<PresenterVehicleMessage, "id" | "createdAt">): VehicleFile {
  const file = loadVehicleFile(canonicalVehicleKey);
  file.presenterMessages = [
    { ...message, id: nowId(), createdAt: new Date().toISOString() },
    ...file.presenterMessages,
  ].slice(0, 30);
  saveVehicleFile(file);
  return file;
}

export function summarizeVehicleFile(
  vehicle: Pick<OwnedVehicle, "canonicalVehicleKey">,
  raceHistory: GarageRaceHistory[],
): VehicleFileSummary {
  const races = raceHistory.filter((race) => race.canonicalVehicleKey === vehicle.canonicalVehicleKey);
  return {
    file: loadVehicleFile(vehicle.canonicalVehicleKey),
    races: races.length,
    wins: races.filter((race) => race.won).length,
    bestEtMs: races.length > 0 ? Math.min(...races.map((race) => race.elapsedMs)) : null,
    bestTrapMph: races.length > 0 ? Math.max(...races.map((race) => race.trapSpeed)) : null,
    winnings: races.reduce((total, race) => total + race.rewardCredits, 0),
  };
}

export function presenterTuningAdvice(
  presenter: PresenterName,
  vehicle: Pick<OwnedVehicle, "name" | "tuning" | "upgrades">,
  projection: TuningProjection,
): string {
  const finalDrive = finalDriveForGearing(vehicle.tuning.gearing);
  const hasNitrous = (vehicle.upgrades.nitrous ?? 0) > 0;
  const nitrousLine = hasNitrous
    ? (vehicle.tuning.nitrousShots ?? 0) > 0 ? "Use the nitrous after it is properly hooked up, not while the tyres are still arguing with the road." : "You bought a nitrous kit and then forgot to load it, which is very on brand."
    : "A nitrous kit would give this car a proper party trick without changing the whole engine.";

  if (presenter === "James") {
    if (projection.launchGrip < 72) return `For ${vehicle.name}, I would calm the launch down: soften the initial hit with a touch less launch RPM, use the ${finalDrive.label} only if traction permits it, and aim the suspension around the low-forties rather than simply making everything heroic.`;
    if (projection.topSpeedMph < 150) return `The limiting factor is gearing. Move toward a longer final drive than ${finalDrive.label}, reduce unnecessary downforce, and verify the shift RPM is near the actual power peak rather than just the largest number available.`;
    return `This setup is broadly sensible. Keep ${finalDrive.label}, make small one-change passes, and watch 0-60, trap speed, and launch grip rather than trusting noise. ${nitrousLine}`;
  }

  if (presenter === "Richard") {
    if (projection.zeroToSixty > 4.8) return `It needs to get off the line harder. Try a shorter diff than ${finalDrive.label}, drop the tyre pressure a little, and keep suspension just soft enough to squat without wallowing. Then do one run and see if the 0-60 actually moves.`;
    if (projection.launchGrip < 68) return `You're asking too much of the tyres. Back the launch RPM down, add a bit of rear bite with suspension, and don't hit nitrous until second gear unless you enjoy smoke instead of acceleration.`;
    return `That is close. The fun bit now is tiny changes: one notch of diff, one or two PSI, then compare trap speed and ET. ${nitrousLine}`;
  }

  if (projection.topSpeedMph < 170) return `More speed. Longer final drive than ${finalDrive.label}, less wing, and enough power to make the air get out of the way. Then add nitrous, because obviously.`;
  if (projection.launchGrip < 70) return `Power is not the problem. Grip is. Lower the launch revs, set the tyres to bite, and stop using the throttle like a hammer until the car is moving.`;
  return `Good. It has power, it has enough grip, and ${finalDrive.label} is not completely idiotic. ${nitrousLine}`;
}
