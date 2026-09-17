import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const d1Dir = path.resolve(".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
if (!fs.existsSync(d1Dir)) {
  console.log("Diretório do D1 local não encontrado.");
  process.exit(0);
}

const sqliteFiles = fs
  .readdirSync(d1Dir)
  .filter((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite");

if (sqliteFiles.length === 0) {
  console.log("Nenhum banco D1 sqlite encontrado.");
  process.exit(0);
}

const migrationsDir = path.resolve("drizzle");
const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

for (const sqliteFile of sqliteFiles) {
  const dbPath = path.join(d1Dir, sqliteFile);
  console.log(`Aplicando migrações em ${sqliteFile}...`);
  const db = new DatabaseSync(dbPath);

  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, "utf8");
    const statements = content.split("--> statement-breakpoint");
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (trimmed) {
        try {
          db.exec(trimmed);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg.includes("already exists") && !msg.includes("duplicate column")) {
            console.warn(`Aviso em ${file}: ${msg}`);
          }
        }
      }
    }
  }
  console.log(`Migrações concluídas com sucesso em ${sqliteFile}`);
}
