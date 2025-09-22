"use client";

import { useMemo } from "react";
import {
  RefreshCw,
  Download,
  Columns,
  Filter,
  MoreHorizontal,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  DataTableAction,
  DataTableView,
  DataTableColumn,
  DataTableFilter,
} from "@/lib/types/datatable";
import { DataTableFilters } from "./DataTableFilters";

interface DataTableToolbarProps<T> {
  // Actions
  actions?: DataTableAction<T>[];
  selectedRows: T[];
  onActionClick?: (actionId: string, rows: T[]) => void;

  // Views
  views?: DataTableView[];
  currentView?: string | null;
  onViewChange?: (viewId: string | null) => void;

  // Filters
  filters: DataTableFilter[];
  onFiltersChange: (filters: DataTableFilter[]) => void;

  // Column visibility
  columns?: DataTableColumn<T>[];
  hiddenColumns?: string[];
  onColumnVisibilityChange?: (columnKey: string, visible: boolean) => void;

  // Export
  enableExport?: boolean;
  onExport?: (format: "csv" | "tsv" | "json") => void;

  // Refresh
  enableRefresh?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;

  className?: string;
}

export function DataTableToolbar<T>({
  actions = [],
  selectedRows = [],
  onActionClick,
  views = [],
  currentView,
  onViewChange,
  filters = [],
  onFiltersChange,
  columns = [],
  hiddenColumns = [],
  onColumnVisibilityChange,
  enableExport = false,
  onExport,
  enableRefresh = false,
  onRefresh,
  isRefreshing = false,
  className,
}: DataTableToolbarProps<T>) {
  const hideableColumns = useMemo(() => {
    return columns.filter((col) => col.hideable !== false);
  }, [columns]);

  const hasSelectedRows = selectedRows.length > 0;
  const activeActionsCount = actions.filter(
    (action) => !action.disabled || !action.disabled(selectedRows)
  ).length;

  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <div className="flex items-center gap-2">
        {/* Views Selector */}
        {views.length > 0 && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Eye className="h-4 w-4" />
                  {currentView
                    ? views.find((v) => v.id === currentView)?.name
                    : "All Data"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Views</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onViewChange?.(null)}
                  className={currentView === null ? "bg-accent" : ""}
                >
                  All Data
                </DropdownMenuItem>
                {views.map((view) => (
                  <DropdownMenuItem
                    key={view.id}
                    onClick={() => onViewChange?.(view.id)}
                    className={currentView === view.id ? "bg-accent" : ""}
                  >
                    {view.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Separator orientation="vertical" className="h-6" />
          </>
        )}

        {/* Filters Button */}
        <DataTableFilters
          columns={columns}
          filters={filters}
          onFiltersChange={onFiltersChange}
          triggerButton={
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
              {filters.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {filters.length}
                </Badge>
              )}
            </Button>
          }
        />
      </div>

      <div className="flex items-center gap-2">
        {/* Selection Info */}
        {hasSelectedRows && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {selectedRows.length} row{selectedRows.length === 1 ? "" : "s"}{" "}
            selected
            <Separator orientation="vertical" className="h-4" />
          </div>
        )}

        {/* Actions */}
        {actions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasSelectedRows || activeActionsCount === 0}
                className="gap-2"
              >
                <MoreHorizontal className="h-4 w-4" />
                Actions
                {hasSelectedRows && activeActionsCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 h-5 px-1.5 text-xs"
                  >
                    {activeActionsCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {actions.map((action) => {
                const isDisabled = action.disabled?.(selectedRows) ?? false;
                return (
                  <DropdownMenuItem
                    key={action.id}
                    onClick={() =>
                      !isDisabled && onActionClick?.(action.id, selectedRows)
                    }
                    disabled={isDisabled}
                    className="gap-2"
                  >
                    {action.icon}
                    {action.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Column Visibility */}
        {hideableColumns.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Columns className="h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {hideableColumns.map((column) => {
                if (!column.hideable) return null;

                const columnKey = String(column.key);
                const isVisible = !hiddenColumns.includes(columnKey);
                return (
                  <DropdownMenuCheckboxItem
                    key={columnKey}
                    checked={isVisible}
                    onCheckedChange={(checked) =>
                      onColumnVisibilityChange?.(columnKey, checked)
                    }
                  >
                    {column.label}
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Export */}
        {enableExport && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Export format</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onExport?.("csv")}>
                CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport?.("tsv")}>
                TSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport?.("json")}>
                JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Refresh */}
        {enableRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw
              className={cn("h-4 w-4", isRefreshing && "animate-spin")}
            />
            Refresh
          </Button>
        )}
      </div>
    </div>
  );
}
