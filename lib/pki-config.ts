import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { systemSettings } from "../db/schema";

type PkiConfig = { licenseKey: string; restPkiToken: string };
export async function getPkiConfig(): Promise<PkiConfig> {
  const [row] = await getDb().select().from(systemSettings).where(eq(systemSettings.key, "pki_settings")).limit(1);
  const value = row ? JSON.parse(row.value) : {};
  return { licenseKey: String(value.licenseKey || ""), restPkiToken: String(value.restPkiToken || "") };
}
export function publicPkiConfig(config: PkiConfig) {
  return { licenseKey: config.licenseKey, restPkiTokenConfigured: Boolean(config.restPkiToken), certificateValidationConfigured: Boolean(process.env.SIGNATURE_TRUSTED_ROOTS_PEM && process.env.SIGNATURE_CRLS_PEM) };
}
export async function savePkiConfig(config: { licenseKey?: string; restPkiToken?: string; clearRestPkiToken?: boolean }) {
  const current = await getPkiConfig();
  const updated = { licenseKey: config.licenseKey?.trim() ?? current.licenseKey, restPkiToken: config.clearRestPkiToken ? "" : config.restPkiToken?.trim() || current.restPkiToken };
  await getDb().insert(systemSettings).values({ key: "pki_settings", value: JSON.stringify(updated) }).onConflictDoUpdate({ target: systemSettings.key, set: { value: JSON.stringify(updated), updatedAt: sql`CURRENT_TIMESTAMP` } });
  return publicPkiConfig(updated);
}
