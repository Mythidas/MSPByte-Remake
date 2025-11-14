"use client";

import { useQuery } from "convex/react";
import { DataTable, DataTableColumn } from "@/components/DataTable";
import { api } from "@/lib/api";
import type { Doc } from "@workspace/database/convex/_generated/dataModel";
import Loader from "@workspace/ui/components/Loader";
import { prettyText } from "@workspace/shared/lib/utils";

type User = Doc<"users">;

export default function SitesPage() {
    const users = useQuery(api.helpers.orm.list, { tableName: 'users' });

    // Define columns
    const columns: DataTableColumn<User>[] = [
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
            key: "email",
            title: "Email",
            sortable: true,
            searchable: true,
            filter: {
                type: "text",
                operators: ["eq", "ne", "contains", "startsWith", "endsWith"],
                placeholder: "Filter by email...",
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
            key: "lastActivityAt",
            title: "Last Seen",
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

    return (
        <div className="flex flex-col size-full gap-2 mx-auto">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Users</h1>
                <p className="text-muted-foreground">Manage your users</p>
            </div>
            {!!users ?
                (<DataTable
                    data={users}
                    columns={columns}
                    enableGlobalSearch={true}
                    enableFilters={true}
                    enablePagination={true}
                    enableColumnToggle={true}
                />) : (
                    <Loader />
                )}
        </div>
    );
}
