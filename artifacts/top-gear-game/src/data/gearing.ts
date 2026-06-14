export type FinalDriveSetup = {
  id: string;
  label: string;
  ratio: number;
  tuningValue: number;
  bias: "Acceleration" | "Balanced" | "Top Speed";
  topSpeedFactor: number;
  wheelTorqueFactor: number;
  launchFactor: number;
};

export const FINAL_DRIVE_SETUPS: FinalDriveSetup[] = [
  { id: "2.73", label: "2.73:1 Highway", ratio: 2.73, tuningValue: 8, bias: "Top Speed", topSpeedFactor: 1.14, wheelTorqueFactor: 0.88, launchFactor: 0.9 },
  { id: "3.08", label: "3.08:1 Long", ratio: 3.08, tuningValue: 28, bias: "Top Speed", topSpeedFactor: 1.07, wheelTorqueFactor: 0.95, launchFactor: 0.96 },
  { id: "3.42", label: "3.42:1 Balanced", ratio: 3.42, tuningValue: 50, bias: "Balanced", topSpeedFactor: 1, wheelTorqueFactor: 1, launchFactor: 1 },
  { id: "3.73", label: "3.73:1 Street", ratio: 3.73, tuningValue: 68, bias: "Acceleration", topSpeedFactor: 0.96, wheelTorqueFactor: 1.07, launchFactor: 1.08 },
  { id: "4.10", label: "4.10:1 Drag", ratio: 4.1, tuningValue: 84, bias: "Acceleration", topSpeedFactor: 0.91, wheelTorqueFactor: 1.15, launchFactor: 1.16 },
  { id: "4.56", label: "4.56:1 Short", ratio: 4.56, tuningValue: 98, bias: "Acceleration", topSpeedFactor: 0.86, wheelTorqueFactor: 1.22, launchFactor: 1.2 },
];

export function finalDriveForGearing(gearing = 50): FinalDriveSetup {
  return FINAL_DRIVE_SETUPS.reduce((best, setup) => (
    Math.abs(setup.tuningValue - gearing) < Math.abs(best.tuningValue - gearing) ? setup : best
  ), FINAL_DRIVE_SETUPS[0]);
}
