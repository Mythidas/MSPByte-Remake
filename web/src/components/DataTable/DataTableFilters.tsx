"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Filter } from "lucide-react";
import { DataTableFilter, DataTableColumn } from "@/lib/types/datatable";

interface FilterBuilderProps<T> {
  columns: DataTableColumn<T>[];
  onAddFilter: (filter: DataTableFilter) => void;
  className?: string;
}

export function DataTableFilters<T>({
  columns,
  onAddFilter,
  className,
}: FilterBuilderProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [newFilter, setNewFilter] = useState<Partial<DataTableFilter>>({
    column: "",
    operator: "eq",
    value: "",
  });

  const operators = [
    { value: "eq", label: "Equals" },
    { value: "neq", label: "Not equals" },
    { value: "gt", label: "Greater than" },
    { value: "gte", label: "Greater than or equal" },
    { value: "lt", label: "Less than" },
    { value: "lte", label: "Less than or equal" },
    { value: "like", label: "Contains" },
    { value: "ilike", label: "Contains (case insensitive)" },
    { value: "in", label: "In" },
    { value: "is", label: "Is" },
  ];

  const filterableColumns = columns.filter((col) => col.filterable);

  const handleAddFilter = () => {
    if (newFilter.column && newFilter.operator && newFilter.value !== "") {
      const column = filterableColumns.find(
        (col) => col.key === newFilter.column
      );
      const filter: DataTableFilter = {
        column: newFilter.column,
        operator: newFilter.operator as any,
        value: newFilter.value || "",
        jsonbPath: column?.jsonbPath,
      };

      onAddFilter(filter);

      // Reset form
      setNewFilter({
        column: "",
        operator: "eq",
        value: "",
      });
      setIsOpen(false);
    }
  };

  const getFilterInput = () => {
    const column = filterableColumns.find(
      (col) => col.key === newFilter.column
    );

    if (!column) {
      return (
        <Input
          placeholder="Value"
          value={newFilter.value}
          onChange={(e) =>
            setNewFilter((prev) => ({ ...prev, value: e.target.value }))
          }
          className="flex-1"
        />
      );
    }

    switch (column.filterType) {
      case "select":
        return (
          <Select
            value={newFilter.value}
            onValueChange={(value) =>
              setNewFilter((prev) => ({ ...prev, value }))
            }
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent>
              {column.filterOptions?.map((option) => (
                <SelectItem key={option.value} value={option.value as string}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "number":
        return (
          <Input
            type="number"
            placeholder="Value"
            value={newFilter.value}
            onChange={(e) =>
              setNewFilter((prev) => ({ ...prev, value: e.target.value }))
            }
            className="flex-1"
          />
        );

      case "date":
        return (
          <Input
            type="date"
            value={newFilter.value}
            onChange={(e) =>
              setNewFilter((prev) => ({ ...prev, value: e.target.value }))
            }
            className="flex-1"
          />
        );

      case "boolean":
        return (
          <Select
            value={newFilter.value}
            onValueChange={(value) =>
              setNewFilter((prev) => ({ ...prev, value }))
            }
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">True</SelectItem>
              <SelectItem value="false">False</SelectItem>
            </SelectContent>
          </Select>
        );

      default:
        return (
          <Input
            placeholder="Value"
            value={newFilter.value}
            onChange={(e) =>
              setNewFilter((prev) => ({ ...prev, value: e.target.value }))
            }
            className="flex-1"
          />
        );
    }
  };

  if (filterableColumns.length === 0) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Filter className="h-4 w-4 mr-2" />
          Add Filter
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-4" align="start">
        <div className="space-y-4">
          <h4 className="font-medium">Add Filter</h4>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Column</label>
              <Select
                value={newFilter.column}
                onValueChange={(value) =>
                  setNewFilter((prev) => ({ ...prev, column: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {filterableColumns.map((column) => (
                    <SelectItem
                      key={column.key as string}
                      value={column.key as string}
                    >
                      {column.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Operator</label>
              <Select
                value={newFilter.operator}
                onValueChange={(value) =>
                  setNewFilter((prev) => ({ ...prev, operator: value as any }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {operators.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Value</label>
              {getFilterInput()}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleAddFilter}
              size="sm"
              disabled={
                !newFilter.column ||
                !newFilter.operator ||
                newFilter.value === ""
              }
            >
              Add Filter
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
