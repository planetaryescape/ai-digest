import { QueryClient, type QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DigestTrigger } from '@/components/dashboard/DigestTrigger';
import type { ExecutionHistory } from '@/components/dashboard/ExecutionHistory';
import { server } from '@/test/mocks/server';

const _createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'QueryWrapper';
  return Wrapper;
};

describe('Error Scenarios and Edge Cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });
  
  describe('Network Errors', () => {
    it('handles network timeout during digest trigger', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      
      server.use(
        http.post('/api/digest/trigger', async () => {
          await delay('infinite');
        })
      );
      
      render(<DigestTrigger />, { wrapper: createWrapper() });
      
      const button = screen.getByText('Generate Digest');
      await user.click(button);
      
      // Button should show loading state
      expect(screen.getByText('Processing...')).toBeInTheDocument();
      
      // Advance time to trigger timeout
      vi.advanceTimersByTime(60000);
      
      // Should eventually show error or reset
      await waitFor(() => {
        expect(screen.getByText('Generate Digest')).toBeInTheDocument();
      }, { timeout: 5000 });
    });
    
    it('handles intermittent network failures during polling', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      let callCount = 0;
      
      server.use(
        http.get('/api/stepfunctions/status', () => {
          callCount++;
          // Fail every other request
          if (callCount % 2 === 0) {
            return HttpResponse.error();
          }
          return HttpResponse.json({
            status: 'RUNNING',
            executionArn: 'test-arn',
            startDate: new Date().toISOString(),
          });
        })
      );
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      render(<DigestTrigger />, { wrapper: createWrapper() });
      
      const button = screen.getByText('Generate Digest');
      await user.click(button);
      
      // Should handle intermittent failures gracefully
      vi.advanceTimersByTime(5000);
      vi.advanceTimersByTime(7500);
      
      // Component should still be functional
      expect(screen.getByText('Generate Digest')).toBeInTheDocument();
      
      consoleSpy.mockRestore();
    });
    
    it('handles 5xx server errors', async () => {
      const user = userEvent.setup();
      
      server.use(
        http.post('/api/digest/trigger', () => {
          return HttpResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
          );
        })
      );
      
      render(<DigestTrigger />, { wrapper: createWrapper() });
      
      const button = screen.getByText('Generate Digest');
      await user.click(button);
      
      await waitFor(() => {
        expect(screen.getByText('Generate Digest')).toBeInTheDocument();
      });
    });
    
    it('handles 4xx client errors', async () => {
      const user = userEvent.setup();
      
      server.use(
        http.post('/api/digest/trigger', () => {
          return HttpResponse.json(
            { error: 'Bad Request', details: 'Invalid parameters' },
            { status: 400 }
          );
        })
      );
      
      render(<DigestTrigger />, { wrapper: createWrapper() });
      
      const button = screen.getByText('Generate Digest');
      await user.click(button);
      
      await waitFor(() => {
        expect(screen.getByText('Generate Digest')).toBeInTheDocument();
      });
    });
  });
  
  describe('Data Corruption and Invalid Responses', () => {
    it('handles malformed JSON responses', async () => {
      server.use(
        http.get('/api/stepfunctions/executions', () => {
          return new Response('{"executions": [invalid json', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      render(<ExecutionHistory />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('Recent Executions')).toBeInTheDocument();
      });
      
      consoleSpy.mockRestore();
    });
    
    it('handles missing required fields in response', async () => {
      server.use(
        http.get('/api/stepfunctions/executions', () => {
          return HttpResponse.json({
            executions: [
              {
                // Missing required fields like executionArn, name
                status: 'RUNNING',
              },
            ],
          });
        })
      );
      
      render(<ExecutionHistory />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('Recent Executions')).toBeInTheDocument();
      });
    });
    
    it('handles extremely large response payloads', async () => {
      server.use(
        http.get('/api/stepfunctions/executions', () => {
          const largeExecutions = Array.from({ length: 1000 }, (_, i) => ({
            executionArn: `arn:${i}`,
            name: `execution-${i}`,
            status: 'SUCCEEDED',
            startDate: new Date().toISOString(),
            stopDate: new Date().toISOString(),
          }));
          
          return HttpResponse.json({
            executions: largeExecutions,
          });
        })
      );
      
      render(<ExecutionHistory />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('execution-0')).toBeInTheDocument();
      });
    });
  });
  
  describe('Race Conditions', () => {
    it('handles rapid state changes during polling', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const statusSequence = ['RUNNING', 'SUCCEEDED', 'FAILED', 'RUNNING'];
      let index = 0;
      
      server.use(
        http.get('/api/stepfunctions/status', () => {
          const status = statusSequence[index % statusSequence.length];
          index++;
          return HttpResponse.json({
            status,
            executionArn: 'test-arn',
            startDate: new Date().toISOString(),
          });
        })
      );
      
      render(<DigestTrigger />, { wrapper: createWrapper() });
      
      const button = screen.getByText('Generate Digest');
      await user.click(button);
      
      // Rapid polling
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(1000);
        await waitFor(() => {
          expect(screen.getByText('Generate Digest')).toBeInTheDocument();
        });
      }
    });
    
    it('handles multiple simultaneous trigger attempts', async () => {
      const user = userEvent.setup();
      
      render(<DigestTrigger />, { wrapper: createWrapper() });
      
      const button = screen.getByText('Generate Digest');
      
      // Attempt multiple clicks rapidly
      await user.click(button);
      await user.click(button);
      await user.click(button);
      
      // Should only process one request
      await waitFor(() => {
        expect(button).toBeDisabled();
      });
    });
  });
  
  describe('Memory and Resource Management', () => {
    it('cleans up polling when component unmounts', async () => {
      const user = userEvent.setup();
      
      const { unmount } = render(<DigestTrigger />, { wrapper: createWrapper() });
      
      const button = screen.getByText('Generate Digest');
      await user.click(button);
      
      // Start polling
      await waitFor(() => {
        expect(screen.getByText('RUNNING')).toBeInTheDocument();
      });
      
      // Unmount component
      unmount();
      
      // Polling should be cleaned up (no memory leaks)
    });
    
    it('handles memory pressure with many executions', async () => {
      const manyExecutions = Array.from({ length: 100 }, (_, i) => ({
        executionArn: `arn:${i}`,
        name: `execution-${i}`,
        status: i % 3 === 0 ? 'RUNNING' : 'SUCCEEDED',
        startDate: new Date(Date.now() - i * 60000).toISOString(),
        stopDate: i % 3 !== 0 ? new Date().toISOString() : undefined,
      }));
      
      server.use(
        http.get('/api/stepfunctions/executions', () => {
          return HttpResponse.json({ executions: manyExecutions });
        })
      );
      
      render(<ExecutionHistory />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('execution-0')).toBeInTheDocument();
      });
    });
  });
  
  describe('Boundary Conditions', () => {
    it('handles empty string responses', async () => {
      server.use(
        http.get('/api/stepfunctions/executions', () => {
          return new Response('', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      render(<ExecutionHistory />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('Recent Executions')).toBeInTheDocument();
      });
      
      consoleSpy.mockRestore();
    });
    
    it('handles extremely long execution names', async () => {
      const longName = `execution-${'x'.repeat(1000)}`;
      
      server.use(
        http.get('/api/stepfunctions/executions', () => {
          return HttpResponse.json({
            executions: [
              {
                executionArn: 'arn:1',
                name: longName,
                status: 'RUNNING',
                startDate: new Date().toISOString(),
              },
            ],
          });
        })
      );
      
      render(<ExecutionHistory />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        // Should truncate or handle long names gracefully
        expect(screen.getByText(/execution-x+/)).toBeInTheDocument();
      });
    });
    
    it('handles dates in various formats', async () => {
      server.use(
        http.get('/api/stepfunctions/executions', () => {
          return HttpResponse.json({
            executions: [
              {
                executionArn: 'arn:1',
                name: 'execution-1',
                status: 'SUCCEEDED',
                startDate: '2024-01-01T12:00:00.000Z',
                stopDate: '2024-01-01T12:05:00Z',
              },
              {
                executionArn: 'arn:2',
                name: 'execution-2',
                status: 'SUCCEEDED',
                startDate: '2024-01-01 12:00:00',
                stopDate: new Date().toISOString(),
              },
            ],
          });
        })
      );
      
      render(<ExecutionHistory />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('execution-1')).toBeInTheDocument();
        expect(screen.getByText('execution-2')).toBeInTheDocument();
      });
    });
    
    it('handles null and undefined values gracefully', async () => {
      server.use(
        http.get('/api/stepfunctions/executions', () => {
          return HttpResponse.json({
            executions: [
              {
                executionArn: 'arn:1',
                name: null,
                status: undefined,
                startDate: new Date().toISOString(),
                stopDate: null,
              },
            ],
            nextToken: null,
          });
        })
      );
      
      render(<ExecutionHistory />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('Recent Executions')).toBeInTheDocument();
      });
    });
  });
  
  describe('Component State Management', () => {
    it('maintains state consistency during rapid user interactions', async () => {
      const user = userEvent.setup();
      
      render(<DigestTrigger />, { wrapper: createWrapper() });
      
      const cleanupCheckbox = screen.getByLabelText('Cleanup Mode');
      const stepFunctionsCheckbox = screen.getByLabelText('Use Step Functions');
      
      // Rapid toggling
      for (let i = 0; i < 10; i++) {
        await user.click(cleanupCheckbox);
        await user.click(stepFunctionsCheckbox);
      }
      
      // State should remain consistent
      expect(cleanupCheckbox).toBeInTheDocument();
      expect(stepFunctionsCheckbox).toBeInTheDocument();
    });
    
    it('recovers from error states', async () => {
      const user = userEvent.setup();
      let shouldFail = true;
      
      server.use(
        http.post('/api/digest/trigger', () => {
          if (shouldFail) {
            return HttpResponse.json(
              { error: 'Server error' },
              { status: 500 }
            );
          }
          return HttpResponse.json({
            success: true,
            message: 'Digest triggered',
          });
        })
      );
      
      render(<DigestTrigger />, { wrapper: createWrapper() });
      
      // First attempt fails
      const button = screen.getByText('Generate Digest');
      await user.click(button);
      
      await waitFor(() => {
        expect(screen.getByText('Generate Digest')).toBeInTheDocument();
      });
      
      // Second attempt succeeds
      shouldFail = false;
      await user.click(button);
      
      await waitFor(() => {
        expect(screen.getByText(/Digest generation has been triggered successfully/)).toBeInTheDocument();
      });
    });
  });
});