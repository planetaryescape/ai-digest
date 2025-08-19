"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle, Clock, Mail, TrendingUp, Users } from "lucide-react";
import { DigestTrigger } from "@/components/dashboard/DigestTrigger";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { StatsCard } from "@/components/dashboard/StatsCard";

export default function DashboardPage() {
  const { data: senders } = useQuery({
    queryKey: ["senders"],
    queryFn: async () => {
      const res = await fetch("/api/senders");
      if (!res.ok) throw new Error("Failed to fetch senders");
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

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium mb-4">Quick Actions</h3>
        <DigestTrigger />
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Senders"
          value={stats.totalSenders}
          icon={Users}
          trend="+12%"
          trendUp={true}
        />
        <StatsCard
          title="High Confidence"
          value={stats.highConfidence}
          icon={CheckCircle}
          trend="+5%"
          trendUp={true}
        />
        <StatsCard
          title="Low Confidence"
          value={stats.lowConfidence}
          icon={AlertCircle}
          trend="-3%"
          trendUp={false}
        />
        <StatsCard
          title="Total Emails"
          value={stats.recentEmails}
          icon={Mail}
          trend="+25%"
          trendUp={true}
        />
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-medium">Recent Activity</h3>
        </div>
        <RecentActivity />
      </div>
    </div>
  );
}
