"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  DollarSign,
  Lightbulb,
  Loader2,
  Mail,
  Target,
} from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DigestHistoryItem {
  executionArn: string;
  name: string;
  date: string;
  status: string;
  headline?: string;
  summary?: string;
  emailsProcessed?: number;
  aiEmails?: number;
  cost?: number;
  keyInsights?: string[];
  actionItems?: string[];
  duration?: number;
}

function DigestRow({ digest }: { digest: DigestHistoryItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">
              {digest.headline || digest.name}
            </div>
            <div className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(digest.date))} ago
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0 text-sm text-muted-foreground">
          {digest.emailsProcessed !== undefined && (
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {digest.emailsProcessed}
            </span>
          )}
          {digest.cost !== undefined && (
            <span className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              ${digest.cost.toFixed(2)}
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t bg-muted/30">
          <div className="pt-4 space-y-4">
            {/* Summary */}
            {digest.summary && (
              <p className="text-sm text-muted-foreground">{digest.summary}</p>
            )}

            {/* Key Insights */}
            {digest.keyInsights && digest.keyInsights.length > 0 && (
              <div>
                <h4 className="text-sm font-medium flex items-center gap-1 mb-2">
                  <Lightbulb className="h-4 w-4" />
                  Key Insights
                </h4>
                <ul className="space-y-1">
                  {digest.keyInsights.map((insight, i) => (
                    <li key={i} className="text-sm text-muted-foreground pl-4 relative">
                      <span className="absolute left-0">•</span>
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Items */}
            {digest.actionItems && digest.actionItems.length > 0 && (
              <div>
                <h4 className="text-sm font-medium flex items-center gap-1 mb-2">
                  <Target className="h-4 w-4" />
                  Action Items
                </h4>
                <ul className="space-y-1">
                  {digest.actionItems.map((item, i) => (
                    <li key={i} className="text-sm text-muted-foreground pl-4 relative">
                      <span className="absolute left-0">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Stats row */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
              {digest.aiEmails !== undefined && (
                <span>{digest.aiEmails} AI emails</span>
              )}
              {digest.duration !== undefined && (
                <span>Processed in {digest.duration}s</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function DigestHistory() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["digest-history"],
    queryFn: async () => {
      const res = await fetch("/api/digest/history?limit=5");
      if (!res.ok) {
        throw new Error("Failed to fetch digest history");
      }
      return res.json();
    },
    refetchInterval: 60000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Recent Digests</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Failed to load digest history
          </p>
        ) : !data?.digests?.length ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No digests yet. Trigger your first digest to see history.
          </p>
        ) : (
          <div className="space-y-2">
            {data.digests.map((digest: DigestHistoryItem) => (
              <DigestRow key={digest.executionArn} digest={digest} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
