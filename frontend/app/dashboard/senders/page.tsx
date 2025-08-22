"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { AddSenderDialog } from "@/components/senders/AddSenderDialog";
import { SenderTable } from "@/components/senders/SenderTable";

export default function SendersPage() {
  const [showAddDialog, setShowAddDialog] = useState(false);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Known AI Senders</h2>
          <p className="mt-1 text-sm text-gray-600">
            Manage approved and rejected email senders for AI digest classification
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

      {/* Sender Table */}
      <div className="bg-white rounded-lg shadow">
        <SenderTable />
      </div>

      {/* Add Sender Dialog */}
      {showAddDialog && (
        <AddSenderDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} />
      )}
    </div>
  );
}
