"use client";

import { X } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { TableFilter, DataTableColumn } from "./types";
import { getOperatorLabel } from "./utils/filters";

interface DataTableFilterChipsProps<TData> {
  filters: TableFilter[];
  viewFilters?: TableFilter[];
  columns: DataTableColumn<TData>[];
  onRemoveFilter: (filter: TableFilter) => void;
  onClearFilters: () => void;
}

export function DataTableFilterChips<TData>({
  filters,
  viewFilters = [],
  columns,
  onRemoveFilter,
  onClearFilters,
}: DataTableFilterChipsProps<TData>) {
  const viewFilterFields = new Set(
    viewFilters.map(
      (f) => `${f.field}:${f.operator}:${JSON.stringify(f.value)}`,
    ),
  );

  // Only show dynamic filters (not from views)
  const dynamicFilters = filters.filter(
    (f) =>
      !viewFilterFields.has(
        `${f.field}:${f.operator}:${JSON.stringify(f.value)}`,
      ),
  );

  if (dynamicFilters.length === 0) {
    return null;
  }

  const getFilterLabel = (filter: TableFilter): string => {
    const column = columns.find((c) => c.key === filter.field);
    const fieldLabel = column?.title || filter.field;
    const operatorLabel = getOperatorLabel(filter.operator);

    let valueLabel = String(filter.value);

    // Format array values for 'in' and 'nin' operators
    if (Array.isArray(filter.value)) {
      valueLabel = filter.value.join(", ");
    }

    // Format date values
    if (column?.filter?.type === "date" && filter.value) {
      try {
        const date = new Date(filter.value);
        valueLabel = date.toLocaleDateString();
      } catch {
        // Keep original value if parsing fails
      }
    }

    // Format boolean values
    if (column?.filter?.type === "boolean") {
      valueLabel = filter.value ? "Yes" : "No";
    }

    // Format select values with labels
    if (column?.filter?.type === "select" && column.filter.options) {
      if (Array.isArray(filter.value)) {
        const labels = filter.value
          .map(
            (v) =>
              column.filter?.options?.find((opt) => opt.value === v)?.label ||
              v,
          )
          .join(", ");
        valueLabel = labels;
      } else {
        const option = column.filter.options.find(
          (opt) => opt.value === filter.value,
        );
        valueLabel = option?.label || String(filter.value);
      }
    }

    return `${fieldLabel} ${operatorLabel} ${valueLabel}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {dynamicFilters.map((filter, index) => (
        <Badge
          key={`${filter.field}-${index}`}
          variant="secondary"
          className="gap-1"
        >
          <span>{getFilterLabel(filter)}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 hover:bg-transparent"
            onClick={() => onRemoveFilter(filter)}
          >
            <X className="h-3 w-3" />
            <span className="sr-only">Remove filter</span>
          </Button>
        </Badge>
      ))}

      {dynamicFilters.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="h-auto px-2 py-1 text-xs"
        >
          Clear all
        </Button>
      )}
    </div>
  );
}
