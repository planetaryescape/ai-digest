"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock, CheckCircle, XCircle, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";

interface Execution {
  executionArn: string;
  name: string;
  status: string;
  startDate: string;
  stopDate?: string;
}

export function ExecutionHistory() {
  const [isPollingEnabled, setIsPollingEnabled] = useState(true);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["executions"],
    queryFn: async () => {
      const res = await fetch("/api/stepfunctions/executions?maxResults=10");
      if (!res.ok) throw new Error("Failed to fetch executions");
      return res.json();
    },
    refetchInterval: isPollingEnabled ? 10000 : false, // Only poll when enabled
  });

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      setIsPollingEnabled(false);
    };
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "RUNNING":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "SUCCEEDED":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "FAILED":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "ABORTED":
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "px-2 py-1 text-xs font-semibold rounded-full";
    switch (status) {
      case "RUNNING":
        return cn(baseClasses, "bg-blue-100 text-blue-800");
      case "SUCCEEDED":
        return cn(baseClasses, "bg-green-100 text-green-800");
      case "FAILED":
        return cn(baseClasses, "bg-red-100 text-red-800");
      case "ABORTED":
        return cn(baseClasses, "bg-gray-100 text-gray-800");
      default:
        return cn(baseClasses, "bg-gray-100 text-gray-600");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const executions = data?.executions || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Recent Executions</h3>
        <button
          onClick={() => refetch()}
          className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      {executions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No executions found. Trigger a digest to see execution history.
        </div>
      ) : (
        <div className="space-y-2">
          {executions.map((execution: Execution) => (
            <div
              key={execution.executionArn}
              className="flex items-center justify-between p-3 bg-white border rounded-lg hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center space-x-3">
                {getStatusIcon(execution.status)}
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {execution.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    Started {formatDistanceToNow(new Date(execution.startDate))} ago
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={getStatusBadge(execution.status)}>
                  {execution.status}
                </span>
                {execution.stopDate && (
                  <span className="text-xs text-gray-500">
                    Duration: {Math.round((new Date(execution.stopDate).getTime() - new Date(execution.startDate).getTime()) / 1000)}s
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}