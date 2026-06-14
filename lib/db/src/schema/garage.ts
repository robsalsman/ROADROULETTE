import { jsonb, pgTable, serial, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const playerProfilesTable = pgTable("player_profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default("Road Roulette Driver"),
  credits: integer("credits").notNull().default(240000),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const ownedVehiclesTable = pgTable(
  "owned_vehicles",
  {
    id: serial("id").primaryKey(),
    profileId: integer("profile_id").notNull(),
    canonicalVehicleKey: text("canonical_vehicle_key").notNull(),
    sourceCarId: integer("source_car_id"),
    sourceMissionId: integer("source_mission_id"),
    name: text("name").notNull(),
    year: integer("year").notNull(),
    purchasePrice: integer("purchase_price").notNull(),
    reliability: integer("reliability").notNull(),
    power: integer("power").notNull(),
    offRoad: integer("off_road").notNull(),
    description: text("description").notNull(),
    condition: integer("condition").notNull().default(100),
    paintColor: text("paint_color"),
    isActive: integer("is_active").notNull().default(0),
    upgradesJson: jsonb("upgrades_json").notNull().default({}),
    upgradeSpend: integer("upgrade_spend").notNull().default(0),
    tuningJson: jsonb("tuning_json").notNull().default({}),
    acquiredAt: timestamp("acquired_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    profileVehicleUnique: uniqueIndex("owned_vehicles_profile_vehicle_unique").on(table.profileId, table.canonicalVehicleKey),
  }),
);

export const garageRaceHistoryTable = pgTable("garage_race_history", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  ownedVehicleId: integer("owned_vehicle_id"),
  canonicalVehicleKey: text("canonical_vehicle_key").notNull(),
  opponentKey: text("opponent_key").notNull(),
  opponentName: text("opponent_name").notNull(),
  elapsedMs: integer("elapsed_ms").notNull(),
  opponentElapsedMs: integer("opponent_elapsed_ms").notNull(),
  trapSpeed: integer("trap_speed").notNull(),
  won: integer("won").notNull().default(0),
  rewardCredits: integer("reward_credits").notNull().default(0),
  breakdownJson: jsonb("breakdown_json").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPlayerProfileSchema = createInsertSchema(playerProfilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOwnedVehicleSchema = createInsertSchema(ownedVehiclesTable).omit({ id: true, acquiredAt: true, updatedAt: true });
export const insertGarageRaceHistorySchema = createInsertSchema(garageRaceHistoryTable).omit({ id: true, createdAt: true });

export type InsertPlayerProfile = z.infer<typeof insertPlayerProfileSchema>;
export type PlayerProfile = typeof playerProfilesTable.$inferSelect;
export type InsertOwnedVehicle = z.infer<typeof insertOwnedVehicleSchema>;
export type OwnedVehicle = typeof ownedVehiclesTable.$inferSelect;
export type InsertGarageRaceHistory = z.infer<typeof insertGarageRaceHistorySchema>;
export type GarageRaceHistory = typeof garageRaceHistoryTable.$inferSelect;
