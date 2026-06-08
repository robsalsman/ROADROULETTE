// Maps a car (by name, with stat fallback) to one of the available vehicle
// sprite archetypes rendered in the side-scroller driving challenge.

export type VehicleArchetype =
  | "offroader"
  | "pickup"
  | "sportscar"
  | "saloon"
  | "van"
  | "motorcycle"
  | "estate";

export function vehicleArchetype(
  name: string,
  power = 5,
  offRoad = 5,
): VehicleArchetype {
  const n = (name ?? "").toLowerCase();

  if (/wave|crf|moto|bike|scooter|cc\b/.test(n)) return "motorcycle";
  if (/pickup|hilux|ranger|truck|\bute\b/.test(n)) return "pickup";
  if (/estate|wagon/.test(n)) return "estate";
  if (/delica|\bape\b|multipla|\bvan\b|combi|bus|minibus/.test(n)) return "van";
  if (
    /defender|land rover|range rover|land cruiser|cruiser|\bjeep\b|cherokee|uaz|vitara|jimny|pajero|patrol|niva|trooper|series|quattro|4x4|wrangler|discovery/.test(
      n,
    )
  )
    return "offroader";
  if (
    /rx-?7|impreza|wrx|skyline|silvia|ae86|gti|\bevo\b|turbo|coupe|\bgt\b|\bgti\b|s13|celica|supra|mx-?5|sti|205 gti/.test(
      n,
    )
  )
    return "sportscar";

  // Stat-based fallback
  if (offRoad >= 7) return "offroader";
  if (power >= 7 && offRoad <= 4) return "sportscar";
  return "saloon";
}

export function vehicleSprite(archetype: VehicleArchetype): string {
  return `/images/vehicles/${archetype}.png`;
}
