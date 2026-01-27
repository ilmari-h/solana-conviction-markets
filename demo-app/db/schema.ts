import { pgTable, text, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const markets = pgTable(
  "markets",
  {
    address: text("address").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    creatorPubkey: text("creator_pubkey").notNull(),
    rewardSol: numeric("reward_sol", { precision: 20, scale: 9 }).notNull(),
    marketIndex: numeric("market_index").notNull(),
    signature: text("signature").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ([{
    creatorIdx: index("creator_idx").on(table.creatorPubkey),
    createdAtIdx: index("created_at_idx").on(table.createdAt),
  }])
);

export const options = pgTable(
  "options",
  {
    address: text("address").primaryKey(),
    marketAddress: text("market_address").notNull().references(() => markets.address),
    name: text("name").notNull(),
    description: text("description").notNull(),
    creatorPubkey: text("creator_pubkey").notNull(),
    signature: text("signature").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ([{
    marketIdx: index("options_market_idx").on(table.marketAddress),
    creatorIdx: index("options_creator_idx").on(table.creatorPubkey),
    createdAtIdx: index("options_created_at_idx").on(table.createdAt),
  }])
);

export const marketsRelations = relations(markets, ({ many }) => ({
  options: many(options),
}));

export const optionsRelations = relations(options, ({ one }) => ({
  market: one(markets, {
    fields: [options.marketAddress],
    references: [markets.address],
  }),
}));

export type Market = typeof markets.$inferSelect;
export type NewMarket = typeof markets.$inferInsert;

export type Option = typeof options.$inferSelect;
export type NewOption = typeof options.$inferInsert;
