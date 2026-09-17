import { z } from "zod";

const text = (limit: number) => z.string().trim().max(limit);
export const letterInput = z.object({
  number: z.number().int().positive().max(999999999),
  year: z.number().int().min(2000).max(2100),
  suffix: text(40).transform((s) => s.toUpperCase()),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s),
  department: text(200).min(1), subject: text(1000).min(1), reference: text(1000),
  recipient: text(1000).min(1), recipientEmail: z.union([z.literal(""), z.string().trim().email().max(254)]).transform((s) => s.toLowerCase()),
  recipientRole: text(300), salutation: text(300), body: text(100000).min(1), closing: text(3000),
  signerName: text(300).min(1), signerRole: text(300).min(1),
  status: z.enum(["Rascunho", "Em revisão"]), notes: text(10000),
});
export function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes("UNIQUE constraint failed") || isUniqueViolation(error.cause);
}
