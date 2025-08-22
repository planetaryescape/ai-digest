import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/mocks/server";
import { DigestTrigger } from "./DigestTrigger";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "QueryWrapper";
  return Wrapper;
};

describe("DigestTrigger", () => {
  let mockToast: any;

  beforeEach(() => {
    mockToast = {
      success: vi.fn(),
      error: vi.fn(),
    };
    vi.mock("sonner", () => ({
      toast: mockToast,
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the trigger button and checkboxes", () => {
    render(<DigestTrigger />, { wrapper: createWrapper() });

    expect(screen.getByText("Generate Digest")).toBeInTheDocument();
    expect(screen.getByText("Cleanup Mode")).toBeInTheDocument();
    expect(screen.getByText("Use Step Functions")).toBeInTheDocument();
  });

  it("triggers weekly digest with default settings", async () => {
    const user = userEvent.setup();
    render(<DigestTrigger />, { wrapper: createWrapper() });

    const button = screen.getByText("Generate Digest");
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText("Processing...")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText("Generate Digest")).toBeInTheDocument();
    });
  });

  it("shows warning when cleanup mode is selected", async () => {
    const user = userEvent.setup();
    render(<DigestTrigger />, { wrapper: createWrapper() });

    const cleanupCheckbox = screen.getByLabelText("Cleanup Mode");
    await user.click(cleanupCheckbox);

    expect(screen.getByText(/Cleanup mode will process ALL unarchived emails/)).toBeInTheDocument();
  });

  it("shows info when Step Functions is selected", () => {
    render(<DigestTrigger />, { wrapper: createWrapper() });

    expect(screen.getByText(/Using the new orchestrated pipeline/)).toBeInTheDocument();
  });

  it("triggers cleanup digest when cleanup mode is enabled", async () => {
    const user = userEvent.setup();
    render(<DigestTrigger />, { wrapper: createWrapper() });

    const cleanupCheckbox = screen.getByLabelText("Cleanup Mode");
    await user.click(cleanupCheckbox);

    const button = screen.getByText("Generate Digest");
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText("Processing...")).toBeInTheDocument();
    });
  });

  it("polls for execution status when Step Functions is used", async () => {
    const user = userEvent.setup();
    render(<DigestTrigger />, { wrapper: createWrapper() });

    const button = screen.getByText("Generate Digest");
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText("Execution Status")).toBeInTheDocument();
    });

    expect(screen.getByText("RUNNING")).toBeInTheDocument();
    expect(screen.getByText("Processing emails through the pipeline...")).toBeInTheDocument();
  });

  it("handles successful execution completion", async () => {
    server.use(
      http.get("/api/stepfunctions/status", () => {
        return HttpResponse.json({
          status: "SUCCEEDED",
          executionArn: "test-arn",
          startDate: new Date().toISOString(),
        });
      })
    );

    const user = userEvent.setup();
    render(<DigestTrigger />, { wrapper: createWrapper() });

    const button = screen.getByText("Generate Digest");
    await user.click(button);

    await waitFor(
      () => {
        expect(screen.queryByText("Execution Status")).not.toBeInTheDocument();
      },
      { timeout: 5000 }
    );
  });

  it("handles failed execution", async () => {
    server.use(
      http.get("/api/stepfunctions/status", () => {
        return HttpResponse.json({
          status: "FAILED",
          executionArn: "test-arn",
          startDate: new Date().toISOString(),
        });
      })
    );

    const user = userEvent.setup();
    render(<DigestTrigger />, { wrapper: createWrapper() });

    const button = screen.getByText("Generate Digest");
    await user.click(button);

    await waitFor(
      () => {
        expect(screen.queryByText("Execution Status")).not.toBeInTheDocument();
      },
      { timeout: 5000 }
    );
  });

  it("disables controls during processing", async () => {
    const user = userEvent.setup();
    render(<DigestTrigger />, { wrapper: createWrapper() });

    const button = screen.getByText("Generate Digest");
    const cleanupCheckbox = screen.getByLabelText("Cleanup Mode");
    const stepFunctionsCheckbox = screen.getByLabelText("Use Step Functions");

    await user.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
      expect(cleanupCheckbox).toBeDisabled();
      expect(stepFunctionsCheckbox).toBeDisabled();
    });
  });

  it("handles API errors gracefully", async () => {
    server.use(
      http.post("/api/digest/trigger", () => {
        return HttpResponse.json({ error: "Failed to trigger digest" }, { status: 500 });
      })
    );

    const user = userEvent.setup();
    render(<DigestTrigger />, { wrapper: createWrapper() });

    const button = screen.getByText("Generate Digest");
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText("Generate Digest")).toBeInTheDocument();
    });
  });

  it("shows success message for non-Step Functions trigger", async () => {
    const user = userEvent.setup();
    render(<DigestTrigger />, { wrapper: createWrapper() });

    const stepFunctionsCheckbox = screen.getByLabelText("Use Step Functions");
    await user.click(stepFunctionsCheckbox); // Uncheck

    const button = screen.getByText("Generate Digest");
    await user.click(button);

    await waitFor(() => {
      expect(
        screen.getByText(/Digest generation has been triggered successfully/)
      ).toBeInTheDocument();
    });
  });
});
