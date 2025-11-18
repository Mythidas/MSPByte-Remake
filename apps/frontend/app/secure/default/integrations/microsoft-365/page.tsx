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
    Cloud,
    Calendar,
    Building2,
    Link as LinkIcon,
    Settings,
    Plus
} from "lucide-react";
import { useIntegration } from "./integration-provider";
import type { Microsoft365DataSourceConfig } from "@workspace/shared/types/integrations/microsoft-365";

export default function Microsoft365Overview() {
    const integration = useIntegration();

    const primaryDataSource = useQuery(
        api.helpers.orm.get,
        {
            tableName: 'data_sources',
            index: {
                name: 'by_integration',
                params: {
                    integrationId: integration._id
                }
            },
            filters: {
                isPrimary: true
            }
        }
    ) as Doc<'data_sources'> | undefined;

    const connections = useQuery(
        api.helpers.orm.list,
        primaryDataSource ? {
            tableName: 'data_sources',
            index: {
                name: 'by_integration',
                params: {
                    integrationId: integration._id
                }
            },
            filters: {
                isPrimary: false
            }
        } : 'skip'
    ) as Doc<'data_sources'>[] | undefined;

    const hasConfiguration = !!primaryDataSource;

    if (primaryDataSource === undefined) {
        return <Loader />
    }

    // Calculate stats from connections
    const totalConnections = connections?.length || 0;
    const totalDomainsMapped = connections?.reduce((acc, conn) => {
        const config = conn.config as Microsoft365DataSourceConfig;
        return acc + (config.domainMappings?.length || 0);
    }, 0) || 0;

    const totalSitesLinked = connections ?
        new Set(
            connections.flatMap(conn => {
                const config = conn.config as Microsoft365DataSourceConfig;
                return config.domainMappings?.map(m => m.siteId) || [];
            })
        ).size : 0;

    const mostRecentConnection = connections && connections.length > 0 ?
        connections.reduce((latest, conn) =>
            conn._creationTime > latest._creationTime ? conn : latest
        ) : null;

    return (
        <div className="flex flex-col gap-4 size-full">
            {/* Integration Header Card */}
            <div className="bg-card/50 border rounded shadow p-6 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            {integration.iconUrl && (
                                <img
                                    src={integration.iconUrl}
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
                        <Link href="/secure/default/integrations/microsoft-365/setup">
                            <Button className="gap-2">
                                <Settings className="w-4 h-4" />
                                Configure Integration
                            </Button>
                        </Link>
                    ) : (
                        <>
                            <Link href="/secure/default/integrations/microsoft-365/connections">
                                <Button className="gap-2">
                                    <Plus className="w-4 h-4" />
                                    Manage Connections
                                </Button>
                            </Link>
                            <Link href="/secure/default/integrations/microsoft-365/setup">
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
                    {/* Total Connections */}
                    <div className="bg-card/50 border rounded shadow p-4 flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Cloud className="w-4 h-4" />
                            <span className="text-sm font-medium">Connections</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-semibold">
                                {totalConnections}
                            </span>
                        </div>
                        <Link
                            href="/secure/default/integrations/microsoft-365/connections"
                            className="text-xs text-primary hover:underline"
                        >
                            Manage connections
                        </Link>
                    </div>

                    {/* Domains Mapped */}
                    <div className="bg-card/50 border rounded shadow p-4 flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <LinkIcon className="w-4 h-4" />
                            <span className="text-sm font-medium">Domains Mapped</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-semibold">
                                {totalDomainsMapped}
                            </span>
                        </div>
                        {totalDomainsMapped > 0 && (
                            <Link
                                href="/secure/default/integrations/microsoft-365/connections"
                                className="text-xs text-primary hover:underline"
                            >
                                View mappings
                            </Link>
                        )}
                    </div>

                    {/* Sites Linked */}
                    <div className="bg-card/50 border rounded shadow p-4 flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Building2 className="w-4 h-4" />
                            <span className="text-sm font-medium">Sites Linked</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-semibold">
                                {totalSitesLinked}
                            </span>
                        </div>
                        {totalSitesLinked > 0 && (
                            <span className="text-xs text-muted-foreground">
                                Unique sites
                            </span>
                        )}
                    </div>

                    {/* Last Activity */}
                    <div className="bg-card/50 border rounded shadow p-4 flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            <span className="text-sm font-medium">Last Activity</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-semibold">
                                {mostRecentConnection
                                    ? new Date(mostRecentConnection._creationTime).toLocaleDateString()
                                    : 'N/A'
                                }
                            </span>
                        </div>
                        {mostRecentConnection && (
                            <span className="text-xs text-muted-foreground">
                                Connection added
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Connections List */}
            {hasConfiguration && connections && connections.length > 0 && (
                <div className="bg-card/50 border rounded shadow p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Recent Connections</h2>
                        <Link href="/secure/default/integrations/microsoft-365/connections">
                            <Button variant="ghost" size="sm">
                                View all
                            </Button>
                        </Link>
                    </div>
                    <div className="flex flex-col gap-2">
                        {connections.slice(0, 5).map((conn: Doc<'data_sources'>) => {
                            const config = conn.config as Microsoft365DataSourceConfig;
                            const domainCount = config.domainMappings?.length || 0;

                            return (
                                <div
                                    key={conn._id}
                                    className="flex items-center justify-between p-3 bg-card/30 border rounded"
                                >
                                    <div className="flex items-center gap-3">
                                        <Cloud className="w-4 h-4 text-muted-foreground" />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">
                                                {config.name}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {config.tenantName} • {domainCount} domain{domainCount !== 1 ? 's' : ''} mapped
                                            </span>
                                        </div>
                                    </div>
                                    <IntegrationStatusBadge status={conn.status} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Setup Prompt for Non-Configured */}
            {!hasConfiguration && (
                <div className="bg-card/50 border rounded shadow p-8 flex flex-col items-center gap-4">
                    <Settings className="w-12 h-12 text-muted-foreground" />
                    <div className="text-center">
                        <h3 className="text-lg font-semibold mb-2">Get Started with Microsoft 365</h3>
                        <p className="text-muted-foreground max-w-lg">
                            Configure your Microsoft 365 integration to start syncing users, groups,
                            licenses, and more from your Entra tenants. The setup wizard will guide you through the process.
                        </p>
                    </div>
                    <Link href="/secure/default/integrations/microsoft-365/setup">
                        <Button size="lg" className="gap-2">
                            <Settings className="w-4 h-4" />
                            Start Setup
                        </Button>
                    </Link>
                </div>
            )}

            {/* Empty State for Configured but No Connections */}
            {hasConfiguration && totalConnections === 0 && (
                <div className="bg-card/50 border rounded shadow p-8 flex flex-col items-center gap-4">
                    <Cloud className="w-12 h-12 text-muted-foreground" />
                    <div className="text-center">
                        <h3 className="text-lg font-semibold mb-2">No Connections Yet</h3>
                        <p className="text-muted-foreground max-w-lg">
                            Create your first Microsoft 365 connection to start syncing data from an Entra tenant.
                        </p>
                    </div>
                    <Link href="/secure/default/integrations/microsoft-365/connections">
                        <Button size="lg" className="gap-2">
                            <Plus className="w-4 h-4" />
                            Add Connection
                        </Button>
                    </Link>
                </div>
            )}
        </div>
    );
}
