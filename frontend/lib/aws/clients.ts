import { LambdaClient } from "@aws-sdk/client-lambda";
import { SFNClient } from "@aws-sdk/client-sfn";

let sfnClient: SFNClient | null = null;
let lambdaClient: LambdaClient | null = null;

export function getSFNClient(): SFNClient {
  if (!sfnClient) {
    sfnClient = new SFNClient({
      region: process.env.AWS_REGION || "us-east-1",
      ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
          }
        : {}),
    });
  }
  return sfnClient;
}

export function getLambdaClient(): LambdaClient {
  if (!lambdaClient) {
    lambdaClient = new LambdaClient({
      region: process.env.AWS_REGION || "us-east-1",
      ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
          }
        : {}),
    });
  }
  return lambdaClient;
}
