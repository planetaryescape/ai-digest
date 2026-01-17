"use client";

import { useQuery } from "@tanstack/react-query";
import { DollarSign, Loader2, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const BUDGET_LIMIT = 1.0; // $1 per run limit

interface DigestHistoryItem {
  cost?: number;
  date: string;
}

export function CostAnalytics() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["digest-history"],
    queryFn: async () => {
      const res = await fetch("/api/digest/history?limit=10");
      if (!res.ok) {
        throw new Error("Failed to fetch digest history");
      }
      return res.json();
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Cost Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const digests: DigestHistoryItem[] = data?.digests || [];
  const lastRun = digests[0];
  const lastCost = lastRun?.cost || 0;
  const totalCost = digests.reduce((sum, d) => sum + (d.cost || 0), 0);
  const avgCost = digests.length > 0 ? totalCost / digests.length : 0;
  const budgetUsed = (lastCost / BUDGET_LIMIT) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Cost Analytics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Last Run Cost */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Last run</span>
              <span className="text-lg font-semibold">${lastCost.toFixed(2)}</span>
            </div>
            {/* Budget bar */}
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  budgetUsed > 80 ? "bg-red-500" : budgetUsed > 50 ? "bg-yellow-500" : "bg-green-500"
                )}
                style={{ width: `${Math.min(100, budgetUsed)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {budgetUsed.toFixed(0)}% of ${BUDGET_LIMIT.toFixed(2)} budget limit
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div>
              <p className="text-xs text-muted-foreground">Avg per run</p>
              <p className="text-sm font-medium">${avgCost.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last {digests.length} runs</p>
              <p className="text-sm font-medium">${totalCost.toFixed(2)}</p>
            </div>
          </div>

          {/* Monthly estimate */}
          {digests.length > 0 && (
            <div className="pt-2 border-t">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                Est. monthly (8 runs): ${(avgCost * 8).toFixed(2)}
              </div>
            </div>
          )}

          {digests.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              No cost data yet
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
