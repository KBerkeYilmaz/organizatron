import { NextRequest, NextResponse } from "next/server";
import { env } from "~/env";
import { db } from "~/server/db";

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
}

interface UserInfo {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (error || !code) {
    console.error("[GoogleOAuth] Auth error:", error);
    return NextResponse.redirect(
      `${appUrl}/settings?error=google_auth_failed`
    );
  }

  // Check if Google OAuth is configured
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(
      `${appUrl}/settings?error=google_not_configured`
    );
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: `${appUrl}/api/auth/google/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("[GoogleOAuth] Token exchange failed:", errorText);
      throw new Error("Token exchange failed");
    }

    const tokens = (await tokenResponse.json()) as TokenResponse;

    // Get user info from Google
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );

    if (!userInfoResponse.ok) {
      throw new Error("Failed to get user info");
    }

    const userInfo = (await userInfoResponse.json()) as UserInfo;

    // Find or create user (simplified - single user for now)
    // In a multi-user app, you'd match this to the logged-in user
    let user = await db.user.findFirst();

    if (!user) {
      user = await db.user.create({
        data: {
          email: userInfo.email,
          name: userInfo.name,
        },
      });
    }

    // Upsert Google account
    await db.googleAccount.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        googleId: userInfo.id,
        email: userInfo.email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope,
      },
      update: {
        googleId: userInfo.id,
        email: userInfo.email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope,
      },
    });

    return NextResponse.redirect(`${appUrl}/settings?success=google_connected`);
  } catch (error) {
    console.error("[GoogleOAuth] Error:", error);
    return NextResponse.redirect(
      `${appUrl}/settings?error=google_auth_failed`
    );
  }
}
