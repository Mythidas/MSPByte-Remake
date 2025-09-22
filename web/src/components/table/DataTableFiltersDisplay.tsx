"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DataTableColumn,
  DataTableFilter,
} from "@/lib/types/datatable";

interface DataTableFiltersDisplayProps<T> {
  columns: DataTableColumn<T>[];
  filters: DataTableFilter[];
  search?: string;
  currentView?: string | null;
  viewName?: string;
  onFilterRemove: (index: number) => void;
  onSearchClear?: () => void;
  onViewClear?: () => void;
  onClearAll: () => void;
  className?: string;
}

const OPERATOR_LABELS: Record<string, string> = {
  eq: "equals",
  neq: "not equals",
  gt: "greater than",
  gte: "greater than or equal",
  lt: "less than",
  lte: "less than or equal",
  like: "contains",
  ilike: "contains",
  in: "in",
  is: "is",
};

export function DataTableFiltersDisplay<T>({
  columns,
  filters,
  search,
  currentView,
  viewName,
  onFilterRemove,
  onSearchClear,
  onViewClear,
  onClearAll,
  className,
}: DataTableFiltersDisplayProps<T>) {
  const hasActiveFilters = filters.length > 0 || search || currentView;

  if (!hasActiveFilters) {
    return null;
  }

  const getColumnLabel = (columnKey: string): string => {
    const column = columns.find(col => String(col.key) === columnKey);
    return column?.label || columnKey;
  };

  const formatFilterValue = (filter: DataTableFilter): string => {
    if (filter.operator === "is") {
      return filter.value === "null" ? "null" : "not null";
    }

    if (filter.operator === "in") {
      const values = filter.value.split(",").map(v => v.trim());
      if (values.length > 3) {
        return `${values.slice(0, 3).join(", ")} and ${values.length - 3} more`;
      }
      return values.join(", ");
    }

    // Truncate long values
    if (filter.value.length > 20) {
      return `${filter.value.substring(0, 20)}...`;
    }

    return filter.value;
  };

  const getFilterDescription = (filter: DataTableFilter): string => {
    const column = getColumnLabel(filter.column);
    const operator = OPERATOR_LABELS[filter.operator] || filter.operator;
    const value = formatFilterValue(filter);

    if (filter.operator === "is") {
      return `${column} is ${value}`;
    }

    return `${column} ${operator} ${value}`;
  };

  return (
    <div className={cn("flex items-center gap-2 flex-wrap py-2", className)}>
      <span className="text-sm text-muted-foreground font-medium">Active filters:</span>

      {/* Current View */}
      {currentView && viewName && (
        <Badge variant="secondary" className="gap-1">
          View: {viewName}
          {onViewClear && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewClear}
              className="h-auto w-auto p-0 ml-1 hover:bg-transparent"
            >
              <X className="h-3 w-3" />
              <span className="sr-only">Clear view</span>
            </Button>
          )}
        </Badge>
      )}

      {/* Search Filter */}
      {search && (
        <Badge variant="secondary" className="gap-1">
          Search: {search.length > 20 ? `${search.substring(0, 20)}...` : search}
          {onSearchClear && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSearchClear}
              className="h-auto w-auto p-0 ml-1 hover:bg-transparent"
            >
              <X className="h-3 w-3" />
              <span className="sr-only">Clear search</span>
            </Button>
          )}
        </Badge>
      )}

      {/* Column Filters */}
      {filters.map((filter, index) => (
        <Badge key={index} variant="secondary" className="gap-1">
          {getFilterDescription(filter)}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFilterRemove(index)}
            className="h-auto w-auto p-0 ml-1 hover:bg-transparent"
          >
            <X className="h-3 w-3" />
            <span className="sr-only">Remove filter</span>
          </Button>
        </Badge>
      ))}

      {/* Clear All Button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          Clear all
        </Button>
      )}
    </div>
  );
}