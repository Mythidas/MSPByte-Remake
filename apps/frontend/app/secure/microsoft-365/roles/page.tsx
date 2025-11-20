"use client";

import { useQuery } from "convex/react";
import { api, Doc } from "@/lib/api";
import { DataTable, DataTableColumn, TableView } from "@/components/DataTable";
import { AlertCircle, CheckCircle, XCircle, Building2 } from "lucide-react";
import Loader from "@workspace/ui/components/Loader";
import Link from "next/link";
import { useIntegration } from "../integration-provider";
import { useApp } from "@/hooks/useApp";
import { useAuthReady } from "@/hooks/useAuthReady";

type RoleEntity = Doc<'entities'>;

export default function Microsoft365Roles() {
    // Get integration from context (fetched server-side)
    const integration = useIntegration();

    // Get selected site from app state
    const { site: currentSite } = useApp();

    // Ensure auth is ready before querying
    const { isLoading: authLoading, isAuthenticated } = useAuthReady();

    // Fetch data source mapped to this site
    const dataSource = useQuery(
        api.datasources.query.getBySiteAndIntegration,
        !authLoading && isAuthenticated && currentSite ? {
            siteId: currentSite._id,
            integrationSlug: 'microsoft-365'
        } : 'skip'
    ) as Doc<'data_sources'> | null | undefined;

    // Fetch roles (tenant-wide, filter by dataSourceId)
    const roles = useQuery(
        api.helpers.orm.list,
        !authLoading && isAuthenticated && currentSite && dataSource ? {
            tableName: 'entities',
            index: {
                name: 'by_data_source_type',
                params: {
                    dataSourceId: dataSource._id,
                    entityType: 'roles'
                }
            }
        } : 'skip'
    ) as RoleEntity[] | undefined;

    // Define columns
    const columns: DataTableColumn<RoleEntity>[] = [
        {
            key: "normalizedData.name",
            title: "Role Name",
            sortable: true,
            searchable: true,
            cell: ({ row }) => row.normalizedData?.name || row.rawData?.displayName || '-',
            filter: {
                type: "text",
                operators: ["eq", "ne", "contains", "startsWith"],
                placeholder: "Filter by name...",
            },
        },
        {
            key: "normalizedData.description",
            title: "Description",
            cell: ({ row }) => {
                const description = row.normalizedData?.description || row.rawData?.description;
                if (!description) return <span className="text-muted-foreground">-</span>;

                return (
                    <span className="line-clamp-2 max-w-lg" title={description}>
                        {description}
                    </span>
                );
            },
            filter: {
                type: "text",
                operators: ["contains", "startsWith"],
                placeholder: "Filter by description...",
            },
        },
        {
            key: "normalizedData.status",
            title: "Status",
            sortable: true,
            cell: ({ row }) => {
                const status = row.normalizedData?.status || 'enabled';
                return (
                    <div className="flex items-center gap-2">
                        {status === 'enabled' ? (
                            <>
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <span>Enabled</span>
                            </>
                        ) : (
                            <>
                                <XCircle className="w-4 h-4 text-red-500" />
                                <span>Disabled</span>
                            </>
                        )}
                    </div>
                );
            },
            filter: {
                type: "select",
                operators: ["eq", "ne"],
                options: [
                    { label: "Enabled", value: "enabled" },
                    { label: "Disabled", value: "disabled" },
                ],
            },
        },

        {
            key: "updatedAt",
            title: "Last Synced",
            sortable: true,
            cell: ({ row }) => {
                if (!row.updatedAt) return "-";
                return new Date(row.updatedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                });
            },
        },
    ];

    // Define views
    const views: TableView[] = [
        {
            id: "enabled",
            label: "Enabled Roles",
            filters: [
                {
                    field: "normalizedData.status",
                    operator: "eq",
                    value: "enabled",
                },
            ],
        },
        {
            id: "disabled",
            label: "Disabled Roles",
            filters: [
                {
                    field: "normalizedData.status",
                    operator: "eq",
                    value: "disabled",
                },
            ],
        },
    ];

    // Show empty state if no site is selected
    if (!currentSite) {
        return (
            <div className="flex flex-col gap-4 items-center justify-center size-full">
                <Building2 className="w-16 h-16 text-muted-foreground" />
                <div className="text-center">
                    <h2 className="text-2xl font-semibold mb-2">Select a Site</h2>
                    <p className="text-muted-foreground max-w-md">
                        Please select a site from the dropdown in the top navigation bar.
                    </p>
                </div>
            </div>
        );
    }

    // Only show error if dataSource query completed and returned null
    // Don't block if it's still loading (undefined)
    if (dataSource === null) {
        return (
            <div className="flex flex-col gap-4 items-center justify-center size-full">
                <AlertCircle className="w-12 h-12 text-muted-foreground" />
                <p className="text-muted-foreground">
                    Microsoft 365 integration not configured
                </p>
                <Link
                    href="/secure/default/integrations"
                    className="text-sm text-blue-500 hover:underline"
                >
                    Configure Integration
                </Link>
            </div>
        );
    }

    return (
        <div className="flex flex-col size-full gap-2">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Microsoft 365 Roles</h1>
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="w-4 h-4" />
                    <p>{currentSite.name}</p>
                </div>
            </div>
            {roles ? (
                <DataTable
                    data={roles}
                    columns={columns}
                    views={views}
                    enableRowSelection={true}
                    enableGlobalSearch={true}
                    enableFilters={true}
                    enablePagination={true}
                    enableColumnToggle={true}
                    enableURLState={true}
                />
            ) : (
                <Loader />
            )}
        </div>
    );
}
