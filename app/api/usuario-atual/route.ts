import { withAccess } from "../../../lib/access";

export const dynamic = "force-dynamic";

export const GET = withAccess(async (_request, _context, user) => {
  return Response.json({
    user: {
      displayName: user.displayName,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    },
  });
});
