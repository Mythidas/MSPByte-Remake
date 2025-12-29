"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/lib/api";
import type { Doc } from "@workspace/database/convex/_generated/dataModel";
import Loader from "@workspace/ui/components/Loader";
import { Button } from "@workspace/ui/components/button";
import { AlertCircle, RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { syncDattoRMMSites } from "./actions";

export default function DattoRMMOverview() {
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch Datto RMM data source using *_s variant
  const dataSource = useQuery(api.helpers.orm.get_s, {
    secret: process.env.NEXT_PUBLIC_CONVEX_SECRET!,
    tableName: "data_sources",
    index: {
      name: "by_integration",
      params: {
        integrationId: "datto-rmm",
      },
    },
    filters: {
      isPrimary: true,
    },
  }) as Doc<"data_sources"> | undefined;

  // Fetch sites count using *_s variant
  const sites = useQuery(
    api.helpers.orm.list_s,
    dataSource
      ? {
          secret: process.env.NEXT_PUBLIC_CONVEX_SECRET!,
          tableName: "entities",
          index: {
            name: "by_data_source",
            params: {
              dataSourceId: dataSource._id,
            },
          },
          filters: {
            entityType: "companies",
          },
        }
      : "skip"
  ) as Doc<"entities">[] | undefined;

  // Fetch all MSPByte sites to calculate linked count
  const mspSites = useQuery(api.helpers.orm.list_s, {
    secret: process.env.NEXT_PUBLIC_CONVEX_SECRET!,
    tableName: "sites",
  }) as Doc<"sites">[] | undefined;

  // Calculate stats
  const totalSites = sites?.length || 0;
  const linkedCount =
    mspSites?.filter((site) => site.rmmIntegrationId === "datto-rmm").length ||
    0;
  const unlinkedCount = totalSites - linkedCount;

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncDattoRMMSites();
      if (result.success) {
        toast.success(
          `Synced ${result.total} sites: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`
        );
      } else {
        toast.error(`Sync failed: ${result.error}`);
      }
    } catch (error: any) {
      toast.error(`Sync failed: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Show loader while checking for data source
  if (dataSource === undefined) {
    return (
      <div className="flex items-center justify-center size-full">
        <Loader />
      </div>
    );
  }

  // If no data source configured, show setup prompt
  if (!dataSource) {
    return (
      <div className="flex flex-col gap-4 items-center justify-center size-full">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">
            Datto RMM Not Configured
          </p>
          <p className="text-muted-foreground mb-4">
            Please configure your Datto RMM integration first
          </p>
          <Link href="/dattormm/setup">
            <Button>
              <ExternalLink className="w-4 h-4 mr-2" />
              Go to Setup
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-border rounded-lg p-6">
          <div className="text-sm font-medium text-muted-foreground mb-1">
            Total Sites
          </div>
          <div className="text-3xl font-bold">
            {sites === undefined ? (
              <Loader />
            ) : (
              totalSites
            )}
          </div>
        </div>

        <div className="border border-border rounded-lg p-6">
          <div className="text-sm font-medium text-muted-foreground mb-1">
            Linked Sites
          </div>
          <div className="text-3xl font-bold text-green-600">
            {mspSites === undefined ? (
              <Loader />
            ) : (
              linkedCount
            )}
          </div>
        </div>

        <div className="border border-border rounded-lg p-6">
          <div className="text-sm font-medium text-muted-foreground mb-1">
            Unlinked Sites
          </div>
          <div className="text-3xl font-bold text-orange-600">
            {mspSites === undefined ? (
              <Loader />
            ) : (
              unlinkedCount
            )}
          </div>
        </div>
      </div>

      {/* Sync Section */}
      <div className="border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Synchronization</h2>
        <p className="text-muted-foreground mb-4">
          Sync sites from Datto RMM to keep your data up to date
        </p>
        <Button onClick={handleSync} disabled={isSyncing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Syncing..." : "Sync from Datto RMM"}
        </Button>
      </div>

      {/* Quick Links */}
      <div className="border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Links</h2>
        <div className="flex flex-col gap-2">
          <Link
            href="/dattormm/site-mapping"
            className="text-sm text-foreground hover:underline flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Manage Site Mappings
          </Link>
          <Link
            href="/dattormm/setup"
            className="text-sm text-foreground hover:underline flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Configuration Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
