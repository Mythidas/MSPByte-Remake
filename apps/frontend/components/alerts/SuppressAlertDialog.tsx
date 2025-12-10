"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import { useMutation } from "convex/react";
import { api, Doc, Id } from "@/lib/api";
import { toast } from "sonner";
type Alert = Doc<"entity_alerts">;

interface SuppressAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alerts: Alert[];
  onSuccess?: () => void;
}

export function SuppressAlertDialog({
  open,
  onOpenChange,
  alerts,
  onSuccess,
}: SuppressAlertDialogProps) {
  const [reason, setReason] = useState("");
  const [suppressDays, setSuppressDays] = useState<string>("30");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const suppressAlert = useMutation(api.entity_alerts.mutate.suppressAlert);

  const handleSuppress = async () => {
    if (!reason.trim()) {
      toast.warning("Reason required", {
        description: "Please provide a reason for suppressing the alert(s).",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const suppressedUntil = suppressDays
        ? Date.now() + parseInt(suppressDays) * 24 * 60 * 60 * 1000
        : undefined;

      // Suppress all selected alerts with the same reason
      for (const alert of alerts) {
        await suppressAlert({
          alertId: alert._id,
          reason: reason.trim(),
          suppressedUntil,
        });
      }

      toast("Alert suppressed", {
        description: `Successfully suppressed ${alerts.length} alert${alerts.length !== 1 ? "s" : ""}.`,
      });

      // Reset form
      setReason("");
      setSuppressDays("30");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error("Error", {
        description: "Failed to suppress alerts. Please try again.",
      });
      console.error("Failed to suppress alerts:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            Suppress Alert{alerts.length !== 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription>
            Suppress {alerts.length} alert{alerts.length !== 1 ? "s" : ""}.
            Suppressed alerts will be hidden from the active view.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Enter reason for suppression..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This will be recorded in the audit log
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="duration">Suppression Duration (days)</Label>
            <Input
              id="duration"
              type="number"
              min="1"
              max="365"
              value={suppressDays}
              onChange={(e) => setSuppressDays(e.target.value)}
              placeholder="30"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty for permanent suppression, or specify days until
              auto-reactivation
            </p>
          </div>

          {alerts.length > 1 && (
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm font-medium">Selected Alerts:</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {alerts.slice(0, 3).map((alert) => (
                  <li key={alert._id} className="truncate">
                    • {alert.message}
                  </li>
                ))}
                {alerts.length > 3 && (
                  <li className="text-xs">... and {alerts.length - 3} more</li>
                )}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSuppress} disabled={isSubmitting}>
            {isSubmitting ? "Suppressing..." : "Suppress"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
