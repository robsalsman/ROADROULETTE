import { vehicleSideSprite } from "@/data/vehicles";
import { cn } from "@/lib/utils";

type VehicleLike = {
  name?: string | null;
  power?: number | null;
  offRoad?: number | null;
  paintColor?: string | null;
};

interface VehicleSpriteProps {
  vehicle?: VehicleLike | null;
  className?: string;
  imageClassName?: string;
  label?: string;
  paintColor?: string | null;
}

export function getVehicleSprite(vehicle?: VehicleLike | null): string | undefined {
  if (!vehicle?.name) return undefined;
  return vehicleSideSprite(vehicle.name, vehicle.power ?? 5, vehicle.offRoad ?? 5);
}

export default function VehicleSprite({
  vehicle,
  className,
  imageClassName,
  label,
  paintColor,
}: VehicleSpriteProps) {
  const src = getVehicleSprite(vehicle);
  const name = label ?? vehicle?.name ?? "Vehicle";
  const tint = paintColor ?? vehicle?.paintColor ?? null;

  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-md border border-border bg-muted/30 overflow-hidden",
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
      {src && tint && (
        <div
          className="pointer-events-none absolute inset-2 opacity-35 mix-blend-color"
          style={{
            backgroundColor: tint,
            WebkitMaskImage: `url("${src}")`,
            WebkitMaskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskSize: "contain",
            maskImage: `url("${src}")`,
            maskPosition: "center",
            maskRepeat: "no-repeat",
            maskSize: "contain",
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
