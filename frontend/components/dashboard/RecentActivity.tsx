"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle, Clock, Loader2, XCircle } from "lucide-react";

interface Execution {
  executionArn: string;
  name: string;
  status: string;
  startDate: string;
  stopDate?: string;
}

function getActivityIcon(status: string) {
  switch (status) {
    case "RUNNING":
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    case "SUCCEEDED":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "FAILED":
    case "ABORTED":
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return <Clock className="h-5 w-5 text-gray-400" />;
  }
}

function getActivityMessage(execution: Execution): string {
  const name = execution.name;
  const isWeekly = name.toLowerCase().includes("weekly");
  const isCleanup = name.toLowerCase().includes("cleanup");

  const type = isWeekly ? "Weekly digest" : isCleanup ? "Cleanup digest" : "Digest";

  switch (execution.status) {
    case "RUNNING":
      return `${type} is currently processing...`;
    case "SUCCEEDED":
      return `${type} completed successfully`;
    case "FAILED":
      return `${type} failed to complete`;
    case "ABORTED":
      return `${type} was cancelled`;
    default:
      return `${type} execution started`;
  }
}

export function RecentActivity() {
  const { data, isLoading } = useQuery({
    queryKey: ["executions-activity"],
    queryFn: async () => {
      const res = await fetch("/api/stepfunctions/executions?maxResults=5");
      if (!res.ok) {
        throw new Error("Failed to fetch executions");
      }
      return res.json();
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="px-6 py-4">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  const executions: Execution[] = data?.executions || [];

  if (executions.length === 0) {
    return (
      <div className="px-6 py-4">
        <p className="text-sm text-gray-500 text-center py-4">
          No recent activity. Trigger a digest to see activity here.
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-4">
      <ul className="space-y-4">
        {executions.map((execution) => (
          <li key={execution.executionArn} className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              {getActivityIcon(execution.status)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900">{getActivityMessage(execution)}</p>
              <p className="text-xs text-gray-500">
                {formatDistanceToNow(new Date(execution.startDate))} ago
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
