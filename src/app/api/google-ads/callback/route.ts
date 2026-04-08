import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/db";
import { exchangeCodeForTokens, listAccessibleAccounts } from "@/lib/google-ads";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code || !state) {
    redirect("/settings?error=google-ads-denied");
  }

  let userId: string;
  try {
    const payload = jwt.verify(state, process.env.NEXTAUTH_SECRET!) as {
      userId: string;
    };
    userId = payload.userId;
  } catch {
    redirect("/settings?error=google-ads-invalid-state");
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const accounts = await listAccessibleAccounts(tokens.access_token);

    if (accounts.length === 0) {
      redirect("/settings?error=google-ads-no-accounts");
    }

    const customerId = accounts[0];
    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.googleAdsConnection.upsert({
      where: { userId },
      create: {
        userId,
        customerId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry,
      },
      update: {
        customerId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry,
      },
    });
  } catch (err) {
    console.error("Google Ads OAuth error:", err);
    redirect("/settings?error=google-ads-failed");
  }

  redirect("/settings?connected=google-ads");
}
