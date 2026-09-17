import OficiosApp from "@/components/oficios-app";
import { requireAccess } from "@/lib/access";
import { HttpError } from "@/lib/api";
import { LoginScreen } from "@/components/login-screen";
export const dynamic = "force-dynamic";
export default async function Page() {
  let user;
  try { user = await requireAccess(); }
  catch (error) {
    const status = error instanceof HttpError ? error.status : 503;
    return <LoginScreen status={status} />;
  }
  return <OficiosApp user={user} />;
}
