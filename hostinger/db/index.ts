import mysql, { type Pool, type PoolOptions } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "./schema";

const state = globalThis as typeof globalThis & { oficiosPool?: Pool };

export function getPool() {
  if (!state.oficiosPool) {
    let poolOptions: PoolOptions;
    const uri = process.env.DATABASE_URL;

    if (uri && uri.startsWith("mysql://")) {
      poolOptions = {
        uri,
        connectionLimit: 5,
        timezone: "Z",
        dateStrings: true,
        charset: "utf8mb4",
        multipleStatements: false,
        supportBigNumbers: true,
      };
    } else if (process.env.DB_HOST && process.env.DB_USER) {
      poolOptions = {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || "3306", 10),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || process.env.DB_DATABASE || "",
        connectionLimit: 5,
        timezone: "Z",
        dateStrings: true,
        charset: "utf8mb4",
        multipleStatements: false,
        supportBigNumbers: true,
      };
    } else {
      throw new Error("Configure a variável DATABASE_URL ou as variáveis DB_HOST, DB_USER, DB_PASSWORD, DB_NAME para conexão com o MySQL.");
    }

    state.oficiosPool = mysql.createPool(poolOptions);
  }
  return state.oficiosPool;
}

export function getDb() { return drizzle(getPool(), { schema, mode: "default" }); }

