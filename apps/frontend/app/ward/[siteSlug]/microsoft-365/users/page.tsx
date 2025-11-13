"use client";

import { useWard } from "@/hooks/use-ward";
import { useQuery } from "convex/react";
import { api } from "@/lib/api";
import { EntityTable, ColumnDef } from "@workspace/ui/components/entity-table";
import { Badge } from "@workspace/ui/components/badge";
import { Card } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { Search } from "lucide-react";
import { useState, useMemo } from "react";

type Identity = {
    _id: string;
    externalId: string;
    normalizedData: {
        name: string;
        email: string;
        type: "member" | "guest";
        enabled: boolean;
        tags: string[];
        licenses?: string[];
        lastSignIn?: string;
        daysSinceLastSignIn?: number;
    };
};

const columns: ColumnDef<Identity>[] = [
    {
        id: "name",
        header: "Name",
        accessorFn: (row) => row.normalizedData.name,
        sortable: true,
        width: "25%",
    },
    {
        id: "email",
        header: "Email",
        accessorFn: (row) => row.normalizedData.email,
        sortable: true,
        width: "25%",
    },
    {
        id: "type",
        header: "Type",
        cell: (row) => (
            <Badge variant={row.normalizedData.type === "member" ? "default" : "secondary"}>
                {row.normalizedData.type}
            </Badge>
        ),
        sortable: true,
        width: "10%",
    },
    {
        id: "enabled",
        header: "Status",
        cell: (row) => (
            <Badge variant={row.normalizedData.enabled ? "default" : "destructive"}>
                {row.normalizedData.enabled ? "Enabled" : "Disabled"}
            </Badge>
        ),
        sortable: true,
        width: "10%",
    },
    {
        id: "tags",
        header: "Tags",
        cell: (row) => (
            <div className="flex flex-wrap gap-1">
                {row.normalizedData.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                    </Badge>
                ))}
                {row.normalizedData.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                        +{row.normalizedData.tags.length - 3}
                    </Badge>
                )}
            </div>
        ),
        width: "20%",
    },
    {
        id: "lastSignIn",
        header: "Last Sign In",
        accessorFn: (row) => {
            if (!row.normalizedData.daysSinceLastSignIn) return "Never";
            if (row.normalizedData.daysSinceLastSignIn === 0) return "Today";
            if (row.normalizedData.daysSinceLastSignIn === 1) return "Yesterday";
            return `${row.normalizedData.daysSinceLastSignIn} days ago`;
        },
        sortable: true,
        width: "10%",
    },
];

export default function Microsoft365UsersPage() {
    const { site } = useWard();
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    // Get data source for M365
    const dataSource = useQuery(
        api.datasources.query.getBySiteAndIntegration,
        site ? { siteId: site._id, integrationSlug: "microsoft-365" } : "skip"
    );

    // Get identities
    const identities = useQuery(
        api.entities.query.list,
        dataSource ? { dataSourceId: dataSource._id, entityType: "identities" } : "skip"
    ) as Identity[] | undefined;

    // Filter identities
    const filteredIdentities = useMemo(() => {
        if (!identities) return [];

        return identities.filter((identity) => {
            // Search filter
            const matchesSearch =
                !searchQuery ||
                identity.normalizedData.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                identity.normalizedData.email.toLowerCase().includes(searchQuery.toLowerCase());

            // Type filter
            const matchesType = typeFilter === "all" || identity.normalizedData.type === typeFilter;

            // Status filter
            const matchesStatus =
                statusFilter === "all" ||
                (statusFilter === "enabled" && identity.normalizedData.enabled) ||
                (statusFilter === "disabled" && !identity.normalizedData.enabled);

            return matchesSearch && matchesType && matchesStatus;
        });
    }, [identities, searchQuery, typeFilter, statusFilter]);

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-3xl font-bold">Users</h1>
                <p className="text-muted-foreground">Manage user identities and access for {site?.name}</p>
            </div>

            {/* Filters */}
            <Card className="p-4 mb-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search by name or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-full md:w-[180px]">
                            <SelectValue placeholder="User Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="member">Members</SelectItem>
                            <SelectItem value="guest">Guests</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full md:w-[180px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="enabled">Enabled</SelectItem>
                            <SelectItem value="disabled">Disabled</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </Card>

            {/* Stats */}
            <div className="mb-4 flex gap-4 text-sm text-muted-foreground">
                <span>Total: {identities?.length || 0}</span>
                <span>Filtered: {filteredIdentities.length}</span>
                {typeFilter !== "all" && <Badge variant="outline">{typeFilter}</Badge>}
                {statusFilter !== "all" && <Badge variant="outline">{statusFilter}</Badge>}
            </div>

            {/* Table */}
            <EntityTable
                data={filteredIdentities}
                columns={columns}
                isLoading={!identities && !dataSource}
                emptyMessage="No users found matching your filters"
                getRowId={(row) => row._id}
            />
        </div>
    );
}
