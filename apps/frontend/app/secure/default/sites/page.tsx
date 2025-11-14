"use client";

import { Card, CardContent } from "@workspace/ui/components/card";
import { useQuery } from "convex/react";
import { Trash2, Archive, Download } from "lucide-react";
import { DataTable, DataTableColumn, TableView, RowAction } from "@/components/DataTable";
import { api } from "@/lib/api";
import type { Doc } from "@workspace/database/convex/_generated/dataModel";
import Loader from "@workspace/ui/components/Loader";
import { prettyText } from "@workspace/shared/lib/utils";
import { useRouter } from "next/navigation";

type Site = Doc<"sites"> & {
    psaIntegrationName?: string;
};

export default function SitesPage() {
    const router = useRouter();
    const sites = useQuery(api.sites.query.list);

    // Define columns
    const columns: DataTableColumn<Site>[] = [
        {
            key: "name",
            title: "Name",
            sortable: true,
            searchable: true,
            filter: {
                type: "text",
                operators: ["eq", "ne", "contains", "startsWith", "endsWith"],
                placeholder: "Filter by name...",
            },
        },
        {
            key: "slug",
            title: "Slug",
            sortable: true,
            searchable: true,
            filter: {
                type: "text",
                operators: ["eq", "ne", "contains", "startsWith", "endsWith"],
                placeholder: "Filter by slug...",
            },
        },
        {
            key: "status",
            title: "Status",
            sortable: true,
            cell: ({ value }) => {
                const statusColors = {
                    active: "bg-green-500/50",
                    inactive: "bg-gray-500/50",
                    archived: "bg-amber-500/50",
                };
                return (
                    <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColors[value as keyof typeof statusColors]}`}
                    >
                        {prettyText(value)}
                    </span>
                );
            },
            filter: {
                type: "select",
                operators: ["eq", "ne", "in", "nin"],
                options: [
                    { label: "Active", value: "active" },
                    { label: "Inactive", value: "inactive" },
                    { label: "Archived", value: "archived" },
                ],
            },
        },
        {
            key: "psaIntegrationName",
            title: "PSA Integration",
            sortable: true,
            cell: ({ value }) => value || <span className="text-muted-foreground">None</span>,
            filter: {
                type: "text",
                operators: ["eq", "ne", "contains"],
                placeholder: "Filter by PSA...",
            },
        },
        {
            key: "psaCompanyId",
            title: "PSA Company ID",
            cell: ({ value }) => value || <span className="text-muted-foreground">-</span>,
            filter: {
                type: "text",
                operators: ["eq", "ne"],
                placeholder: "Filter by company ID...",
            },
        },
        {
            key: "updatedAt",
            title: "Last Updated",
            sortable: true,
            cell: ({ value }) => {
                if (!value) return "-";
                return new Date(value).toLocaleDateString("en-US", {
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
            id: "active",
            label: "Active Sites",
            filters: [
                {
                    field: "status",
                    operator: "eq",
                    value: "active",
                },
            ],
        },
        {
            id: "inactive",
            label: "Inactive Sites",
            filters: [
                {
                    field: "status",
                    operator: "eq",
                    value: "inactive",
                },
            ],
        },
        {
            id: "with-psa",
            label: "With PSA",
            filters: [
                {
                    field: "psaIntegrationName",
                    operator: "ne",
                    value: null,
                },
            ],
        },
    ];

    // Define row actions (bulk actions)
    const rowActions: RowAction<Site>[] = [
        {
            label: "Archive Selected",
            icon: <Archive className="h-4 w-4" />,
            variant: "outline",
            onClick: (rows) => {
                console.log("Archive sites:", rows);
                // TODO: Implement archive mutation
            },
        },
        {
            label: "Delete Selected",
            icon: <Trash2 className="h-4 w-4" />,
            variant: "destructive",
            onClick: (rows) => {
                if (confirm(`Are you sure you want to delete ${rows.length} site(s)?`)) {
                    console.log("Delete sites:", rows);
                    // TODO: Implement delete mutation
                }
            },
        },
        {
            label: "Export",
            icon: <Download className="h-4 w-4" />,
            variant: "outline",
            onClick: (rows) => {
                console.log("Export sites:", rows);
                // TODO: Implement export functionality
            },
        },
    ];

    const handleRowClick = (site: Site) => {
        console.log("Navigate to site:", site);
        router.push(`/secure/default/sites/${site.slug}`);
    };

    return (
        <div className="flex flex-col size-full gap-2 mx-auto">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Sites</h1>
                <p className="text-muted-foreground">Manage your client sites and integrations</p>
            </div>
            {!!sites ?
                (<DataTable
                    data={sites}
                    columns={columns}
                    views={views}
                    rowActions={rowActions}
                    enableRowSelection={true}
                    enableGlobalSearch={true}
                    enableFilters={true}
                    enablePagination={true}
                    enableColumnToggle={true}
                    enableURLState={true}
                    onRowClick={handleRowClick}
                />) : (
                    <Loader />
                )}
        </div>
    );
}
