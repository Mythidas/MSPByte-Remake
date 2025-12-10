"use client";

import { useState } from "react";
import { Button } from "@workspace/ui/components/button";
import { prettyText } from "@workspace/shared/lib/utils";
import { IntegrationStatusBadge } from "./IntegrationStatusBadge";
import { Play, Pause, RefreshCw, Calendar, Database } from "lucide-react";
import { toast } from "sonner";

type SyncControlPanelProps = {
  dataSource: any;
  integration: any;
  onPauseSync?: () => Promise<void>;
  onResumeSync?: () => Promise<void>;
};

export function SyncControlPanel({
  dataSource,
  integration,
  onPauseSync,
  onResumeSync,
}: SyncControlPanelProps) {
  const [isPausing, setIsPausing] = useState(false);

  const isActive = dataSource.status === "active";
  const isSyncing =
    dataSource.syncStatus === "syncing_batch" ||
    dataSource.syncStatus === "syncing_final";

  const handlePause = async () => {
    if (!onPauseSync) return;

    setIsPausing(true);
    try {
      await onPauseSync();
      toast.success("Sync paused");
    } catch (error: any) {
      toast.error(`Failed to pause: ${error.message}`);
    } finally {
      setIsPausing(false);
    }
  };

  const handleResume = async () => {
    if (!onResumeSync) return;

    setIsPausing(true);
    try {
      await onResumeSync();
      toast.success("Sync resumed");
    } catch (error: any) {
      toast.error(`Failed to resume: ${error.message}`);
    } finally {
      setIsPausing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Status Overview */}
      <div className="bg-card/50 border rounded shadow p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <IntegrationStatusBadge status={dataSource.status} />
            </div>
          </div>

          <div className="h-8 w-px bg-border" />

          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Last Sync</p>
              <p className="text-sm font-medium">
                {dataSource.lastSyncAt
                  ? new Date(dataSource.lastSyncAt).toLocaleString()
                  : "Never"}
              </p>
            </div>
          </div>

          {isSyncing && (
            <>
              <div className="h-8 w-px bg-border" />
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    Current Status
                  </p>
                  <p className="text-sm font-medium text-blue-400">
                    {prettyText(dataSource.syncStatus)}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2">
          {isActive ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePause}
              disabled={isPausing}
              className="gap-2"
            >
              <Pause className="w-4 h-4" />
              {isPausing ? "Pausing..." : "Pause All"}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResume}
              disabled={isPausing}
              className="gap-2"
            >
              <Play className="w-4 h-4" />
              {isPausing ? "Resuming..." : "Resume All"}
            </Button>
          )}
        </div>
      </div>

      {/* Info Box */}
      {!isActive && (
        <div className="bg-amber-500/10 border border-amber-500/50 rounded p-4">
          <p className="text-sm text-amber-100">
            The integration is currently paused. Resume it to enable automatic
            syncing.
          </p>
        </div>
      )}
    </div>
  );
}
