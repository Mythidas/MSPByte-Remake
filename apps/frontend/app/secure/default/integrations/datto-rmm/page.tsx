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
  Database,
  Building2,
  AlertCircle,
  Settings,
} from "lucide-react";
import { INTEGRATIONS } from "@workspace/shared/types/integrations/config";

export default function DattoRMMOverview() {
  const integration = INTEGRATIONS["datto-rmm"];
  const dataSource = useQuery(api.helpers.orm.get, {
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

  const sites = useQuery(
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
                  Remote Monitoring and Management
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <IntegrationStatusBadge
              status={primaryDataSource?.status || "inactive"}
            />
            <Link href="/secure/default/integrations/datto-rmm/setup">
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Configure
              </Button>
            </Link>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-background/50 p-4 rounded border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Building2 className="w-4 h-4" />
              Synced Sites
            </div>
            <div className="text-2xl font-semibold">{sites?.length || 0}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
