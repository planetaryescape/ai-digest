---
name: auto-generated-tanstack-query-patterns
description: TanStack Query patterns for this project. Polling with exponential backoff, conditional queries, mutation with toast notifications. Triggers on "useQuery", "useMutation", "tanstack query", "react query", "data fetching".
---

# TanStack Query Patterns

Frontend uses TanStack Query (React Query) v5 with polling, exponential backoff, and toast notifications via Sonner.

## Polling with Exponential Backoff

Queries use `refetchInterval` function for smart polling with increasing delays:

```typescript
// From frontend/components/dashboard/DigestTrigger.tsx
const { data: executionStatus } = useQuery({
  queryKey: ["execution-status", executionArn],
  queryFn: async () => {
    if (!executionArn) return null;
    const res = await fetch(`/api/stepfunctions/status?executionArn=${encodeURIComponent(executionArn)}`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to fetch execution status");
    }
    return res.json();
  },
  enabled: !!executionArn && pollingEnabled,
  refetchInterval: (query) => {
    const status = query.state.data?.status;
    if (status === "SUCCEEDED" || status === "FAILED" || status === "ABORTED") {
      return false; // Stop polling
    }
    // Exponential backoff: 5s → 10s → 20s → 30s (max)
    const attemptCount = query.state.dataUpdateCount || 0;
    return Math.min(5000 * 1.5 ** attemptCount, 30000);
  },
  retry: 3,
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
});
```

**Key points:**
- `refetchInterval` receives query object with `state.data` and `state.dataUpdateCount`
- Return `false` to stop polling based on data condition
- Exponential formula: `baseDelay * multiplier ** attemptCount`
- Always cap max delay with `Math.min()`

## Conditional Query Enabling

Use `enabled` flag to control when queries run:

```typescript
// From DigestTrigger.tsx
const { data, error } = useQuery({
  queryKey: ["execution-status", executionArn],
  queryFn: async () => { /* ... */ },
  enabled: !!executionArn && pollingEnabled, // Double condition
  refetchInterval: isPollingEnabled ? 10000 : false,
});
```

**Pattern:**
- `!!variable` ensures boolean for truthy check
- Combine multiple conditions with `&&`
- Use separate state for polling control (`pollingEnabled`)
- Set `refetchInterval: false` when disabled

## Status-Based Polling Termination

Stop polling in `useEffect` when terminal status reached:

```typescript
// From DigestTrigger.tsx
useEffect(() => {
  if (executionStatus?.status === "SUCCEEDED") {
    setPollingEnabled(false);
    toast.success("Digest generation completed successfully!");
    setExecutionArn(null);
  } else if (executionStatus?.status === "FAILED") {
    setPollingEnabled(false);
    toast.error("Digest generation failed. Check logs for details.");
    setExecutionArn(null);
  } else if (executionStatus?.status === "ABORTED") {
    setPollingEnabled(false);
    toast.error("Digest generation was aborted.");
    setExecutionArn(null);
  }
}, [executionStatus?.status]);
```

**Always:**
- Handle terminal statuses: SUCCEEDED, FAILED, ABORTED
- Disable polling first
- Show toast notification
- Clear execution tracking state
- Don't update state in `refetchInterval` (causes render issues)

## Timeout Cleanup Pattern

Add hard timeout to prevent infinite polling:

```typescript
// From DigestTrigger.tsx
useEffect(() => {
  if (executionArn && pollingEnabled) {
    const timeout = setTimeout(() => {
      toast.warning(
        "Execution status check timed out. The process may still be running in the background."
      );
      setPollingEnabled(false);
      setExecutionArn(null);
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearTimeout(timeout);
  }
}, [executionArn, pollingEnabled]);
```

**Pattern:**
- Set timeout only when polling active
- Return cleanup function
- Clear both polling flag and tracking state
- Inform user process may still run

## Error Handling with useEffect

Handle query errors separately from success:

```typescript
// From DigestTrigger.tsx
const { data, error: statusError } = useQuery({
  queryKey: ["execution-status", executionArn],
  queryFn: async () => {
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to fetch execution status");
    }
    return res.json();
  },
  retry: 3,
});

useEffect(() => {
  if (statusError) {
    console.error("Error polling execution status:", statusError);
    toast.error("Unable to check execution status. The process may still be running.");
    setPollingEnabled(false);
    setExecutionArn(null);
  }
}, [statusError]);
```

**Pattern:**
- Name error with descriptive suffix: `statusError`, `fetchError`
- Log to console for debugging
- Show user-friendly toast
- Clean up polling state
- `.catch(() => ({}))` for safe JSON parsing

## Mutation Pattern with Toast Notifications

Use `onSuccess` and `onError` callbacks:

```typescript
// From DigestTrigger.tsx
const triggerMutation = useMutation({
  mutationFn: async (options: {
    cleanup: boolean;
    useStepFunctions: boolean;
    historicalMode: boolean;
    dateRange?: { start: string; end: string };
  }) => {
    const res = await fetch("/api/digest/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || "Failed to trigger digest");
    }

    return res.json();
  },
  onSuccess: (data) => {
    if (data.executionArn) {
      setExecutionArn(data.executionArn);
      setPollingEnabled(true);
      toast.success(`Step Functions pipeline started! Execution: ${data.executionName}`);
    } else {
      toast.success(
        cleanup ? "Cleanup digest generation started!" : "Weekly digest generation started!"
      );
    }
  },
  onError: () => {
    toast.error("Failed to trigger digest generation");
  },
});

// Trigger with typed options
const handleTrigger = () => {
  triggerMutation.mutate({
    cleanup,
    useStepFunctions,
    historicalMode,
    ...(historicalMode && startDate && endDate && {
      dateRange: { start: startDate, end: endDate },
    }),
  });
};
```

**Pattern:**
- Type `mutationFn` parameter for safety
- Throw errors in `mutationFn` to trigger `onError`
- Handle conditional response data in `onSuccess`
- Start polling in `onSuccess` if needed
- Use ternary for context-specific messages

## Query Key Patterns

Structure query keys for proper caching:

```typescript
// Simple key
queryKey: ["executions"]

// Key with parameter
queryKey: ["execution-status", executionArn]
```

**Rules:**
- First element: resource type (string)
- Second element: identifier (string, number, null)
- More specific keys for dependent queries
- Include all variables that affect query result

## Simple Polling Pattern

For lists that need regular updates:

```typescript
// From frontend/components/dashboard/ExecutionHistory.tsx
const [isPollingEnabled, setIsPollingEnabled] = useState(true);

const { data, isLoading, refetch } = useQuery({
  queryKey: ["executions"],
  queryFn: async () => {
    const res = await fetch("/api/stepfunctions/executions?maxResults=10");
    if (!res.ok) throw new Error("Failed to fetch executions");
    return res.json();
  },
  refetchInterval: isPollingEnabled ? 10000 : false, // 10s fixed interval
});

// Cleanup on unmount
useEffect(() => {
  return () => {
    setIsPollingEnabled(false);
  };
}, []);
```

**Pattern:**
- Fixed interval for list queries (10s typical)
- State-controlled polling enable/disable
- Cleanup in unmount effect
- Provide manual `refetch` for user control

## Loading States

Use mutation and query states for UI:

```typescript
// Button disabled during mutation or polling
<Button
  disabled={triggerMutation.isPending || !!executionArn}
  onClick={handleTrigger}
>
  {triggerMutation.isPending || executionArn ? (
    <>
      <Loader2 className="animate-spin" />
      Processing...
    </>
  ) : (
    <>
      <Play />
      Generate Digest
    </>
  )}
</Button>

// Show loading state for initial fetch
if (isLoading) {
  return <Loader2 className="animate-spin" />;
}
```

**States to check:**
- `isPending` - Mutation in flight
- `isLoading` - Initial query load
- `isSuccess` - Mutation succeeded (don't use for queries)
- Custom state - Async operations like polling

## Key Files

- `frontend/components/dashboard/DigestTrigger.tsx` - Complex polling with exponential backoff
- `frontend/components/dashboard/ExecutionHistory.tsx` - Simple list polling
- Uses `sonner` for toast notifications

## Avoid

- Don't update state in `refetchInterval` callback (causes render issues)
- Don't poll without timeout protection
- Don't forget cleanup on unmount
- Don't hardcode error messages (extract from API response)
- Don't use `query.state.data` without null checks
- Don't mix `isLoading` and `isPending` (use correct one for context)
