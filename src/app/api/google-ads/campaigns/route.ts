import { requireAuth } from "@/lib/auth";
import { getValidToken, getCampaignMetrics } from "@/lib/google-ads";

export async function GET(req: Request) {
  const session = await requireAuth();
  const url = new URL(req.url);
  const targetUserId = url.searchParams.get("userId");

  const userId =
    session.role === "admin" && targetUserId ? targetUserId : session.id;

  const token = await getValidToken(userId);
  if (!token) {
    return Response.json(
      { error: "Google Ads não conectado" },
      { status: 404 }
    );
  }

  try {
    const campaigns = await getCampaignMetrics(
      token.customerId,
      token.accessToken
    );
    return Response.json(campaigns);
  } catch (error) {
    return Response.json(
      { error: "Falha ao buscar campanhas", details: String(error) },
      { status: 500 }
    );
  }
}
