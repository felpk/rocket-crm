import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST() {
  const session = await requireAuth();

  await prisma.googleAdsConnection.deleteMany({
    where: { userId: session.id },
  });

  return Response.json({ success: true });
}
