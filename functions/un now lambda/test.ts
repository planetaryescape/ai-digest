import type {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

export default async function testFunction(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  console.log("Test function called");
  
  return {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      success: true,
      message: "Test function working!",
      timestamp: new Date().toISOString(),
      invocationId: context.invocationId,
    }),
  };
}