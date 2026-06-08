import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gameSavesTable = pgTable("game_saves", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id"),
  missionId: integer("mission_id").notNull(),
  status: text("status").notNull().default("car_selection"),
  mode: text("mode").notNull().default("arcade"),
  playerName: text("player_name"),
  seriesStageIndex: integer("series_stage_index").notNull().default(0),
  funds: integer("funds").notNull().default(0),
  carId: integer("car_id"),
  food: integer("food").notNull().default(0),
  parts: integer("parts").notNull().default(0),
  camaraderie: integer("camaraderie").notNull().default(0),
  distanceTravelled: integer("distance_travelled").notNull().default(0),
  score: integer("score").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const roadEventsTable = pgTable("road_events", {
  id: serial("id").primaryKey(),
  saveId: integer("save_id").notNull(),
  eventType: text("event_type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  outcome: text("outcome").notNull(),
  fundsChange: integer("funds_change").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGameSaveSchema = createInsertSchema(gameSavesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRoadEventSchema = createInsertSchema(roadEventsTable).omit({ id: true, createdAt: true });
export type InsertGameSave = z.infer<typeof insertGameSaveSchema>;
export type GameSave = typeof gameSavesTable.$inferSelect;
export type RoadEvent = typeof roadEventsTable.$inferSelect;
