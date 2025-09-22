"use client";

import { Badge } from "@/components/ui/badge";
import { Eye, Edit, Trash2, Building, ExternalLink, Globe } from "lucide-react";
import { prettyText } from "@workspace/shared/lib/utils";
import { Tables } from "@workspace/shared/types/database";
import { getRows } from "@/lib/supabase/orm";
import {
  DataTableColumn,
  DataTableAction,
  DataTableFetchParams,
  DataTableFetchResult,
  DataTableView,
} from "@/lib/types/datatable";
import { DataTable } from "@/components/table/DataTable";
import Link from "next/link";

type Data = Tables<"sites_view">;

const columns: DataTableColumn<Data>[] = [
  {
    key: "name",
    label: "Site Name",
    width: "300px",
    sortable: true,
    searchable: true,
    render: (value, row) => (
      <div className="flex items-center gap-2">
        <Building className="h-4 w-4 text-primary" />
        <div className="flex flex-col">
          <Link
            href={`/sites/${row.slug}`}
            className="font-medium hover:text-primary hover:underline"
          >
            {value || "Unnamed Site"}
          </Link>
        </div>
      </div>
    ),
  },
  {
    key: "parent_name",
    label: "Parent Site",
    width: "200px",
    sortable: true,
    searchable: true,
    hideable: true,
    render: (value, row) => {
      if (!value) {
        return (
          <Badge variant="outline" className="text-xs">
            Root Site
          </Badge>
        );
      }
      return (
        <Link
          href={`/sites/${row.parent_slug}`}
          target="_blank"
          className="text-sm hover:text-primary hover:underline flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3" />
          {value}
        </Link>
      );
    },
  },
  {
    key: "slug",
    label: "Slug",
    width: "80px",
  },
  {
    key: "status",
    label: "Status",
    width: "80px",
    sortable: true,
    render: (value) => {
      const status = value || "unknown";
      const variant =
        status === "active"
          ? "default"
          : status === "inactive"
            ? "secondary"
            : status === "maintenance"
              ? "destructive"
              : "outline";
      return <Badge variant={variant}>{prettyText(status)}</Badge>;
    },
  },
  {
    key: "psa_company_id",
    label: "PSA Integration",
    width: "80px",
    sortable: true,
    hideable: true,
  },
];

const actions: DataTableAction<Data>[] = [
  {
    id: "view",
    label: "View Details",
    icon: <Eye className="h-4 w-4" />,
    onClick: async (rows) => {
      // Navigate to site detail page
      if (rows.length === 1) {
        window.open(`/sites/${rows[0].slug}`, "_blank");
      }
    },
    disabled: (rows) => rows.length !== 1,
  },
  {
    id: "edit",
    label: "Edit Site",
    icon: <Edit className="h-4 w-4" />,
    onClick: async (rows) => {
      // Navigate to edit page
      if (rows.length === 1) {
        window.location.href = `/sites/${rows[0].slug}/edit`;
      }
    },
    disabled: (rows) => rows.length !== 1,
  },
  {
    id: "deactivate",
    label: "Deactivate Sites",
    icon: <Trash2 className="h-4 w-4" />,
    variant: "destructive",
    disabled: (rows) =>
      rows.length === 0 || rows.some((row) => row.status !== "active"),
    onClick: async (rows) => {
      const confirmed = confirm(
        `Are you sure you want to deactivate ${rows.length} site(s)?`
      );
      if (confirmed) {
        // TODO: Implement site deactivation
        console.log(
          "Deactivating sites:",
          rows.map((r) => r.id)
        );
      }
    },
  },
];

// Define predefined views for common site filters
const views: DataTableView[] = [
  {
    id: "active-sites",
    name: "Active Sites",
    filters: [{ column: "status", operator: "eq", value: "active" }],
    sorts: [{ column: "name", direction: "asc" }],
  },
  {
    id: "root-sites",
    name: "Root Sites",
    filters: [{ column: "parent_id", operator: "is", value: "null" }],
    sorts: [{ column: "name", direction: "asc" }],
  },
  {
    id: "sub-sites",
    name: "Sub Sites",
    filters: [{ column: "parent_id", operator: "not.is", value: "null" }],
    sorts: [{ column: "parent_name", direction: "asc" }],
  },
];

export default function Sites() {
  const fetcher = async (
    params: DataTableFetchParams
  ): Promise<DataTableFetchResult<Data>> => {
    try {
      console.log("Fetcher called with params:", params);
      const result = await getRows("sites_view", {
        pagination: params,
      });

      if (result.error) {
        return {
          data: [],
          count: 0,
          error: result.error.message,
        };
      }

      return {
        data: result.data?.rows || [],
        count: result.data?.total || 0,
      };
    } catch (error) {
      return {
        data: [],
        count: 0,
        error: error instanceof Error ? error.message : "Failed to fetch sites",
      };
    }
  };

  return (
    <div className="flex flex-col size-full mx-auto p-4">
      <div className="flex shrink items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Sites Management</h1>
          <p className="text-muted-foreground">
            Manage client sites and their hierarchical structure
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        fetcher={fetcher}
        actions={actions}
        views={views}
        initialFilters={[]}
        initialSort={[{ column: "name", direction: "asc" }]}
        enableSearch={true}
        searchPlaceholder="Search sites by name or parent..."
        enableSelection={true}
        enableRefresh={true}
        enableExport={true}
        enableColumnToggle={true}
        emptyMessage="No sites found. Create your first site to get started."
        className="flex-1"
      />
    </div>
  );
}
