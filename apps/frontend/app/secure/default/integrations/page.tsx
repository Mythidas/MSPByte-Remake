"use client";

import SearchBar from "@/components/SearchBar";
import { useAuthReady } from "@/lib/hooks/useAuthReady";
import { api, Doc } from "@/lib/api";
import { prettyText } from "@workspace/shared/lib/utils";
import { Badge } from "@workspace/ui/components/badge";
import Loader from "@workspace/ui/components/Loader";
import { useQuery } from "convex/react";
import { Search } from "lucide-react";
import Link from "next/link";
import { INTEGRATIONS } from "@workspace/shared/types/integrations/config";

export default function IntegrationsPage() {
  const { isLoading: authLoading } = useAuthReady();
  const dataSources = useQuery(
    api.helpers.orm.list,
    authLoading
      ? "skip"
      : {
          tableName: "data_sources",
          index: {
            name: "by_primary",
            params: {
              isPrimary: true,
            },
          },
        },
  ) as Doc<"data_sources">[];

  if (!dataSources) {
    return <Loader />;
  }

  const activeIntegrations = dataSources.map((d) => d.integrationId);

  return (
    <div className="flex flex-col gap-5 size-full">
      <SearchBar
        placeholder="Search integrations..."
        lead={<Search className="w-4" />}
        className="!bg-input w-1/4 !border-border"
      />
      <div className="grid grid-cols-4 w-full gap-2">
        {Object.values(INTEGRATIONS)
          .filter((i) => i.is_active)
          ?.map((integration) => {
            return (
              <div
                key={integration.slug}
                className="flex flex-col gap-2 bg-card/50 border rounded shadow h-40 p-4"
              >
                <Link href={`/secure/default/integrations/${integration.slug}`}>
                  {integration.name}
                </Link>
                <span className="text-muted-foreground text-sm">
                  {integration.description}
                </span>

                <div className="mt-auto flex gap-2">
                  <Badge>
                    {prettyText(
                      activeIntegrations.includes(integration.slug as any)
                        ? "Enabled"
                        : "Available",
                    )}
                  </Badge>
                  <Badge variant="secondary">
                    {prettyText(integration.category)}
                  </Badge>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
