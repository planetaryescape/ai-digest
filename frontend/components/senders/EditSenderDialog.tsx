"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { KnownSender } from "@/types/sender";

interface EditSenderDialogProps {
  sender: KnownSender | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditSenderDialog({ sender, open, onOpenChange }: EditSenderDialogProps) {
  const queryClient = useQueryClient();
  const [senderName, setSenderName] = useState("");
  const [newsletterName, setNewsletterName] = useState("");
  const [confidence, setConfidence] = useState(90);
  const [classification, setClassification] = useState<"ai" | "non-ai">("ai");

  // Reset form when sender changes
  useEffect(() => {
    if (sender) {
      setSenderName(sender.senderName || "");
      setNewsletterName(sender.newsletterName || "");
      setConfidence(sender.confidence);
      setClassification("ai"); // Default, as classification isn't stored on sender
    }
  }, [sender]);

  const updateMutation = useMutation({
    mutationFn: async (data: {
      senderName: string;
      newsletterName: string;
      confidence: number;
    }) => {
      if (!sender) return;

      const res = await fetch(`/api/senders/${encodeURIComponent(sender.senderEmail)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error("Failed to update sender");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["senders"] });
      toast.success("Sender updated");
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Failed to update sender");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      senderName,
      newsletterName,
      confidence,
    });
  };

  if (!sender) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Sender</DialogTitle>
          <DialogDescription>{sender.senderEmail}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="senderName">Sender Name</Label>
              <Input
                id="senderName"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="e.g., OpenAI Team"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newsletterName">Newsletter Name</Label>
              <Input
                id="newsletterName"
                value={newsletterName}
                onChange={(e) => setNewsletterName(e.target.value)}
                placeholder="e.g., OpenAI Newsletter"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="classification">Classification</Label>
              <Select
                value={classification}
                onValueChange={(value: "ai" | "non-ai") => setClassification(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select classification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ai">AI Newsletter</SelectItem>
                  <SelectItem value="non-ai">Non-AI Newsletter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confidence">Confidence: {confidence}%</Label>
              <input
                type="range"
                id="confidence"
                min={0}
                max={100}
                value={confidence}
                onChange={(e) => setConfidence(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Low</span>
                <span>High</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
