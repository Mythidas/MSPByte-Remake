"use client";

import { api, Doc } from "@/lib/api";
import { useQuery } from "convex/react";
import { IntegrationStatusBadge } from "@/components/integrations/IntegrationStatusBadge";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { prettyText } from "@workspace/shared/lib/utils";
import Loader from "@workspace/ui/components/Loader";
import Link from "next/link";
import {
  Activity,
  Calendar,
  Database,
  Building2,
  AlertCircle,
  Settings,
  Play,
} from "lucide-react";
import { INTEGRATIONS } from "@workspace/shared/types/integrations/config";

export default function HaloPSAOverview() {
  const integration = INTEGRATIONS["halopsa"];
  const dataSource = useQuery(api.helpers.orm.get, {
    tableName: "data_sources",
    index: {
      name: "by_integration",
      params: {
        integrationId: "halopsa",
      },
    },
    filters: {
      isPrimary: true,
    },
  }) as Doc<"data_sources"> | undefined;

  const companies = useQuery(
    api.helpers.orm.list,
    dataSource
      ? {
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
      : "skip",
  );
  const primaryDataSource = dataSource;
  const hasConfiguration = !!primaryDataSource;

  if (primaryDataSource === undefined) {
    return <Loader />;
  }

  return (
    <div className="flex flex-col gap-4 size-full">
      {/* Integration Header Card */}
      <div className="bg-card/50 border rounded shadow p-6 flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              {integration.icon_url && (
                <img
                  src={integration.icon_url}
                  alt={integration.name}
                  className="w-12 h-12 rounded"
                />
              )}
              <div>
                <h1 className="text-2xl font-semibold">{integration.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {prettyText(integration.category)} Integration
                </p>
              </div>
            </div>
            <p className="text-muted-foreground max-w-2xl">
              {integration.description}
            </p>
          </div>
          <div className="flex gap-2">
            {hasConfiguration ? (
              <IntegrationStatusBadge
                status={primaryDataSource.status}
                className="text-sm"
              />
            ) : (
              <Badge variant="secondary">Not Configured</Badge>
            )}
          </div>
        </div>

        {/* Primary CTAs */}
        <div className="flex gap-2">
          {!hasConfiguration ? (
            <Link href="/secure/default/integrations/halopsa/setup">
              <Button className="gap-2">
                <Settings className="w-4 h-4" />
                Configure Integration
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/secure/default/integrations/halopsa/sync">
                <Button className="gap-2">
                  <Play className="w-4 h-4" />
                  Manage Sync
                </Button>
              </Link>
              <Link href="/secure/default/integrations/halopsa/setup">
                <Button variant="outline" className="gap-2">
                  <Settings className="w-4 h-4" />
                  Settings
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Quick Stats Grid */}
      {hasConfiguration && (
        <div className="grid grid-cols-4 gap-4">
          {/* Connection Status */}
          <div className="bg-card/50 border rounded shadow p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Database className="w-4 h-4" />
              <span className="text-sm font-medium">Connection</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-semibold">
                {prettyText(primaryDataSource.status)}
              </span>
            </div>
            {primaryDataSource.credentialExpirationAt && (
              <span className="text-xs text-muted-foreground">
                Expires{" "}
                {new Date(
                  primaryDataSource.credentialExpirationAt,
                ).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Last Sync */}
          <div className="bg-card/50 border rounded shadow p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-medium">Last Sync</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-semibold">
                {primaryDataSource.lastSyncAt
                  ? new Date(primaryDataSource.lastSyncAt).toLocaleDateString()
                  : "Never"}
              </span>
            </div>
            {primaryDataSource.lastSyncAt && (
              <span className="text-xs text-muted-foreground">
                {new Date(primaryDataSource.lastSyncAt).toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Synced Companies */}
          <div className="bg-card/50 border rounded shadow p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="w-4 h-4" />
              <span className="text-sm font-medium">Companies</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-semibold">
                {companies?.length || 0}
              </span>
            </div>
            <Link
              href="/secure/default/integrations/halopsa/companies"
              className="text-xs text-primary hover:underline"
            >
              View mapping
            </Link>
          </div>
        </div>
      )}

      {/* Setup Prompt for Non-Configured */}
      {!hasConfiguration && (
        <div className="bg-card/50 border rounded shadow p-8 flex flex-col items-center gap-4">
          <Settings className="w-12 h-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">
              Get Started with HaloPSA
            </h3>
            <p className="text-muted-foreground max-w-lg">
              Configure your HaloPSA integration to start syncing companies,
              endpoints, identities, and more. The setup wizard will guide you
              through the process.
            </p>
          </div>
          <Link href="/secure/default/integrations/halopsa/setup">
            <Button size="lg" className="gap-2">
              <Settings className="w-4 h-4" />
              Start Setup
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
