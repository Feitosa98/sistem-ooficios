import { getPool } from "../db";
import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
const MAX_BYTES = 24 * 1024 * 1024;
const CHUNK_BYTES = 256 * 1024;
const bucket = {
 async put(key: string, source: ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string,string> }) {
  const bytes = Buffer.from(source instanceof Uint8Array ? source : new Uint8Array(source));
  if (!key || key.length > 512 || bytes.length > MAX_BYTES) throw new Error("Arquivo excede os limites.");
  const connection = await getPool().getConnection();
  try {
   await connection.beginTransaction();
   const id = randomUUID();
   await connection.execute("INSERT INTO stored_objects (object_key, object_id, content_type, size_bytes) VALUES (?, ?, ?, ?)",[key,id,options?.httpMetadata?.contentType || "application/octet-stream",bytes.length]);
   for(let offset=0,part=0;offset<bytes.length;offset+=CHUNK_BYTES,part++) await connection.execute("INSERT INTO stored_object_chunks(object_id, part_number, data) VALUES(?,?,?)",[id,part,bytes.subarray(offset,offset+CHUNK_BYTES)]);
   await connection.commit();
  } catch(error) { await connection.rollback(); throw error; } finally { connection.release(); }
 },
 async get(key: string) {
  const [rows] = await getPool().execute<RowDataPacket[]>("SELECT object_id,content_type,size_bytes FROM stored_objects WHERE object_key=?",[key]);
  if (!rows[0]) return null;
  const [chunks] = await getPool().execute<RowDataPacket[]>("SELECT data FROM stored_object_chunks WHERE object_id=? ORDER BY part_number",[rows[0].object_id]);
  const bytes = Buffer.concat(chunks.map((chunk) => chunk.data as Buffer));
  if(bytes.length !== Number(rows[0].size_bytes)) throw new Error("Arquivo armazenado incompleto.");
  return { size: bytes.length, body: new Blob([Uint8Array.from(bytes)]).stream(), arrayBuffer: async () => Uint8Array.from(bytes).buffer };
 },
 async delete(key: string) { await getPool().execute("DELETE FROM stored_objects WHERE object_key=?",[key]); }
};
export const env = { BUCKET: bucket };
