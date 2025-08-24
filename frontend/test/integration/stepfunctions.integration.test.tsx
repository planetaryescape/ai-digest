import { QueryClient, type QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DigestTrigger } from "@/components/dashboard/DigestTrigger";
import { ExecutionHistory } from "@/components/dashboard/ExecutionHistory";
import { server } from "@/test/mocks/server";

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
  Wrapper.displayName = "QueryWrapper";
  return Wrapper;
};

describe("Step Functions Integration Workflow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("completes full workflow: trigger → monitor → complete", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    let executionStatus = "RUNNING";

    // Mock dynamic status updates
    server.use(
      http.get("/api/stepfunctions/status", () => {
        return HttpResponse.json({
          status: executionStatus,
          executionArn: "test-arn",
          startDate: new Date().toISOString(),
        });
      })
    );

    // Render both components together
    const { container } = render(
      <div>
        <DigestTrigger />
        <ExecutionHistory />
      </div>,
      { wrapper: createWrapper() }
    );

    // Step 1: Trigger the digest
    const triggerButton = screen.getByText("Generate Digest");
    await user.click(triggerButton);

    // Verify execution started
    await waitFor(() => {
      expect(screen.getByText("Execution Status")).toBeInTheDocument();
      expect(screen.getByText("RUNNING")).toBeInTheDocument();
    });

    // Step 2: Simulate status changes
    vi.advanceTimersByTime(5000); // First poll

    // Change status to SUCCEEDED
    executionStatus = "SUCCEEDED";

    vi.advanceTimersByTime(5000); // Second poll

    // Step 3: Verify completion
    await waitFor(() => {
      expect(screen.queryByText("Execution Status")).not.toBeInTheDocument();
    });
  });

  it("handles failed execution in workflow", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    let executionStatus = "RUNNING";

    server.use(
      http.get("/api/stepfunctions/status", () => {
        return HttpResponse.json({
          status: executionStatus,
          executionArn: "test-arn",
          startDate: new Date().toISOString(),
          ...(executionStatus === "FAILED" && {
            error: "States.TaskFailed",
            cause: "Lambda function timeout",
          }),
        });
      })
    );

    render(<DigestTrigger />, { wrapper: createWrapper() });

    // Trigger the digest
    const triggerButton = screen.getByText("Generate Digest");
    await user.click(triggerButton);

    // Initial running state
    await waitFor(() => {
      expect(screen.getByText("RUNNING")).toBeInTheDocument();
    });

    // Simulate failure
    executionStatus = "FAILED";
    vi.advanceTimersByTime(5000);

    // Verify failure handling
    await waitFor(() => {
      expect(screen.queryByText("Execution Status")).not.toBeInTheDocument();
    });
  });

  it("supports multiple concurrent executions", async () => {
    const user = userEvent.setup();

    let executionCount = 0;
    server.use(
      http.post("/api/digest/trigger", async () => {
        executionCount++;
        return HttpResponse.json({
          success: true,
          executionArn: `arn:aws:states:us-east-1:123456789012:execution:test-state-machine:execution-${executionCount}`,
          executionName: `execution-${executionCount}`,
          message: "Step Functions pipeline started",
        });
      }),
      http.get("/api/stepfunctions/executions", () => {
        const executions = Array.from({ length: executionCount }, (_, i) => ({
          executionArn: `arn:aws:states:us-east-1:123456789012:execution:test-state-machine:execution-${i + 1}`,
          name: `execution-${i + 1}`,
          status: i === executionCount - 1 ? "RUNNING" : "SUCCEEDED",
          startDate: new Date(Date.now() - (executionCount - i) * 60000).toISOString(),
          ...(i < executionCount - 1 && {
            stopDate: new Date(Date.now() - (executionCount - i - 1) * 60000).toISOString(),
          }),
        }));

        return HttpResponse.json({ executions });
      })
    );

    render(
      <div>
        <DigestTrigger />
        <ExecutionHistory />
      </div>,
      { wrapper: createWrapper() }
    );

    // Trigger first execution
    const triggerButton = screen.getByText("Generate Digest");
    await user.click(triggerButton);

    await waitFor(() => {
      expect(screen.getByText("RUNNING")).toBeInTheDocument();
    });

    // Wait for first to complete
    await waitFor(() => {
      expect(screen.queryByText("Execution Status")).not.toBeInTheDocument();
    });

    // Trigger second execution
    await user.click(triggerButton);

    await waitFor(() => {
      expect(screen.getByText("RUNNING")).toBeInTheDocument();
    });
  });

  it("polls status with exponential backoff", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const statusCalls: number[] = [];

    server.use(
      http.get("/api/stepfunctions/status", () => {
        statusCalls.push(Date.now());
        return HttpResponse.json({
          status: "RUNNING",
          executionArn: "test-arn",
          startDate: new Date().toISOString(),
        });
      })
    );

    render(<DigestTrigger />, { wrapper: createWrapper() });

    const triggerButton = screen.getByText("Generate Digest");
    await user.click(triggerButton);

    // Wait for initial status
    await waitFor(() => {
      expect(screen.getByText("RUNNING")).toBeInTheDocument();
    });

    const initialCallCount = statusCalls.length;

    // Advance time and check polling intervals
    vi.advanceTimersByTime(5000); // First interval: 5s
    await waitFor(() => expect(statusCalls.length).toBe(initialCallCount + 1));

    vi.advanceTimersByTime(7500); // Second interval: ~7.5s (5 * 1.5)
    await waitFor(() => expect(statusCalls.length).toBe(initialCallCount + 2));

    vi.advanceTimersByTime(11250); // Third interval: ~11.25s (7.5 * 1.5)
    await waitFor(() => expect(statusCalls.length).toBe(initialCallCount + 3));
  });

  it("refreshes execution history during active execution", async () => {
    const user = userEvent.setup();
    let refreshCount = 0;

    server.use(
      http.get("/api/stepfunctions/executions", () => {
        refreshCount++;
        return HttpResponse.json({
          executions: [
            {
              executionArn: "arn:1",
              name: "execution-1",
              status: refreshCount > 2 ? "SUCCEEDED" : "RUNNING",
              startDate: new Date().toISOString(),
              ...(refreshCount > 2 && { stopDate: new Date().toISOString() }),
            },
          ],
        });
      })
    );

    render(<ExecutionHistory />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("execution-1")).toBeInTheDocument();
    });

    const initialRefreshCount = refreshCount;

    // Click refresh multiple times
    const refreshButton = screen.getByText("Refresh");
    await user.click(refreshButton);

    await waitFor(() => {
      expect(refreshCount).toBeGreaterThan(initialRefreshCount);
    });

    await user.click(refreshButton);
    await user.click(refreshButton);

    // Verify status changed after refreshes
    await waitFor(() => {
      expect(screen.getByText("SUCCEEDED")).toBeInTheDocument();
    });
  });

  it("handles network errors during workflow", async () => {
    const user = userEvent.setup();
    let shouldFail = false;

    server.use(
      http.get("/api/stepfunctions/status", () => {
        if (shouldFail) {
          return HttpResponse.error();
        }
        return HttpResponse.json({
          status: "RUNNING",
          executionArn: "test-arn",
          startDate: new Date().toISOString(),
        });
      })
    );

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<DigestTrigger />, { wrapper: createWrapper() });

    const triggerButton = screen.getByText("Generate Digest");
    await user.click(triggerButton);

    await waitFor(() => {
      expect(screen.getByText("RUNNING")).toBeInTheDocument();
    });

    // Simulate network error
    shouldFail = true;

    // Component should handle error gracefully
    await waitFor(() => {
      expect(screen.getByText("Generate Digest")).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });
});
