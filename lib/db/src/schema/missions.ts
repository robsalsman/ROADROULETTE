import { pgTable, text, serial, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const missionsTable = pgTable("missions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  location: text("location").notNull(),
  terrain: text("terrain").notNull(),
  description: text("description").notNull(),
  budget: integer("budget").notNull(),
  difficulty: text("difficulty").notNull(),
  imageUrl: text("image_url"),
});

export const carsTable = pgTable("cars", {
  id: serial("id").primaryKey(),
  missionId: integer("mission_id").notNull(),
  name: text("name").notNull(),
  year: integer("year").notNull(),
  price: integer("price").notNull(),
  reliability: integer("reliability").notNull(),
  power: integer("power").notNull(),
  offRoad: integer("off_road").notNull(),
  description: text("description").notNull(),
});

export const challengesTable = pgTable("challenges", {
  id: serial("id").primaryKey(),
  missionId: integer("mission_id").notNull(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  description: text("description").notNull(),
});

export const insertMissionSchema = createInsertSchema(missionsTable).omit({ id: true });
export const insertCarSchema = createInsertSchema(carsTable).omit({ id: true });
export const insertChallengeSchema = createInsertSchema(challengesTable).omit({ id: true });
export type InsertMission = z.infer<typeof insertMissionSchema>;
export type Mission = typeof missionsTable.$inferSelect;
export type Car = typeof carsTable.$inferSelect;
export type Challenge = typeof challengesTable.$inferSelect;
