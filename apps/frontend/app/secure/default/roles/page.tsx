"use client";

import { useQuery } from "convex/react";
import { DataTable, DataTableColumn } from "@/components/DataTable";
import { api } from "@/lib/api";
import type { Doc } from "@workspace/database/convex/_generated/dataModel";
import Loader from "@workspace/ui/components/Loader";
import { prettyText } from "@workspace/shared/lib/utils";

type User = Doc<"roles">;

export default function RolesPage() {
    const roles = useQuery(api.helpers.orm.list, { tableName: 'roles' }) as Doc<'roles'>[] | undefined;
    const global = useQuery(api.roles.query.getGlobal) as Doc<'roles'>[] | undefined;

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
            key: "description",
            title: "Description",
            sortable: true,
            searchable: true,
            filter: {
                type: "text",
                operators: ["eq", "ne", "contains", "startsWith", "endsWith"],
                placeholder: "Filter by description...",
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

    return (
        <div className="flex flex-col size-full gap-2 mx-auto">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Roles</h1>
                <p className="text-muted-foreground">Manage your roles</p>
            </div>
            {!!roles ?
                (<DataTable
                    data={[...roles, ...(global || [])]}
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
