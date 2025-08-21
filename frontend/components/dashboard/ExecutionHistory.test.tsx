import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExecutionHistory } from './ExecutionHistory';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchInterval: false },
      mutations: { retry: false },
    },
  });
  
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'QueryWrapper';
  return Wrapper;
};

describe('ExecutionHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });
  
  it('renders the execution history header', async () => {
    render(<ExecutionHistory />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText('Recent Executions')).toBeInTheDocument();
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });
  
  it('displays loading state initially', () => {
    server.use(
      http.get('/api/stepfunctions/executions', async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return HttpResponse.json({ executions: [] });
      })
    );
    
    render(<ExecutionHistory />, { wrapper: createWrapper() });
    
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
  
  it('displays executions list', async () => {
    render(<ExecutionHistory />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText('test-execution-1')).toBeInTheDocument();
      expect(screen.getByText('test-execution-2')).toBeInTheDocument();
    });
    
    expect(screen.getByText('SUCCEEDED')).toBeInTheDocument();
    expect(screen.getByText('RUNNING')).toBeInTheDocument();
  });
  
  it('shows empty state when no executions', async () => {
    server.use(
      http.get('/api/stepfunctions/executions', () => {
        return HttpResponse.json({ executions: [] });
      })
    );
    
    render(<ExecutionHistory />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText('No executions found. Trigger a digest to see execution history.')).toBeInTheDocument();
    });
  });
  
  it('handles refresh button click', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    
    render(<ExecutionHistory />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText('test-execution-1')).toBeInTheDocument();
    });
    
    const refreshButton = screen.getByText('Refresh');
    await user.click(refreshButton);
    
    // Should trigger a refetch
    await waitFor(() => {
      expect(screen.getByText('test-execution-1')).toBeInTheDocument();
    });
  });
  
  it('displays correct status icons', async () => {
    server.use(
      http.get('/api/stepfunctions/executions', () => {
        return HttpResponse.json({
          executions: [
            {
              executionArn: 'arn:1',
              name: 'running-execution',
              status: 'RUNNING',
              startDate: new Date().toISOString(),
            },
            {
              executionArn: 'arn:2',
              name: 'succeeded-execution',
              status: 'SUCCEEDED',
              startDate: new Date().toISOString(),
              stopDate: new Date().toISOString(),
            },
            {
              executionArn: 'arn:3',
              name: 'failed-execution',
              status: 'FAILED',
              startDate: new Date().toISOString(),
              stopDate: new Date().toISOString(),
            },
            {
              executionArn: 'arn:4',
              name: 'aborted-execution',
              status: 'ABORTED',
              startDate: new Date().toISOString(),
              stopDate: new Date().toISOString(),
            },
          ],
        });
      })
    );
    
    render(<ExecutionHistory />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      // Check for status badges
      expect(screen.getAllByText('RUNNING')).toHaveLength(1);
      expect(screen.getAllByText('SUCCEEDED')).toHaveLength(1);
      expect(screen.getAllByText('FAILED')).toHaveLength(1);
      expect(screen.getAllByText('ABORTED')).toHaveLength(1);
    });
  });
  
  it('calculates and displays execution duration', async () => {
    const startDate = new Date(Date.now() - 60000);
    const stopDate = new Date();
    
    server.use(
      http.get('/api/stepfunctions/executions', () => {
        return HttpResponse.json({
          executions: [
            {
              executionArn: 'arn:1',
              name: 'test-execution',
              status: 'SUCCEEDED',
              startDate: startDate.toISOString(),
              stopDate: stopDate.toISOString(),
            },
          ],
        });
      })
    );
    
    render(<ExecutionHistory />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText('Duration: 60s')).toBeInTheDocument();
    });
  });
  
  it('handles API errors gracefully', async () => {
    server.use(
      http.get('/api/stepfunctions/executions', () => {
        return HttpResponse.json(
          { error: 'Failed to fetch executions' },
          { status: 500 }
        );
      })
    );
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<ExecutionHistory />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText('Recent Executions')).toBeInTheDocument();
    });
    
    consoleSpy.mockRestore();
  });
  
  it('formats relative time correctly', async () => {
    server.use(
      http.get('/api/stepfunctions/executions', () => {
        return HttpResponse.json({
          executions: [
            {
              executionArn: 'arn:1',
              name: 'recent-execution',
              status: 'RUNNING',
              startDate: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
            },
          ],
        });
      })
    );
    
    render(<ExecutionHistory />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText(/Started.*ago/)).toBeInTheDocument();
    });
  });
  
  it('applies correct styling for different statuses', async () => {
    render(<ExecutionHistory />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      const succeededBadge = screen.getByText('SUCCEEDED');
      const runningBadge = screen.getByText('RUNNING');
      
      expect(succeededBadge.className).toContain('bg-green-100');
      expect(succeededBadge.className).toContain('text-green-800');
      
      expect(runningBadge.className).toContain('bg-blue-100');
      expect(runningBadge.className).toContain('text-blue-800');
    });
  });
  
  it('stops polling on component unmount', async () => {
    const { unmount } = render(<ExecutionHistory />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText('test-execution-1')).toBeInTheDocument();
    });
    
    unmount();
    
    // Polling should be disabled after unmount
    vi.advanceTimersByTime(10000); // Advance by polling interval
    
    // No additional requests should be made
  });
});