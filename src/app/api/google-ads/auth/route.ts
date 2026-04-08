import { requireAuth } from "@/lib/auth";
import { getAuthUrl } from "@/lib/google-ads";
import jwt from "jsonwebtoken";

export async function GET() {
  const session = await requireAuth();

  const state = jwt.sign(
    { userId: session.id },
    process.env.NEXTAUTH_SECRET!,
    { expiresIn: "10m" }
  );

  const url = getAuthUrl(state);
  return Response.json({ url });
}
