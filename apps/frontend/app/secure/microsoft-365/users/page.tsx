"use client";

import { useQuery } from "convex/react";
import { api, Doc } from "@/lib/api";
import { DataTable, DataTableColumn, TableView } from "@/components/DataTable";
import { AlertCircle, CheckCircle, XCircle, Building2 } from "lucide-react";
import Loader from "@workspace/ui/components/Loader";
import Link from "next/link";
import { prettyText } from "@workspace/shared/lib/utils";
import { useIntegration } from "../integration-provider";
import { useApp } from "@/hooks/useApp";

type UserEntity = Doc<'entities'>;

export default function Microsoft365Users() {
    // Get integration from context (fetched server-side)
    const integration = useIntegration();

    // Get selected site from app state
    const { site: currentSite } = useApp();

    // Fetch data source mapped to this site
    const dataSource = useQuery(
        api.datasources.query.getBySiteAndIntegration,
        currentSite ? {
            siteId: currentSite._id,
            integrationSlug: 'microsoft-365'
        } : 'skip'
    ) as Doc<'data_sources'> | null | undefined;

    // Fetch users (identities) - site-specific entities
    // Use by_site_type index to get only users for the selected site
    const users = useQuery(
        api.helpers.orm.list,
        currentSite ? {
            tableName: 'entities',
            index: {
                name: 'by_site_type',
                params: {
                    siteId: currentSite._id,
                    entityType: 'identities'
                }
            }
        } : 'skip'
    ) as UserEntity[] | undefined;

    // Define columns
    const columns: DataTableColumn<UserEntity>[] = [
        {
            key: "normalizedData.name",
            title: "Name",
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
            key: "normalizedData.email",
            title: "Email",
            sortable: true,
            searchable: true,
            cell: ({ row }) => row.normalizedData?.email || row.rawData?.userPrincipalName || '-',
            filter: {
                type: "text",
                operators: ["eq", "ne", "contains", "endsWith"],
                placeholder: "Filter by email...",
            },
        },
        {
            key: "normalizedData.type",
            title: "Type",
            sortable: true,
            cell: ({ row }) => {
                const type = row.normalizedData?.type || 'member';
                const typeColors = {
                    member: "bg-blue-500/50",
                    guest: "bg-purple-500/50",
                };
                return (
                    <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${typeColors[type as keyof typeof typeColors] || 'bg-gray-500/50'}`}
                    >
                        {prettyText(type)}
                    </span>
                );
            },
            filter: {
                type: "select",
                operators: ["eq", "ne"],
                options: [
                    { label: "Member", value: "member" },
                    { label: "Guest", value: "guest" },
                ],
            },
        },
        {
            key: "normalizedData.enabled",
            title: "Status",
            sortable: true,
            cell: ({ row }) => {
                const enabled = row.normalizedData?.enabled;
                return (
                    <div className="flex items-center gap-2">
                        {enabled ? (
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
                operators: ["eq"],
                options: [
                    { label: "Enabled", value: true },
                    { label: "Disabled", value: false },
                ],
            },
        },
        {
            key: "normalizedData.state",
            title: "Security State",
            sortable: true,
            cell: ({ row }) => {
                const state = row.normalizedData?.state || 'normal';
                const stateConfig = {
                    normal: { color: "bg-green-500/50", icon: CheckCircle },
                    warn: { color: "bg-yellow-500/50", icon: AlertCircle },
                    critical: { color: "bg-red-500/50", icon: AlertCircle },
                };
                const config = stateConfig[state as keyof typeof stateConfig] || stateConfig.normal;
                const Icon = config.icon;

                return (
                    <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.color}`}
                        >
                            {prettyText(state)}
                        </span>
                    </div>
                );
            },
            filter: {
                type: "select",
                operators: ["eq", "ne"],
                options: [
                    { label: "Normal", value: "normal" },
                    { label: "Warning", value: "warn" },
                    { label: "Critical", value: "critical" },
                ],
            },
        },
        {
            key: "normalizedData.tags",
            title: "Tags",
            cell: ({ row }) => {
                const tags = row.normalizedData?.tags || [];
                if (!tags.length) return <span className="text-muted-foreground">-</span>;

                return (
                    <div className="flex flex-wrap gap-1">
                        {tags.slice(0, 3).map((tag: string) => (
                            <span
                                key={tag}
                                className="inline-flex items-center rounded border px-2 py-0.5 text-xs bg-muted"
                            >
                                {tag}
                            </span>
                        ))}
                        {tags.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                                +{tags.length - 3}
                            </span>
                        )}
                    </div>
                );
            },
        },
        {
            key: "normalizedData.licenses",
            title: "Licenses",
            cell: ({ row }) => {
                const licenses = row.normalizedData?.licenses || [];
                if (!licenses.length) return <span className="text-muted-foreground">None</span>;
                return <span>{licenses.length} license(s)</span>;
            },
        },
        {
            key: "normalizedData.last_login_at",
            title: "Last Login",
            sortable: true,
            cell: ({ row }) => {
                const lastLogin = row.normalizedData?.last_login_at;
                if (!lastLogin) return <span className="text-muted-foreground">Never</span>;

                const date = new Date(lastLogin);
                return date.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                });
            },
            filter: {
                type: "date",
                operators: ["eq", "gt", "gte", "lt", "lte"],
            },
        },
    ];

    // Define views
    const views: TableView[] = [
        {
            id: "enabled",
            label: "Enabled Users",
            filters: [
                {
                    field: "normalizedData.enabled",
                    operator: "eq",
                    value: true,
                },
            ],
        },
        {
            id: "disabled",
            label: "Disabled Users",
            filters: [
                {
                    field: "normalizedData.enabled",
                    operator: "eq",
                    value: false,
                },
            ],
        },
        {
            id: "guests",
            label: "Guest Users",
            filters: [
                {
                    field: "normalizedData.type",
                    operator: "eq",
                    value: "guest",
                },
            ],
        },
        {
            id: "critical",
            label: "Security Critical",
            filters: [
                {
                    field: "normalizedData.state",
                    operator: "eq",
                    value: "critical",
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
                        Please select a site from the dropdown in the top navigation bar to view users for that site.
                    </p>
                </div>
            </div>
        );
    }

    if (!dataSource) {
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
                <h1 className="text-3xl font-bold tracking-tight">Microsoft 365 Users</h1>
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="w-4 h-4" />
                    <p>{currentSite.name}</p>
                </div>
            </div>
            {users ? (
                <DataTable
                    data={users}
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
