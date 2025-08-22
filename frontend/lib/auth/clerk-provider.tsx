"use client";

import { ClerkProvider as BaseClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";

const DEMO_PUBLISHABLE_KEY = "pk_test_Y2xlcmsuZXhhbXBsZS5jb20k";

export function ClerkProvider({ children }: { children: ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || DEMO_PUBLISHABLE_KEY;

  if (publishableKey === DEMO_PUBLISHABLE_KEY) {
    console.warn("Using demo Clerk key - authentication will not work");
  }

  return <BaseClerkProvider publishableKey={publishableKey}>{children}</BaseClerkProvider>;
}
