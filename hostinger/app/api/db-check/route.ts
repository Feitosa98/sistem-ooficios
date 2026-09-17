import { NextResponse } from "next/server";
import { getPool } from "@/db";
import { ensureDatabaseTables } from "@/lib/db-migrations";
import type { RowDataPacket } from "mysql2/promise";

export const dynamic = "force-dynamic";

export async function GET() {
  const result: any = {
    timestamp: new Date().toISOString(),
    environment: {
      has_DATABASE_URL: !!process.env.DATABASE_URL,
      has_DB_HOST: !!process.env.DB_HOST,
      DB_HOST: process.env.DB_HOST || "(não definido)",
      DB_USER: process.env.DB_USER || "(não definido)",
      DB_NAME: process.env.DB_NAME || process.env.DB_DATABASE || "(não definido)",
      DB_PORT: process.env.DB_PORT || "3306",
      APP_URL: process.env.APP_URL || "(não definido)",
      NODE_ENV: process.env.NODE_ENV,
    },
    connection: "testando...",
  };

  try {
    const pool = getPool();
    const connection = await pool.getConnection();
    result.connection = "Conexão estabelecida com sucesso!";

    try {
      const [dbNameRow] = await connection.query<RowDataPacket[]>("SELECT DATABASE() as db");
      result.database_name = dbNameRow[0]?.db;

      // Executar migração automática se necessário
      const migrationResult = await ensureDatabaseTables(pool);
      result.migration = migrationResult;

      // Listar tabelas existentes
      const [tables] = await connection.query<RowDataPacket[]>(
        "SELECT TABLE_NAME as name FROM information_schema.tables WHERE table_schema = DATABASE()"
      );
      result.tables = tables.map((r) => r.name);
      result.tables_count = tables.length;

      // Verificar usuários cadastrados
      const [users] = await connection.query<RowDataPacket[]>(
        "SELECT id, name, email, role, active FROM app_users"
      );
      result.users = users;

      result.status = "OK";
      result.message = "Banco de dados conectado e verificado com sucesso!";
    } finally {
      connection.release();
    }
  } catch (err: any) {
    result.status = "ERRO";
    result.connection = "FALHA_NA_CONEXAO";
    result.error = {
      message: err.message,
      code: err.code,
      errno: err.errno,
      sqlState: err.sqlState,
    };
  }

  return NextResponse.json(result, { status: result.status === "OK" ? 200 : 500 });
}
