import { z } from "zod";
import { withAccess } from "../../../../lib/access";
import { HttpError } from "../../../../lib/api";
import { getPkiConfig, publicPkiConfig, savePkiConfig } from "../../../../lib/pki-config";

export const GET = withAccess(async () => Response.json({ config: publicPkiConfig(await getPkiConfig()) }));
const configSchema = z.object({ licenseKey: z.string().max(20000).optional(), restPkiToken: z.string().max(20000).optional(), clearRestPkiToken: z.boolean().optional() });
export const POST = withAccess(async (request) => {
  const input = configSchema.safeParse(await request.json());
  if (!input.success) throw new HttpError(400, "Configuração inválida.");
  return Response.json({ success: true, config: await savePkiConfig(input.data) });
}, true);
