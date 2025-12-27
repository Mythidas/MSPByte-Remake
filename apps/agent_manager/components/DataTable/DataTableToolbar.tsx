"use client";

import { Table } from "@tanstack/react-table";
import { Search } from "lucide-react";
import { Input } from "@workspace/ui/components/input";
import { DataTableColumn, TableFilter, TableView } from "./types";
import { DataTableFilterBuilder } from "./DataTableFilterBuilder";
import { DataTableFilterChips } from "./DataTableFilterChips";
import { DataTableViewSelector } from "./DataTableViewSelector";
import { DataTableColumnToggle } from "./DataTableColumnToggle";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  columns: DataTableColumn<TData>[];
  globalSearch?: string;
  onGlobalSearchChange?: (search: string) => void;
  filters?: TableFilter[];
  viewFilters?: TableFilter[];
  onAddFilter?: (filter: TableFilter) => void;
  onRemoveFilter?: (filter: TableFilter) => void;
  onClearFilters?: () => void;
  views?: TableView[];
  activeView?: TableView;
  onViewChange?: (view?: TableView) => void;
  showColumnToggle?: boolean;
}

export function DataTableToolbar<TData>({
  table,
  columns,
  globalSearch = "",
  onGlobalSearchChange,
  filters = [],
  viewFilters = [],
  onAddFilter,
  onRemoveFilter,
  onClearFilters,
  views = [],
  activeView,
  onViewChange,
  showColumnToggle = true,
}: DataTableToolbarProps<TData>) {
  return (
    <div className="space-y-4">
      {/* Top row: Search and Actions */}
      <div className="flex items-center justify-between gap-4">
        {/* Global Search */}
        {onGlobalSearchChange && (
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={globalSearch}
              onChange={(e) => onGlobalSearchChange(e.target.value)}
              className="pl-9 !bg-input"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onAddFilter && (
            <DataTableFilterBuilder
              columns={columns}
              onAddFilter={onAddFilter}
            />
          )}
          {showColumnToggle && (
            <DataTableColumnToggle table={table} columns={columns} />
          )}
        </div>
      </div>

      {/* Views row */}
      {views.length > 0 && onViewChange && (
        <DataTableViewSelector
          views={views}
          activeView={activeView}
          onViewChange={onViewChange}
        />
      )}

      {/* Filter chips */}
      {onRemoveFilter && onClearFilters && (
        <DataTableFilterChips
          filters={filters}
          viewFilters={viewFilters}
          columns={columns}
          onRemoveFilter={onRemoveFilter}
          onClearFilters={onClearFilters}
        />
      )}
    </div>
  );
}
