import "@testing-library/jest-dom";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { handlers } from "./mocks/handlers";

// Mock environment variables
process.env.GMAIL_CLIENT_ID = "test-client-id";
process.env.GMAIL_CLIENT_SECRET = "test-client-secret";
process.env.GMAIL_REFRESH_TOKEN = "test-refresh-token";
process.env.OPENAI_API_KEY = "test-openai-key";
process.env.HELICONE_API_KEY = "test-helicone-key";
process.env.RESEND_API_KEY = "test-resend-key";
process.env.RESEND_FROM = "test@example.com";
process.env.RECIPIENT_EMAIL = "recipient@example.com";
process.env.DYNAMODB_TABLE_NAME = "test-table";
process.env.S3_BUCKET = "test-bucket";
process.env.AWS_REGION = "us-east-1";

// Setup MSW server
export const server = setupServer(...handlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

afterAll(() => {
  server.close();
  vi.restoreAllMocks();
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
