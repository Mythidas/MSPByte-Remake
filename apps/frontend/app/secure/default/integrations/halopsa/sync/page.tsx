"use client";

import { api, Doc } from "@/lib/api";
import { useQuery } from "convex/react";
import { IntegrationStatusBadge } from "@/components/integrations/IntegrationStatusBadge";
import { prettyText } from "@workspace/shared/lib/utils";
import Loader from "@workspace/ui/components/Loader";
import { DataTable, DataTableColumn, TableView, RowAction } from "@/components/DataTable";
import { RotateCcw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useIntegration } from "../integration-provider";

type ScheduledJob = Doc<'scheduled_jobs'>;

export default function HaloPSASync() {
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
    );

    const allJobs = useQuery(
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
    ) as ScheduledJob[] | undefined;

    // Early return after all hooks
    if (!dataSource) {
        return (
            <div className="flex flex-col gap-4 items-center justify-center size-full">
                <AlertCircle className="w-12 h-12 text-muted-foreground" />
                <p className="text-muted-foreground">
                    Please configure the integration first
                </p>
            </div>
        );
    }

    // Handler functions
    const handleRetryJobs = async (jobs: ScheduledJob[]) => {
        // TODO: Implement via Convex mutation
        toast.success(`${jobs.length} job(s) scheduled for retry`);
    };

    // Helper functions
    const formatDuration = (startedAt?: number, completedAt?: number) => {
        if (!startedAt) return '-';
        const end = completedAt || Date.now();
        const duration = end - startedAt;
        const seconds = Math.floor(duration / 1000);
        const minutes = Math.floor(seconds / 60);

        if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        return `${seconds}s`;
    };

    // DataTable configuration
    const columns: DataTableColumn<ScheduledJob>[] = [
        {
            key: "action",
            title: "Entity Type",
            sortable: true,
            searchable: true,
            cell: ({ value }) => <span className="font-medium">{prettyText(value)}</span>,
            filter: {
                type: "text",
                operators: ["contains", "eq"],
                placeholder: "Filter by action..."
            }
        },
        {
            key: "status",
            title: "Status",
            sortable: true,
            cell: ({ value }) => <IntegrationStatusBadge status={value} />,
            filter: {
                type: "select",
                operators: ["eq", "ne", "in"],
                options: [
                    { label: "Pending", value: "pending" },
                    { label: "Running", value: "running" },
                    { label: "Completed", value: "completed" },
                    { label: "Failed", value: "failed" }
                ]
            }
        },
        {
            key: "startedAt",
            title: "Started",
            sortable: true,
            cell: ({ row }) => {
                const time = row.startedAt || row.scheduledAt;
                return time ? new Date(time).toLocaleString() : '-';
            },
            filter: {
                type: "date",
                operators: ["gt", "lt", "eq"]
            }
        },
        {
            key: "updatedAt",
            title: "Duration",
            sortable: false,
            cell: ({ row }) => formatDuration(row.startedAt, row.updatedAt)
        },
        {
            key: "priority",
            title: "Priority",
            sortable: true,
            cell: ({ value }) => <span className="text-sm">{value || 5}</span>,
            filter: {
                type: "number",
                operators: ["eq", "gt", "lt"]
            }
        },
        {
            key: "attempts",
            title: "Attempts",
            sortable: true,
            cell: ({ row }) => (
                <span className="text-sm">
                    {row.attempts || 0} / {row.attemptsMax || 3}
                </span>
            )
        }
    ];

    // Table views (preset filters)
    const views: TableView[] = [
        {
            id: "failed",
            label: "Failed Jobs",
            filters: [{ field: "status", operator: "eq", value: "failed" }]
        },
        {
            id: "running",
            label: "In Progress",
            filters: [{ field: "status", operator: "in", value: ["pending", "running"] }]
        },
        {
            id: "completed",
            label: "Completed",
            filters: [{ field: "status", operator: "eq", value: "completed" }]
        }
    ];

    return (
        <div className="flex flex-col gap-4 size-full">
            <div>
                <h1 className="text-2xl font-semibold">Sync Management</h1>
                <p className="text-muted-foreground">
                    Monitor data synchronization with HaloPSA
                </p>
            </div>

            {/* Sync History */}
            {allJobs ? (
                <DataTable
                    data={allJobs}
                    columns={columns}
                    views={views}
                    enableGlobalSearch={true}
                    enableFilters={true}
                    enablePagination={true}
                    enableColumnToggle={true}
                />
            ) : (
                <Loader />
            )}
        </div>
    );
}
