"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { DataTableColumn, FilterOperator, TableFilter } from "./types";
import { TextFilterInput } from "./filter-inputs/TextFilterInput";
import { SelectFilterInput } from "./filter-inputs/SelectFilterInput";
import { NumberFilterInput } from "./filter-inputs/NumberFilterInput";
import { BooleanFilterInput } from "./filter-inputs/BooleanFilterInput";
import { DateFilterInput } from "./filter-inputs/DateFilterInput";

interface DataTableFilterBuilderProps<TData> {
  columns: DataTableColumn<TData>[];
  onAddFilter: (filter: TableFilter) => void;
}

export function DataTableFilterBuilder<TData>({
  columns,
  onAddFilter,
}: DataTableFilterBuilderProps<TData>) {
  const [open, setOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<string>("");
  const [operator, setOperator] = useState<FilterOperator>("eq");
  const [value, setValue] = useState<any>("");

  const filterableColumns = columns.filter((col) => col.filter);

  const selectedColumn = filterableColumns.find(
    (col) => col.key === selectedField,
  );
  const filterConfig = selectedColumn?.filter;

  const handleAddFilter = () => {
    if (!selectedField || !filterConfig) return;

    // Validate value
    if (value === "" || value === null || value === undefined) {
      return;
    }

    // For multi-select, ensure array has items
    if (
      (operator === "in" || operator === "nin") &&
      (!Array.isArray(value) || value.length === 0)
    ) {
      return;
    }

    const filter: TableFilter = {
      field: selectedField,
      operator,
      value,
    };

    onAddFilter(filter);

    // Reset form
    setSelectedField("");
    setOperator("eq");
    setValue("");
    setOpen(false);
  };

  const handleFieldChange = (field: string) => {
    setSelectedField(field);
    const column = filterableColumns.find((col) => col.key === field);
    if (column?.filter) {
      // Set default operator
      setOperator(column.filter.operators[0]);
      // Reset value
      if (column.filter.type === "boolean") {
        setValue(false);
      } else if (
        column.filter.type === "select" &&
        (column.filter.operators[0] === "in" ||
          column.filter.operators[0] === "nin")
      ) {
        setValue([]);
      } else {
        setValue("");
      }
    }
  };

  const handleOperatorChange = (newOperator: FilterOperator) => {
    setOperator(newOperator);
    // Reset value when switching between single/multi select
    if (filterConfig?.type === "select") {
      if (newOperator === "in" || newOperator === "nin") {
        setValue([]);
      } else {
        setValue("");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className="h-8 gap-2 !bg-accent !text-accent-foreground"
        >
          <Plus className="h-4 w-4" />
          Add Filter
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Filter</DialogTitle>
          <DialogDescription>
            Create a new filter to narrow down your results.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Field Selection */}
          <div className="space-y-2">
            <Label htmlFor="field">Field</Label>
            <Select value={selectedField} onValueChange={handleFieldChange}>
              <SelectTrigger id="field">
                <SelectValue placeholder="Select a field..." />
              </SelectTrigger>
              <SelectContent>
                {filterableColumns.map((column) => (
                  <SelectItem key={column.key} value={column.key}>
                    {column.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filter Input based on type */}
          {selectedField && filterConfig && (
            <>
              {filterConfig.type === "text" && (
                <TextFilterInput
                  config={filterConfig}
                  operator={operator}
                  value={value}
                  onOperatorChange={handleOperatorChange}
                  onValueChange={setValue}
                />
              )}

              {filterConfig.type === "select" && (
                <SelectFilterInput
                  config={filterConfig}
                  operator={operator}
                  value={value}
                  onOperatorChange={handleOperatorChange}
                  onValueChange={setValue}
                />
              )}

              {filterConfig.type === "number" && (
                <NumberFilterInput
                  config={filterConfig}
                  operator={operator}
                  value={value}
                  onOperatorChange={handleOperatorChange}
                  onValueChange={setValue}
                />
              )}

              {filterConfig.type === "boolean" && (
                <BooleanFilterInput value={value} onValueChange={setValue} />
              )}

              {filterConfig.type === "date" && (
                <DateFilterInput
                  config={filterConfig}
                  operator={operator}
                  value={value}
                  onOperatorChange={handleOperatorChange}
                  onValueChange={setValue}
                />
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAddFilter}
            disabled={!selectedField || value === ""}
          >
            Add Filter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
