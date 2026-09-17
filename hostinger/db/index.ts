import mysql, { type Pool } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "./schema";
const state = globalThis as typeof globalThis & { oficiosPool?: Pool };
export function getPool() {
  if (!state.oficiosPool) {
    const uri = process.env.DATABASE_URL;
    if (!uri || !uri.startsWith("mysql://")) throw new Error("Configure o banco MySQL exclusivo deste sistema.");
    state.oficiosPool = mysql.createPool({ uri, connectionLimit: 5, timezone: "Z", dateStrings: true, charset: "utf8mb4", multipleStatements: false, supportBigNumbers: true });
  }
  return state.oficiosPool;
}
export function getDb() { return drizzle(getPool(), { schema, mode: "default" }); }
