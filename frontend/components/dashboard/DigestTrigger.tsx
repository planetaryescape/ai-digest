"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Calendar, CheckCircle2, Loader2, Play, Trash2, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export function DigestTrigger() {
  const [cleanup, setCleanup] = useState(false);
  const [useStepFunctions, setUseStepFunctions] = useState(true);
  const [historicalMode, setHistoricalMode] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [executionArn, setExecutionArn] = useState<string | null>(null);
  const [pollingEnabled, setPollingEnabled] = useState(false);

  // Poll execution status with exponential backoff
  const { data: executionStatus, error: statusError } = useQuery({
    queryKey: ["execution-status", executionArn],
    queryFn: async () => {
      if (!executionArn) {
        return null;
      }
      const res = await fetch(
        `/api/stepfunctions/status?executionArn=${encodeURIComponent(executionArn)}`
      );
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
        // Will be handled in useEffect to avoid state updates during render
        return false;
      }
      // Exponential backoff: 5s → 10s → 20s → 30s (max)
      const attemptCount = query.state.dataUpdateCount || 0;
      return Math.min(5000 * 1.5 ** attemptCount, 30000);
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
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

  // Handle status polling errors
  useEffect(() => {
    if (statusError) {
      console.error("Error polling execution status:", statusError);
      toast.error("Unable to check execution status. The process may still be running.");
      // Clear the execution ARN after multiple failed attempts
      setPollingEnabled(false);
      setExecutionArn(null);
    }
  }, [statusError]);

  // Add a maximum timeout for the execution (5 minutes)
  useEffect(() => {
    if (executionArn && pollingEnabled) {
      const timeout = setTimeout(() => {
        toast.warning("Execution status check timed out. The process may still be running in the background.");
        setPollingEnabled(false);
        setExecutionArn(null);
      }, 5 * 60 * 1000); // 5 minutes

      return () => clearTimeout(timeout);
    }
  }, [executionArn, pollingEnabled]);

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
    // Validate date range if in historical mode
    if (historicalMode) {
      if (!startDate || !endDate) {
        toast.error("Please select both start and end dates for historical mode");
        return;
      }
      if (new Date(startDate) > new Date(endDate)) {
        toast.error("Start date must be before end date");
        return;
      }
    }

    const options = {
      cleanup,
      useStepFunctions,
      historicalMode,
      ...(historicalMode &&
        startDate &&
        endDate && {
          dateRange: { start: startDate, end: endDate },
        }),
    };

    triggerMutation.mutate(options);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Digest Generation</CardTitle>
        <CardDescription>
          Generate AI-powered digests from your email newsletters
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Controls */}
        <div className="flex flex-wrap items-center gap-4">
          <Button
            onClick={handleTrigger}
            disabled={triggerMutation.isPending || !!executionArn}
            size="lg"
          >
            {triggerMutation.isPending || executionArn ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Generate Digest
              </>
            )}
          </Button>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="cleanup"
              checked={cleanup}
              onCheckedChange={(checked) => {
                setCleanup(checked as boolean);
                if (checked) {
                  setHistoricalMode(false);
                  setStartDate("");
                  setEndDate("");
                }
              }}
              disabled={triggerMutation.isPending || !!executionArn || historicalMode}
            />
            <Label
              htmlFor="cleanup"
              className="flex items-center space-x-2 cursor-pointer"
            >
              <span>Cleanup Mode</span>
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="stepfunctions"
              checked={useStepFunctions}
              onCheckedChange={(checked) => setUseStepFunctions(checked as boolean)}
              disabled={triggerMutation.isPending || !!executionArn}
            />
            <Label
              htmlFor="stepfunctions"
              className="flex items-center space-x-2 cursor-pointer"
            >
              <span>Use Step Functions</span>
              <Zap className="h-4 w-4 text-yellow-500" />
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="historical"
              checked={historicalMode}
              onCheckedChange={(checked) => {
                setHistoricalMode(checked as boolean);
                if (!checked) {
                  setStartDate("");
                  setEndDate("");
                }
              }}
              disabled={triggerMutation.isPending || !!executionArn || cleanup}
            />
            <Label
              htmlFor="historical"
              className="flex items-center space-x-2 cursor-pointer"
            >
              <span>Historical Mode</span>
              <Calendar className="h-4 w-4 text-indigo-500" />
            </Label>
          </div>
        </div>

        {/* Date Range Selectors for Historical Mode */}
        {historicalMode && !cleanup && (
          <Alert className="border-indigo-200 bg-indigo-50">
            <Calendar className="h-4 w-4" />
            <AlertTitle>Historical Date Range</AlertTitle>
            <AlertDescription className="mt-3 space-y-3">
              <p>Select date range for historical digest:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                    disabled={triggerMutation.isPending || !!executionArn}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    max={new Date().toISOString().split("T")[0]}
                    disabled={triggerMutation.isPending || !!executionArn}
                  />
                </div>
              </div>
              {startDate && endDate && (
                <p className="text-sm text-indigo-600">
                  Will process emails from {new Date(startDate).toLocaleDateString()} to{" "}
                  {new Date(endDate).toLocaleDateString()}
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Cleanup Warning */}
        {cleanup && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              Cleanup mode will process ALL unarchived emails. This may take significantly longer
              and will send multiple digest emails.
            </AlertDescription>
          </Alert>
        )}

        {/* Step Functions Info */}
        {useStepFunctions && (
          <Alert className="border-blue-200 bg-blue-50">
            <Zap className="h-4 w-4" />
            <AlertTitle>Step Functions Enabled</AlertTitle>
            <AlertDescription>
              Using the new orchestrated pipeline for better observability and error handling.
            </AlertDescription>
          </Alert>
        )}

        {/* Execution Status */}
        {executionArn && (
          <Alert>
            <Activity className="h-4 w-4" />
            <AlertTitle className="flex items-center justify-between">
              <span>Execution Status</span>
              <div className="flex items-center gap-2">
                {executionStatus && (
                  <Badge
                    variant={
                      executionStatus.status === "RUNNING"
                        ? "default"
                        : executionStatus.status === "SUCCEEDED"
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {executionStatus.status}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPollingEnabled(false);
                    setExecutionArn(null);
                    toast.info("Execution tracking cleared. The process may still be running in the background.");
                  }}
                >
                  Clear
                </Button>
              </div>
            </AlertTitle>
            <AlertDescription className="mt-2 space-y-2">
              {executionStatus?.status === "RUNNING" && (
                <div className="flex items-center space-x-2">
                  <Activity className="h-4 w-4 animate-pulse" />
                  <span>Processing emails through the pipeline...</span>
                </div>
              )}
              {!executionStatus && (
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Checking execution status...</span>
                </div>
              )}
              <div className="text-xs font-mono text-muted-foreground truncate">
                {executionArn.split(":").pop()}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Success Message */}
        {triggerMutation.isSuccess && !executionArn && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>
              Digest generation has been triggered successfully. You'll receive an email once it's
              complete.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
