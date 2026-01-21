import { NextResponse, type NextRequest } from "next/server";
import { auth } from "~/lib/auth";
import { headers } from "next/headers";

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Get session from Better Auth
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Protected routes - redirect to login if not authenticated
  if (!session) {
    console.log("[Proxy] No session, redirecting to login from:", pathname);
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     * - api routes (handled separately)
     * - login/signup pages (to prevent redirect loops)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api|login|signup).*)",
  ],
};
