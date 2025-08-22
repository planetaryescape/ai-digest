"use client";

import { Bot, Mail, Plus } from "lucide-react";
import { useState } from "react";
import { AddSenderDialog } from "@/components/senders/AddSenderDialog";
import { SenderTable } from "@/components/senders/SenderTable";
import { cn } from "@/lib/utils";

type FilterType = "all" | "ai" | "non-ai";

export default function SendersPage() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");

  const tabs = [
    { id: "all" as const, label: "All Senders", icon: Mail },
    { id: "ai" as const, label: "AI Senders", icon: Bot },
    { id: "non-ai" as const, label: "Non-AI Senders", icon: Mail },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Email Senders</h2>
          <p className="mt-1 text-sm text-gray-600">
            Manage email senders for AI digest classification
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddDialog(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Sender
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={cn(
                    "flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors",
                    filter === tab.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  )}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sender Table */}
        <SenderTable filter={filter} />
      </div>

      {/* Add Sender Dialog */}
      {showAddDialog && (
        <AddSenderDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} />
      )}
    </div>
  );
}
