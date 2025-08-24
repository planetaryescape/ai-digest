"use client";

import { Bot, Mail, Plus } from "lucide-react";
import { useState } from "react";
import { AddSenderDialog } from "@/components/senders/AddSenderDialog";
import { SenderTable } from "@/components/senders/SenderTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
          <h2 className="text-2xl font-bold">Email Senders</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage email senders for AI digest classification
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Sender
        </Button>
      </div>

      {/* Filter Tabs */}
      <Card>
        <Tabs value={filter} onValueChange={(value) => setFilter(value as FilterType)}>
          <TabsList className="grid w-full grid-cols-3">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.id} value={tab.id} className="flex items-center">
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
          <CardContent className="p-0">
            <TabsContent value={filter} className="m-0">
              <SenderTable filter={filter} />
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Add Sender Dialog */}
      {showAddDialog && (
        <AddSenderDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} />
      )}
    </div>
  );
}
