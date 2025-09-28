"use client";

import { useState, useCallback } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Separator } from "@workspace/ui/components/separator";
import { cn } from "@/lib/utils";
import { DataTableColumn, DataTableFilter } from "@/lib/types/datatable";
import { SearchBar } from "../SearchBar";

interface DataTableFiltersProps<T> {
  columns: DataTableColumn<T>[];
  filters: DataTableFilter[];
  onFiltersChange: (filters: DataTableFilter[]) => void;
  triggerButton?: React.ReactNode;
  className?: string;
}

const OPERATORS = [
  { value: "eq", label: "Equals", supportedTypes: ["text", "number", "date"] },
  {
    value: "neq",
    label: "Not equals",
    supportedTypes: ["text", "number", "date"],
  },
  { value: "gt", label: "Greater than", supportedTypes: ["number", "date"] },
  {
    value: "gte",
    label: "Greater than or equal",
    supportedTypes: ["number", "date"],
  },
  { value: "lt", label: "Less than", supportedTypes: ["number", "date"] },
  {
    value: "lte",
    label: "Less than or equal",
    supportedTypes: ["number", "date"],
  },
  { value: "ilike", label: "Contains", supportedTypes: ["text"] },
  { value: "in", label: "In list", supportedTypes: ["text", "number"] },
  { value: "is", label: "Is null", supportedTypes: ["text", "number", "date"] },
  {
    value: "not.is",
    label: "Is not null",
    supportedTypes: ["text", "number", "date"],
  },
] as const;

export function DataTableFilters<T>({
  columns,
  filters,
  onFiltersChange,
  triggerButton,
  className,
}: DataTableFiltersProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [newFilter, setNewFilter] = useState<Partial<DataTableFilter>>({});

  // Get filterable columns (all columns are filterable by default)
  const filterableColumns = columns.filter((col) => col.hideable !== false);

  const addFilter = useCallback(() => {
    if (
      newFilter.column &&
      newFilter.operator &&
      newFilter.value !== undefined
    ) {
      const filter: DataTableFilter = {
        column: newFilter.column,
        operator: newFilter.operator as DataTableFilter["operator"],
        value: newFilter.value,
      };
      onFiltersChange([...filters, filter]);
      setNewFilter({});
    }
  }, [newFilter, filters, onFiltersChange]);

  const removeFilter = useCallback(
    (index: number) => {
      const newFilters = filters.filter((_, i) => i !== index);
      onFiltersChange(newFilters);
    },
    [filters, onFiltersChange]
  );

  const updateFilter = useCallback(
    (index: number, updates: Partial<DataTableFilter>) => {
      const newFilters = filters.map((filter, i) =>
        i === index ? { ...filter, ...updates } : filter
      );
      onFiltersChange(newFilters);
    },
    [filters, onFiltersChange]
  );

  const clearAllFilters = useCallback(() => {
    onFiltersChange([]);
  }, [onFiltersChange]);

  const getColumnType = (columnKey: string): string => {
    // Simple type detection based on column key
    const key = columnKey.toLowerCase();
    if (
      key.includes("date") ||
      key.includes("time") ||
      key.includes("created") ||
      key.includes("updated")
    ) {
      return "date";
    }
    if (
      key.includes("id") ||
      key.includes("count") ||
      key.includes("amount") ||
      key.includes("price")
    ) {
      return "number";
    }
    return "text";
  };

  const getAvailableOperators = (columnKey: string) => {
    const columnType = getColumnType(columnKey);
    return OPERATORS.filter((op) =>
      (op.supportedTypes as readonly string[]).includes(columnType)
    );
  };

  const renderValueInput = (filter: DataTableFilter, index?: number) => {
    const columnType = getColumnType(filter.column);
    const isNullOperator =
      filter.operator === "is" || filter.operator === "not.is";

    if (isNullOperator) {
      // For null operators, we don't need a value input since the value is always "null"
      return (
        <div className="flex items-center text-sm text-muted-foreground px-3 py-2">
          No value needed
        </div>
      );
    }

    const placeholder =
      filter.operator === "in"
        ? "Enter comma-separated values"
        : "Enter value...";

    const handleValueChange = (value: string) => {
      if (index !== undefined) {
        updateFilter(index, { value });
      } else {
        setNewFilter((prev) => ({ ...prev, value }));
      }
    };

    // Use SearchBar for text inputs to get debounce functionality without search icon
    if (columnType === "text") {
      return (
        <SearchBar
          value={filter.value || ""}
          onSearch={handleValueChange}
          delay={1000}
          placeholder={placeholder}
          className="h-8"
        />
      );
    }

    // Use regular Input for number and date inputs
    const inputProps = {
      type:
        columnType === "number"
          ? "number"
          : columnType === "date"
            ? "date"
            : "text",
      value: filter.value || "",
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        handleValueChange(e.target.value);
      },
      placeholder,
      className: "h-8",
    };

    return <Input {...inputProps} />;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {triggerButton || (
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Filter
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className={cn("w-[30vw]", className)} align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Filters</h4>
            {filters.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-8 px-2 text-xs"
              >
                Clear all
              </Button>
            )}
          </div>

          {/* Existing Filters */}
          {filters.length > 0 && (
            <div className="space-y-2">
              {filters.map((filter, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 border rounded-md"
                >
                  <div className="grid grid-cols-3 gap-2 w-full">
                    {/* Column */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="justify-start"
                        >
                          {filterableColumns.find(
                            (col) => String(col.key) === filter.column
                          )?.label || filter.column}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {filterableColumns.map((column) => (
                          <DropdownMenuItem
                            key={String(column.key)}
                            onClick={() =>
                              updateFilter(index, {
                                column: String(column.key),
                              })
                            }
                          >
                            {column.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Operator */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="justify-start"
                        >
                          {OPERATORS.find((op) => op.value === filter.operator)
                            ?.label || filter.operator}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {getAvailableOperators(filter.column).map(
                          (operator) => (
                            <DropdownMenuItem
                              key={operator.value}
                              onClick={() =>
                                updateFilter(index, {
                                  operator:
                                    operator.value as DataTableFilter["operator"],
                                  value:
                                    operator.value === "is" ||
                                    operator.value === "not.is"
                                      ? "null"
                                      : filter.value,
                                })
                              }
                            >
                              {operator.label}
                            </DropdownMenuItem>
                          )
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Value */}
                    <div className="flex-1">
                      {renderValueInput(filter, index)}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFilter(index)}
                    className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                    <span className="sr-only">Remove filter</span>
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add New Filter */}
          <div>
            <Separator className="mb-3" />
            <Label className="text-xs font-medium text-muted-foreground mb-2 block">
              Add new filter
            </Label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {/* Column */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-start">
                    {newFilter.column
                      ? filterableColumns.find(
                          (col) => String(col.key) === newFilter.column
                        )?.label
                      : "Column"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {filterableColumns.map((column) => (
                    <DropdownMenuItem
                      key={String(column.key)}
                      onClick={() =>
                        setNewFilter((prev) => ({
                          ...prev,
                          column: String(column.key),
                          operator: undefined,
                          value: undefined,
                        }))
                      }
                    >
                      {column.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Operator */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start"
                    disabled={!newFilter.column}
                  >
                    {newFilter.operator
                      ? OPERATORS.find((op) => op.value === newFilter.operator)
                          ?.label
                      : "Operator"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {newFilter.column &&
                    getAvailableOperators(newFilter.column).map((operator) => (
                      <DropdownMenuItem
                        key={operator.value}
                        onClick={() =>
                          setNewFilter((prev) => ({
                            ...prev,
                            operator:
                              operator.value as DataTableFilter["operator"],
                            value:
                              operator.value === "is" ||
                              operator.value === "not.is"
                                ? "null"
                                : undefined,
                          }))
                        }
                      >
                        {operator.label}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Value */}
              <div className="flex-1">
                {newFilter.column &&
                  newFilter.operator &&
                  renderValueInput({
                    column: newFilter.column,
                    operator: newFilter.operator as DataTableFilter["operator"],
                    value: newFilter.value || "",
                  })}
              </div>
            </div>

            <Button
              onClick={addFilter}
              disabled={
                !newFilter.column ||
                !newFilter.operator ||
                (!newFilter.value &&
                  newFilter.operator !== "is" &&
                  newFilter.operator !== "not.is")
              }
              size="sm"
              className="w-full"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Filter
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
