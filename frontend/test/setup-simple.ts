import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// Mock Clerk authentication
vi.mock('@clerk/nextjs', () => ({
  useAuth: vi.fn(() => ({
    userId: 'test-user-123',
    isLoaded: true,
    isSignedIn: true,
  })),
  useUser: vi.fn(() => ({
    user: {
      id: 'test-user-123',
      firstName: 'Test',
      lastName: 'User',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
    },
    isLoaded: true,
    isSignedIn: true,
  })),
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(() => Promise.resolve({
    userId: 'test-user-123',
  })),
}));

// Mock environment variables
process.env.AWS_REGION = 'us-east-1';
process.env.STEP_FUNCTIONS_STATE_MACHINE_ARN = 'arn:aws:states:us-east-1:123456789012:stateMachine:test-state-machine';
process.env.LAMBDA_FUNCTION_ARN = 'arn:aws:lambda:us-east-1:123456789012:function:test-function';

// Mock fetch for tests
global.fetch = vi.fn();

// Clear all mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});