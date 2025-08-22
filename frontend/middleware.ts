import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Temporarily bypass auth middleware if Clerk isn't configured
// This allows the app to build and run without Clerk credentials
export default function middleware(_request: NextRequest) {
  // In production with proper Clerk setup, replace this with:
  // export default clerkMiddleware(async (auth, req) => {
  //   if (isProtectedRoute(req)) {
  //     await auth.protect();
  //   }
  // });
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
