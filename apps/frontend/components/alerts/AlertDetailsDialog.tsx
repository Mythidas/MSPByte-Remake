"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Doc } from "@/lib/api";
import { AlertCircle, CheckCircle, EyeOff, Calendar, User } from "lucide-react";
import { prettyText } from "@workspace/shared/lib/utils";

type Alert = Doc<"entity_alerts">;

interface AlertDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alert: Alert | null;
}

export function AlertDetailsDialog({
  open,
  onOpenChange,
  alert,
}: AlertDetailsDialogProps) {
  if (!alert) return null;

  const severityConfig = {
    low: { color: "text-blue-500", bgColor: "bg-blue-500/10", label: "Low" },
    medium: {
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      label: "Medium",
    },
    high: {
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      label: "High",
    },
    critical: {
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      label: "Critical",
    },
  };

  const statusConfig = {
    active: { icon: AlertCircle, color: "text-green-500", label: "Active" },
    suppressed: { icon: EyeOff, color: "text-gray-500", label: "Suppressed" },
    resolved: { icon: CheckCircle, color: "text-blue-500", label: "Resolved" },
  };

  const severity = severityConfig[alert.severity];
  const status = statusConfig[alert.status];
  const StatusIcon = status.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StatusIcon className={`w-5 h-5 ${status.color}`} />
            Alert Details
          </DialogTitle>
          <DialogDescription>{prettyText(alert.alertType)}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Severity and Status */}
          <div className="flex gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Severity
              </p>
              <div
                className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${severity.color} ${severity.bgColor}`}
              >
                {severity.label}
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Status
              </p>
              <div className="inline-flex items-center gap-2">
                <StatusIcon className={`w-4 h-4 ${status.color}`} />
                <span className="text-sm font-medium">{status.label}</span>
              </div>
            </div>
          </div>

          {/* Message */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Message
            </p>
            <p className="text-sm bg-muted/50 rounded-md p-3">
              {alert.message}
            </p>
          </div>

          {/* Metadata */}
          {alert.metadata && Object.keys(alert.metadata).length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Additional Details
              </p>
              <div className="bg-muted/50 rounded-md p-3">
                <pre className="text-xs overflow-x-auto">
                  {JSON.stringify(alert.metadata, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Calendar className="w-4 h-4" />
                <span className="font-medium">Created</span>
              </div>
              <p className="text-sm">
                {new Date(alert._creationTime).toLocaleString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Calendar className="w-4 h-4" />
                <span className="font-medium">Last Updated</span>
              </div>
              <p className="text-sm">
                {new Date(alert.updatedAt).toLocaleString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          {/* Suppression Info */}
          {alert.status === "suppressed" && (
            <div className="bg-muted/50 rounded-md p-3 border-l-4 border-gray-500">
              <div className="flex items-center gap-2 mb-2">
                <EyeOff className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">Suppression Details</span>
              </div>
              {alert.suppressionReason && (
                <div className="mb-2">
                  <p className="text-xs text-muted-foreground">Reason</p>
                  <p className="text-sm">{alert.suppressionReason}</p>
                </div>
              )}
              {alert.suppressedAt && (
                <div className="mb-2">
                  <p className="text-xs text-muted-foreground">Suppressed On</p>
                  <p className="text-sm">
                    {new Date(alert.suppressedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              )}
              {alert.suppressedUntil && (
                <div>
                  <p className="text-xs text-muted-foreground">
                    Suppressed Until
                  </p>
                  <p className="text-sm">
                    {new Date(alert.suppressedUntil).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      },
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Resolved Info */}
          {alert.status === "resolved" && alert.resolvedAt && (
            <div className="bg-muted/50 rounded-md p-3 border-l-4 border-blue-500">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">Resolved</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Resolved On</p>
                <p className="text-sm">
                  {new Date(alert.resolvedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
