import type { InvocationContext, Timer } from "@azure/functions";
import weeklyDigest from "./functions/weekly-digest";

async function testWeeklyDigest() {
  console.log("Testing weekly-digest function...");

  const mockTimer: Timer = {
    isPastDue: false,
    schedule: { adjustForDST: true },
  };

  const mockContext: InvocationContext = {
    invocationId: "test-" + Date.now(),
    functionName: "weekly-digest",
    options: {},
    retryContext: null,
    traceContext: {
      traceParent: null,
      traceState: null,
      attributes: {},
    },
    triggerMetadata: {},
    log: console.log as any,
    trace: console.log as any,
    debug: console.log as any,
    info: console.log as any,
    warn: console.warn as any,
    error: console.error as any,
  };

  try {
    await weeklyDigest(mockTimer, mockContext);
    console.log("✅ Weekly digest completed successfully");
  } catch (error) {
    console.error("❌ Weekly digest failed:", error);
  }
}

testWeeklyDigest();
