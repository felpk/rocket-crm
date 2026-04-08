import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await requireAuth();

  const connection = await prisma.googleAdsConnection.findUnique({
    where: { userId: session.id },
    select: { customerId: true, accountName: true },
  });

  if (!connection) {
    return Response.json({ connected: false });
  }

  return Response.json({
    connected: true,
    customerId: connection.customerId,
    accountName: connection.accountName,
  });
}
