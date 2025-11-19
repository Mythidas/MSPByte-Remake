"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api, Doc } from "@/lib/api";
import { DataTable, DataTableColumn, TableView } from "@/components/DataTable";
import { AlertCircle, CheckCircle, XCircle, Building2, Download, Key, LogOut, ShieldAlert } from "lucide-react";
import Loader from "@workspace/ui/components/Loader";
import Link from "next/link";
import { prettyText } from "@workspace/shared/lib/utils";
import { useApp } from "@/hooks/useApp";
import { Button } from "@workspace/ui/components/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { exportToCSV, exportToJSON, generateTimestampedFilename } from "@/lib/utils/export";
import { toast } from "sonner";

type UserEntity = Doc<'entities'>;

export default function Microsoft365Users() {
    // Track filtered data for exports
    const [filteredData, setFilteredData] = useState<UserEntity[]>([]);

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
                    low: { color: "bg-slate-500/50", icon: AlertCircle },
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
            filter: {
                type: "select",
                label: "Tags",
                operators: ["contains"],
                options: [
                    { label: "Admin", value: "Admin" },
                    { label: "Stale", value: "Stale" },
                    { label: "Partial MFA", value: "Partial MFA" },
                    { label: "No MFA", value: "No MFA" },
                ]
            }
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

    // Check if filters are active (filtered data is smaller than total data)
    const hasActiveFilters = users && filteredData.length > 0 && filteredData.length < users.length;

    // Export handlers - use filtered data if available
    const handleExportCSV = () => {
        const dataToExport = hasActiveFilters ? filteredData : (users || []);
        const filename = generateTimestampedFilename('microsoft-365-users', '.csv');
        exportToCSV(dataToExport, columns, filename.replace('.csv', ''));
        toast.success(`Exported ${dataToExport.length} user${dataToExport.length !== 1 ? 's' : ''} to CSV`);
    };

    const handleExportJSON = () => {
        const dataToExport = hasActiveFilters ? filteredData : (users || []);
        const filename = generateTimestampedFilename('microsoft-365-users', '.json');
        exportToJSON(dataToExport, columns, filename.replace('.json', ''));
        toast.success(`Exported ${dataToExport.length} user${dataToExport.length !== 1 ? 's' : ''} to JSON`);
    };

    // Bulk action handlers (stubbed)
    const handleBulkEnable = (selectedRows: UserEntity[]) => {
        toast.info(`Bulk enable functionality coming soon (${selectedRows.length} users selected)`);
        // TODO: Implement bulk enable
    };

    const handleBulkDisable = (selectedRows: UserEntity[]) => {
        toast.info(`Bulk disable functionality coming soon (${selectedRows.length} users selected)`);
        // TODO: Implement bulk disable
    };

    const handleBulkResetPassword = (selectedRows: UserEntity[]) => {
        toast.info(`Bulk password reset functionality coming soon (${selectedRows.length} users selected)`);
        // TODO: Implement bulk password reset
    };

    const handleBulkRevokeSessions = (selectedRows: UserEntity[]) => {
        toast.info(`Bulk revoke sessions functionality coming soon (${selectedRows.length} users selected)`);
        // TODO: Implement bulk revoke sessions
    };

    const handleBulkLockdown = (selectedRows: UserEntity[]) => {
        toast.info(`Bulk lockdown functionality coming soon (${selectedRows.length} users selected)`);
        // TODO: Implement bulk lockdown
    };

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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Microsoft 365 Users</h1>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Building2 className="w-4 h-4" />
                        <p>{currentSite.name}</p>
                    </div>
                </div>

                {/* Export Dropdown */}
                {users && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="gap-2">
                                <Download className="w-4 h-4" />
                                Export
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={handleExportCSV}>
                                Export to CSV ({hasActiveFilters ? `${filteredData.length} filtered` : `${users.length} total`})
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleExportJSON}>
                                Export to JSON ({hasActiveFilters ? `${filteredData.length} filtered` : `${users.length} total`})
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
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
                    onFilteredDataChange={setFilteredData}
                    onRowClick={(row) => {
                        window.location.href = `/secure/microsoft-365/users/${row._id}`;
                    }}
                    rowActions={[
                        {
                            label: "Enable",
                            icon: <CheckCircle className="w-4 h-4" />,
                            onClick: handleBulkEnable,
                            variant: "default"
                        },
                        {
                            label: "Disable",
                            icon: <XCircle className="w-4 h-4" />,
                            onClick: handleBulkDisable,
                            variant: "outline"
                        },
                        {
                            label: "Reset Passwords",
                            icon: <Key className="w-4 h-4" />,
                            onClick: handleBulkResetPassword,
                            variant: "outline"
                        },
                        {
                            label: "Revoke Sessions",
                            icon: <LogOut className="w-4 h-4" />,
                            onClick: handleBulkRevokeSessions,
                            variant: "outline"
                        },
                        {
                            label: "Lockdown",
                            icon: <ShieldAlert className="w-4 h-4" />,
                            onClick: handleBulkLockdown,
                            variant: "destructive"
                        },
                    ]}
                />
            ) : (
                <Loader />
            )}
        </div>
    );
}
