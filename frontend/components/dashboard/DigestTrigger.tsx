"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Play, Trash2, Zap, Activity } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function DigestTrigger() {
  const [cleanup, setCleanup] = useState(false);
  const [useStepFunctions, setUseStepFunctions] = useState(true);
  const [executionArn, setExecutionArn] = useState<string | null>(null);
  const [pollingEnabled, setPollingEnabled] = useState(false);

  // Poll execution status with exponential backoff
  const { data: executionStatus } = useQuery({
    queryKey: ["execution-status", executionArn],
    queryFn: async () => {
      if (!executionArn) return null;
      const res = await fetch(`/api/stepfunctions/status?executionArn=${encodeURIComponent(executionArn)}`);
      if (!res.ok) throw new Error("Failed to fetch execution status");
      return res.json();
    },
    enabled: !!executionArn && pollingEnabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "SUCCEEDED" || status === "FAILED" || status === "ABORTED") {
        // Will be handled in useEffect to avoid state updates during render
        return false;
      }
      // Exponential backoff: 5s → 10s → 20s → 30s (max)
      const attemptCount = query.state.dataUpdateCount || 0;
      return Math.min(5000 * Math.pow(1.5, attemptCount), 30000);
    },
  });

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

  const triggerMutation = useMutation({
    mutationFn: async (options: { cleanup: boolean; useStepFunctions: boolean }) => {
      const res = await fetch("/api/digest/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      });

      if (!res.ok) {
        throw new Error("Failed to trigger digest");
      }

      return res.json();
    },
    onSuccess: (data) => {
      if (data.executionArn) {
        setExecutionArn(data.executionArn);
        setPollingEnabled(true);
        toast.success(
          `Step Functions pipeline started! Execution: ${data.executionName}`
        );
      } else {
        toast.success(
          cleanup
            ? "Cleanup digest generation started! This may take several minutes."
            : "Weekly digest generation started!"
        );
      }
    },
    onError: () => {
      toast.error("Failed to trigger digest generation");
    },
  });

  const handleTrigger = () => {
    triggerMutation.mutate({ cleanup, useStepFunctions });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <button
          onClick={handleTrigger}
          disabled={triggerMutation.isPending || !!executionArn}
          className={cn(
            "flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg",
            "hover:bg-blue-700 transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {triggerMutation.isPending || executionArn ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Play className="h-5 w-5 mr-2" />
              Generate Digest
            </>
          )}
        </button>

        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={cleanup}
            onChange={(e) => setCleanup(e.target.checked)}
            disabled={triggerMutation.isPending || !!executionArn}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">Cleanup Mode</span>
          <Trash2 className="h-4 w-4 text-gray-500" />
        </label>

        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={useStepFunctions}
            onChange={(e) => setUseStepFunctions(e.target.checked)}
            disabled={triggerMutation.isPending || !!executionArn}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">Use Step Functions</span>
          <Zap className="h-4 w-4 text-yellow-500" />
        </label>
      </div>

      {cleanup && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Warning:</strong> Cleanup mode will process ALL unarchived emails. This may take
            significantly longer and will send multiple digest emails.
          </p>
        </div>
      )}

      {useStepFunctions && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Step Functions:</strong> Using the new orchestrated pipeline for better observability and error handling.
          </p>
        </div>
      )}

      {executionArn && executionStatus && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Execution Status</span>
            <span className={cn(
              "px-2 py-1 text-xs font-semibold rounded-full",
              executionStatus.status === "RUNNING" && "bg-blue-100 text-blue-800",
              executionStatus.status === "SUCCEEDED" && "bg-green-100 text-green-800",
              executionStatus.status === "FAILED" && "bg-red-100 text-red-800"
            )}>
              {executionStatus.status}
            </span>
          </div>
          {executionStatus.status === "RUNNING" && (
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-blue-500 animate-pulse" />
              <span className="text-sm text-gray-600">Processing emails through the pipeline...</span>
            </div>
          )}
          <div className="text-xs text-gray-500 font-mono truncate">
            {executionArn.split(':').pop()}
          </div>
        </div>
      )}

      {triggerMutation.isSuccess && !executionArn && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">
            Digest generation has been triggered successfully. You&apos;ll receive an email once it&apos;s
            complete.
          </p>
        </div>
      )}
    </div>
  );
}
