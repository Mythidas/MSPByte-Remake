"use client"

import SearchBar from "@/components/SearchBar";
import { useAuthReady } from "@/hooks/useAuthReady";
import { api } from "@/lib/api"
import { prettyText } from "@workspace/shared/lib/utils";
import { Badge } from "@workspace/ui/components/badge";
import Loader from "@workspace/ui/components/Loader";
import { useQuery } from "convex/react"
import { Search } from "lucide-react";
import Link from "next/link";

export default function IntegrationsPage() {
    const { isLoading: authLoading } = useAuthReady();
    const integrations = useQuery(api.integrations.query.listActiveWithDataSource, authLoading ? 'skip' : {});

    if (!integrations) {
        return <Loader />
    }

    return (
        <div className="flex flex-col gap-5 size-full">
            <SearchBar placeholder="Search integrations..." lead={<Search className="w-4" />} className="!bg-input w-1/4 !border-border" />
            <div className="grid grid-cols-4 size-full gap-2">
                {integrations?.map((integration) => {
                    return (
                        <div key={integration._id} className="flex flex-col gap-2 bg-card/50 border rounded shadow h-40 p-4">
                            <Link href={`/secure/default/integrations/${integration.slug}`}>{integration.name}</Link>
                            <span className="text-muted-foreground text-sm">{integration.description}</span>

                            <div className="mt-auto flex gap-2">
                                <Badge>{prettyText(integration.dataSourceStatus)}</Badge>
                                <Badge variant="secondary">{prettyText(integration.category)}</Badge>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
