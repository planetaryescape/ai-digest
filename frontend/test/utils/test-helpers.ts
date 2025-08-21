import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

/**
 * Creates a mock auth response for testing
 */
export function createMockAuth(userId: string | null = 'test-user-123') {
  return {
    userId,
    sessionClaims: null,
    getToken: vi.fn(),
  };
}

/**
 * Creates a mock AWS SDK client
 */
export function createMockAwsClient<T>(mockSend: ReturnType<typeof vi.fn>) {
  return {
    send: mockSend,
    config: {},
    destroy: vi.fn(),
    middlewareStack: {},
  } as unknown as T;
}

/**
 * Creates a React Query wrapper for testing components
 */
export function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchInterval: false },
      mutations: { retry: false },
    },
  });
  
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );
  Wrapper.displayName = 'QueryWrapper';
  return Wrapper;
}

/**
 * Mock console methods for cleaner test output
 */
export function mockConsole() {
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;
  
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  
  return {
    errorSpy,
    warnSpy,
    logSpy,
    restore: () => {
      console.error = originalError;
      console.warn = originalWarn;
      console.log = originalLog;
      errorSpy.mockRestore();
      warnSpy.mockRestore();
      logSpy.mockRestore();
    },
  };
}

/**
 * Common environment variable setup for tests
 */
export function setupTestEnv() {
  process.env.AWS_REGION = 'us-east-1';
  process.env.STEP_FUNCTIONS_STATE_MACHINE_ARN = 'arn:aws:states:us-east-1:123456789012:stateMachine:test-state-machine';
  process.env.LAMBDA_FUNCTION_ARN = 'arn:aws:lambda:us-east-1:123456789012:function:test-function';
  process.env.LAMBDA_DIGEST_FUNCTION_NAME = 'ai-digest-run-now';
}

/**
 * Clean up environment variables after tests
 */
export function cleanupTestEnv() {
  delete process.env.AWS_REGION;
  delete process.env.STEP_FUNCTIONS_STATE_MACHINE_ARN;
  delete process.env.LAMBDA_FUNCTION_ARN;
  delete process.env.LAMBDA_DIGEST_FUNCTION_NAME;
  delete process.env.LAMBDA_RUN_NOW_URL;
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
}