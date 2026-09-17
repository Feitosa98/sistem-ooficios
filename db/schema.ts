import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const letters = sqliteTable(
  "letters",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    version: integer("version").notNull().default(1),
    number: integer("number").notNull(),
    year: integer("year").notNull(),
    suffix: text("suffix").notNull().default(""),
    issueDate: text("issue_date").notNull(),
    department: text("department").notNull(),
    subject: text("subject").notNull(),
    reference: text("reference").notNull().default(""),
    recipient: text("recipient").notNull(),
    recipientEmail: text("recipient_email").notNull().default(""),
    recipientRole: text("recipient_role").notNull().default(""),
    salutation: text("salutation").notNull().default("Prezado(a),"),
    body: text("body").notNull(),
    closing: text("closing").notNull().default(""),
    signerName: text("signer_name").notNull(),
    signerRole: text("signer_role").notNull(),
    status: text("status").notNull().default("Rascunho"),
    notes: text("notes").notNull().default(""),
    signedFileKey: text("signed_file_key"),
    signedFileName: text("signed_file_name"),
    signedFileSize: integer("signed_file_size"),
    signedAt: text("signed_at"),
    sentAt: text("sent_at"),
    signatureProvider: text("signature_provider"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("letters_number_year_suffix_unique").on(
      table.number,
      table.year,
      table.suffix,
    ),
  ],
);

export const documentTemplates = sqliteTable("document_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  department: text("department").notNull().default("RI/RTDPJ"),
  subject: text("subject").notNull().default(""),
  recipient: text("recipient").notNull().default(""),
  recipientRole: text("recipient_role").notNull().default(""),
  salutation: text("salutation").notNull().default("Prezado(a),"),
  body: text("body").notNull().default(""),
  closing: text("closing").notNull().default(""),
  sourceFileKey: text("source_file_key").notNull(),
  sourceFileName: text("source_file_name").notNull(),
  sourceFileType: text("source_file_type").notNull(),
  sourceFileSize: integer("source_file_size").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const emailRecipients = sqliteTable(
  "email_recipients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    organization: text("organization").notNull().default(""),
    email: text("email").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("email_recipients_email_unique").on(table.email)],
);

export const systemSettings = sqliteTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const appUsers = sqliteTable("app_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").unique(),
  role: text("role", { enum: ["admin", "operator"] }).notNull().default("operator"),
  active: integer("active", { mode: "boolean" }).notNull().default(false),
});

export const signatureSessions = sqliteTable("signature_sessions", {
  token: text("token").primaryKey(),
  letterId: integer("letter_id").notNull().references(() => letters.id),
  letterVersion: integer("letter_version").notNull(),
  ownerEmail: text("owner_email").notNull(),
  data: text("data").notNull(),
  preparedFileKey: text("prepared_file_key").notNull(),
  expiresAt: integer("expires_at").notNull(),
  completedFileKey: text("completed_file_key"),
});

export const emailDeliveries = sqliteTable("email_deliveries", {
  id: text("id").primaryKey(),
  letterId: integer("letter_id").notNull().references(() => letters.id),
  ownerEmail: text("owner_email").notNull(),
  recipient: text("recipient").notNull(),
  documentKey: text("document_key").notNull(),
  requestHash: text("request_hash").notNull(),
  state: text("state", { enum: ["sending", "sent", "unknown", "failed"] }).notNull(),
  providerId: text("provider_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("email_delivery_document_recipient_unique").on(table.documentKey, table.recipient)]);

export const auditEvents = sqliteTable("audit_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actorEmail: text("actor_email").notNull(),
  action: text("action").notNull(),
  resourceId: text("resource_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
