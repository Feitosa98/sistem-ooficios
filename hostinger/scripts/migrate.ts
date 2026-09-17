import mysql, {type RowDataPacket} from "mysql2/promise";
import fs from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";
const uri=process.env.DATABASE_URL;
if(!uri || !uri.startsWith("mysql://"))throw new Error("Informe DATABASE_URL do banco novo e exclusivo.");
const connection=await mysql.createConnection({uri,multipleStatements:false,dateStrings:true});
try{
 const [tables]=await connection.query<RowDataPacket[]>("SELECT TABLE_NAME AS name FROM information_schema.tables WHERE table_schema=DATABASE()");
 const names=tables.map(row=>String(row.name));
 if(!names.includes("oficios_installation")){
  if(names.length)throw new Error("Recusado: o banco informado já contém tabelas. Crie um banco vazio exclusivo.");
  if(process.env.INITIALIZE_EMPTY_DATABASE!=="yes")throw new Error("Defina INITIALIZE_EMPTY_DATABASE=yes somente para o banco vazio exclusivo.");
  await connection.execute("CREATE TABLE oficios_installation (app_id varchar(64) PRIMARY KEY, created_at timestamp DEFAULT CURRENT_TIMESTAMP)");
  await connection.execute("INSERT INTO oficios_installation(app_id) VALUES ('oficios-hostinger-v1')");
  await connection.execute("CREATE TABLE oficios_migrations (name varchar(200) PRIMARY KEY, checksum varchar(64) NOT NULL)");
 }else{
  const [marker]=await connection.execute<RowDataPacket[]>("SELECT app_id FROM oficios_installation");
  if(marker.length!==1 || marker[0].app_id!=="oficios-hostinger-v1")throw new Error("Banco não pertence a esta aplicação.");
 }
 const directory=path.resolve(import.meta.dirname,"../db/migrations");
 for(const name of (await fs.readdir(directory)).filter(name=>name.endsWith(".sql")).sort()){
  const content=await fs.readFile(path.join(directory,name),"utf8");
  const checksum=createHash("sha256").update(content).digest("hex");
  const [applied]=await connection.execute<RowDataPacket[]>("SELECT checksum FROM oficios_migrations WHERE name=?",[name]);
  if(applied[0]){if(applied[0].checksum!==checksum)throw new Error("Migração já aplicada foi modificada: "+name);continue;}
  for(const statement of content.replaceAll("--> statement-breakpoint","").split(";").map(value=>value.trim()).filter(Boolean))await connection.query(statement);
  await connection.execute("INSERT INTO oficios_migrations(name,checksum) VALUES(?,?)",[name,checksum]);
  console.log("Migração aplicada:",name);
 }
}finally{await connection.end();}
