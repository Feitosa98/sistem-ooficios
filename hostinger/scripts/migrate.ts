import { getPool } from "../db/index";
import { ensureDatabaseTables } from "../lib/db-migrations";

const pool = getPool();
try {
  console.log("==> Conectando ao MySQL e verificando migrações...");
  const result = await ensureDatabaseTables(pool);
  console.log("==> Resultado da migração:", result);
} catch (err: any) {
  console.error("==> Erro ao executar migração:", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
