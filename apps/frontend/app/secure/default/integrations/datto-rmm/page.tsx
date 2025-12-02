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
import { useIntegration } from "./integration-provider";

export default function DattoRMMOverview() {
    const integration = useIntegration();
    const dataSource = useQuery(
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

    const scheduledJobs = useQuery(
        api.helpers.orm.list,
        dataSource ? {
            tableName: 'scheduled_jobs',
            index: {
                name: 'by_data_source',
                params: {
                    dataSourceId: dataSource._id
                }
            }
        } : 'skip'
    ) as Doc<'scheduled_jobs'>[] | undefined;

    const sites = useQuery(
        api.helpers.orm.list,
        dataSource ? {
            tableName: 'entities',
            index: {
                name: 'by_data_source',
                params: {
                    dataSourceId: dataSource._id
                }
            },
            filters: {
                entityType: 'companies'
            }
        } : 'skip'
    );

    const failedJobs = useQuery(
        api.helpers.orm.list,
        dataSource ? {
            tableName: 'scheduled_jobs',
            index: {
                name: 'by_data_source',
                params: {
                    dataSourceId: dataSource._id
                }
            },
            filters: {
                status: 'failed'
            }
        } : 'skip'
    );

    const primaryDataSource = dataSource;

    if (primaryDataSource === undefined) {
        return <Loader />
    }

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
                                    Remote Monitoring and Management
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <IntegrationStatusBadge status={primaryDataSource?.status || 'inactive'} />
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

                    <div className="bg-background/50 p-4 rounded border">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Activity className="w-4 h-4" />
                            Scheduled Jobs
                        </div>
                        <div className="text-2xl font-semibold">{scheduledJobs?.length || 0}</div>
                    </div>

                    <div className="bg-background/50 p-4 rounded border">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Database className="w-4 h-4" />
                            Status
                        </div>
                        <div className="text-2xl font-semibold capitalize">{primaryDataSource?.status}</div>
                    </div>

                    <div className="bg-background/50 p-4 rounded border">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <AlertCircle className="w-4 h-4" />
                            Failed Jobs
                        </div>
                        <div className="text-2xl font-semibold">{failedJobs?.length || 0}</div>
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            {scheduledJobs && scheduledJobs.length > 0 && (
                <div className="bg-card/50 border rounded shadow p-6">
                    <h2 className="text-lg font-semibold mb-4">Recent Jobs</h2>
                    <div className="space-y-2">
                        {scheduledJobs.slice(0, 5).map((job) => (
                            <div key={job._id} className="flex items-center justify-between p-3 bg-background/50 rounded border">
                                <div className="flex items-center gap-3">
                                    <Badge variant={
                                        job.status === 'completed' ? 'default' :
                                            job.status === 'running' ? 'secondary' :
                                                job.status === 'failed' ? 'destructive' :
                                                    'outline'
                                    }>
                                        {prettyText(job.status)}
                                    </Badge>
                                    <span className="font-medium">{prettyText(job.action)}</span>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    {new Date(job.scheduledAt).toLocaleString()}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
