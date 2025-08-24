"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddSenderDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AddSenderDialog({ open, onClose }: AddSenderDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    newsletterName: "",
    confidence: 90,
  });

  const addMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/senders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        throw new Error("Failed to add sender");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["senders"] });
      toast.success("Sender added successfully");
      onClose();
    },
    onError: () => {
      toast.error("Failed to add sender");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Sender</DialogTitle>
          <DialogDescription>
            Add a new email sender to the AI digest classification system.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="newsletter@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Sender Name</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="OpenAI Newsletter"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newsletter">Newsletter Name</Label>
              <Input
                id="newsletter"
                type="text"
                value={formData.newsletterName}
                onChange={(e) => setFormData({ ...formData, newsletterName: e.target.value })}
                placeholder="AI Weekly"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confidence">
                Confidence Score ({formData.confidence}%)
              </Label>
              <Input
                id="confidence"
                type="range"
                min="0"
                max="100"
                value={formData.confidence}
                onChange={(e) =>
                  setFormData({ ...formData, confidence: Number.parseInt(e.target.value, 10) })
                }
                className="cursor-pointer"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={addMutation.isPending}>
              {addMutation.isPending ? "Adding..." : "Add Sender"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
