"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle, Mail, Users } from "lucide-react";
import { CostAnalytics } from "@/components/dashboard/CostAnalytics";
import { DigestHistory } from "@/components/dashboard/DigestHistory";
import { DigestTrigger } from "@/components/dashboard/DigestTrigger";
import { ExecutionHistory } from "@/components/dashboard/ExecutionHistory";
import { NextDigestCountdown } from "@/components/dashboard/NextDigestCountdown";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { StatsCard } from "@/components/dashboard/StatsCard";

export default function DashboardPage() {
  const { data: senders } = useQuery({
    queryKey: ["senders"],
    queryFn: async () => {
      const res = await fetch("/api/senders");
      if (!res.ok) {
        throw new Error("Failed to fetch senders");
      }
      return res.json();
    },
  });

  const stats = {
    totalSenders: senders?.length || 0,
    highConfidence: senders?.filter((s: any) => s.confidence >= 90).length || 0,
    lowConfidence: senders?.filter((s: any) => s.confidence < 70).length || 0,
    recentEmails: senders?.reduce((sum: number, s: any) => sum + (s.emailCount || 0), 0) || 0,
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="mt-1 text-sm text-gray-600">
          Manage your AI newsletter digest and monitor sender statistics
        </p>
      </div>

      {/* Top Row: Next Digest + Trigger */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NextDigestCountdown />
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium mb-4">Quick Actions</h3>
          <DigestTrigger />
        </div>
      </div>

      {/* Statistics Grid - No fake trends */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Senders"
          value={stats.totalSenders}
          icon={Users}
        />
        <StatsCard
          title="High Confidence"
          value={stats.highConfidence}
          icon={CheckCircle}
        />
        <StatsCard
          title="Low Confidence"
          value={stats.lowConfidence}
          icon={AlertCircle}
        />
        <StatsCard
          title="Total Emails"
          value={stats.recentEmails}
          icon={Mail}
        />
      </div>

      {/* Digest History */}
      <DigestHistory />

      {/* Bottom Row: Recent Activity + Cost Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-medium">Recent Activity</h3>
          </div>
          <RecentActivity />
        </div>

        {/* Cost Analytics */}
        <CostAnalytics />
      </div>

      {/* Executions - Keep existing component */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4">
          <ExecutionHistory />
        </div>
      </div>
    </div>
  );
}
