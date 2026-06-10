import { vehicleArchetype, vehicleSprite } from "@/data/vehicles";
import { cn } from "@/lib/utils";

type VehicleLike = {
  name?: string | null;
  power?: number | null;
  offRoad?: number | null;
};

interface VehicleSpriteProps {
  vehicle?: VehicleLike | null;
  className?: string;
  imageClassName?: string;
  label?: string;
}

export function getVehicleSprite(vehicle?: VehicleLike | null): string | undefined {
  if (!vehicle?.name) return undefined;
  return vehicleSprite(vehicleArchetype(vehicle.name, vehicle.power ?? 5, vehicle.offRoad ?? 5));
}

export default function VehicleSprite({
  vehicle,
  className,
  imageClassName,
  label,
}: VehicleSpriteProps) {
  const src = getVehicleSprite(vehicle);
  const name = label ?? vehicle?.name ?? "Vehicle";

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md border border-border bg-muted/30 overflow-hidden",
        className,
      )}
      aria-label={name}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          className={cn("h-full w-full object-contain p-2", imageClassName)}
          draggable={false}
        />
      ) : (
        <div className="text-xs font-black uppercase text-muted-foreground">Car</div>
      )}
    </div>
  );
}
