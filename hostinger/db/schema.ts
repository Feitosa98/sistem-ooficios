import { sql } from "drizzle-orm";
import { int, mysqlTable, text, varchar, timestamp, bigint, boolean, uniqueIndex } from "drizzle-orm/mysql-core";

export const letters = mysqlTable(
  "letters",
  {
    id: int("id").autoincrement().primaryKey(),
    version: int("version").notNull().default(1),
    number: int("number").notNull(),
    year: int("year").notNull(),
    suffix: varchar("suffix", { length: 40 }).notNull().default(sql`('')`),
    issueDate: text("issue_date").notNull(),
    department: text("department").notNull(),
    subject: text("subject").notNull(),
    reference: text("reference").notNull().default(sql`('')`),
    recipient: varchar("recipient", { length: 254 }).notNull(),
    recipientEmail: text("recipient_email").notNull().default(sql`('')`),
    recipientRole: text("recipient_role").notNull().default(sql`('')`),
    salutation: text("salutation").notNull().default(sql`('Prezado(a),')`),
    body: text("body").notNull(),
    closing: text("closing").notNull().default(sql`('')`),
    signerName: text("signer_name").notNull(),
    signerRole: text("signer_role").notNull(),
    status: text("status").notNull().default(sql`('Rascunho')`),
    notes: text("notes").notNull().default(sql`('')`),
    signedFileKey: varchar("signed_file_key", { length: 512 }),
    signedFileName: text("signed_file_name"),
    signedFileSize: int("signed_file_size"),
    signedAt: timestamp("signed_at", { mode: "string" }),
    sentAt: timestamp("sent_at", { mode: "string" }),
    signatureProvider: text("signature_provider"),
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("letters_number_year_suffix_unique").on(
      table.number,
      table.year,
      table.suffix,
    ),
  ],
);

export const documentTemplates = mysqlTable("document_templates", {
  id: int("id").autoincrement().primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(sql`('')`),
  department: text("department").notNull().default(sql`('RI/RTDPJ')`),
  subject: text("subject").notNull().default(sql`('')`),
  recipient: varchar("recipient", { length: 254 }).notNull().default(sql`('')`),
  recipientRole: text("recipient_role").notNull().default(sql`('')`),
  salutation: text("salutation").notNull().default(sql`('Prezado(a),')`),
  body: text("body").notNull().default(sql`('')`),
  closing: text("closing").notNull().default(sql`('')`),
  sourceFileKey: varchar("source_file_key", { length: 512 }).notNull(),
  sourceFileName: text("source_file_name").notNull(),
  sourceFileType: text("source_file_type").notNull(),
  sourceFileSize: int("source_file_size").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
});

export const emailRecipients = mysqlTable(
  "email_recipients",
  {
    id: int("id").autoincrement().primaryKey(),
    name: text("name").notNull(),
    organization: text("organization").notNull().default(sql`('')`),
    email: varchar("email", { length: 254 }).notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("email_recipients_email_unique").on(table.email)],
);

export const systemSettings = mysqlTable("system_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
});

export const appUsers = mysqlTable("app_users", {
  id: int("id").autoincrement().primaryKey(),
  name: text("name").notNull(),
  passwordHash: varchar("password_hash", { length: 255 }),
  emailVerifiedAt: timestamp("email_verified_at", { mode: "string" }),
  authVersion: int("auth_version").notNull().default(1),
  email: varchar("email", { length: 254 }).unique(),
  role: varchar("role", { length: 32 }).notNull().default("operator"),
  active: boolean("active").notNull().default(false),
});

export const signatureSessions = mysqlTable("signature_sessions", {
  token: varchar("token", { length: 64 }).primaryKey(),
  letterId: int("letter_id").notNull().references(() => letters.id),
  letterVersion: int("letter_version").notNull(),
  ownerEmail: varchar("owner_email", { length: 254 }).notNull(),
  data: text("data").notNull(),
  preparedFileKey: varchar("prepared_file_key", { length: 512 }).notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  completedFileKey: varchar("completed_file_key", { length: 512 }),
});

export const emailDeliveries = mysqlTable("email_deliveries", {
  id: varchar("id", { length: 100 }).primaryKey(),
  letterId: int("letter_id").notNull().references(() => letters.id),
  ownerEmail: varchar("owner_email", { length: 254 }).notNull(),
  recipient: varchar("recipient", { length: 254 }).notNull(),
  documentKey: varchar("document_key", { length: 512 }).notNull(),
  requestHash: varchar("request_hash", { length: 100 }).notNull(),
  state: varchar("state", { length: 32 }).notNull(),
  providerId: varchar("provider_id", { length: 100 }),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => [uniqueIndex("email_delivery_document_recipient_unique").on(table.documentKey, table.recipient)]);

export const auditEvents = mysqlTable("audit_events", {
  id: int("id").autoincrement().primaryKey(),
  actorEmail: varchar("actor_email", { length: 254 }).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  resourceId: varchar("resource_id", { length: 100 }).notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
});
