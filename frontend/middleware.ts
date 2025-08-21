import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// All routes are protected except /api/health
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/senders(.*)",
  "/settings(.*)",
  "/api/digest(.*)",
  "/api/senders(.*)",
  "/api/config(.*)",
  "/api/stepfunctions(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
