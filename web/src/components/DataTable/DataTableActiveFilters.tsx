import { Button } from "@/components/ui/button";
import { DataTableFilter } from "@/lib/types/datatable";
import { X } from "lucide-react";

export default function DataTableActiveFilters({
  filters,
  searchTerm,
  removeFilter,
  clearFilters,
  handleSearchChange,
}: {
  filters: DataTableFilter[];
  searchTerm: string;
  removeFilter: (index: number) => void;
  clearFilters: () => void;
  handleSearchChange: (term: string) => void;
}) {
  if (filters.length === 0 && !searchTerm) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-medium">Active:</span>
      {searchTerm && (
        <Button
          variant="secondary"
          className="gap-1 h-fit !px-2 !py-1"
          onClick={() => handleSearchChange("")}
        >
          Search: "{searchTerm}"
          <X className="h-3 w-3 cursor-pointer" />
        </Button>
      )}
      {filters.map((filter, index) => (
        <Button
          key={index}
          variant="secondary"
          className="gap-1 h-fit !px-2 !py-1"
          onClick={() => removeFilter(index)}
        >
          {filter.column} {filter.operator} {String(filter.value)}
          <X className="h-3 w-3 cursor-pointer" />
        </Button>
      ))}
      {(filters.length > 0 || searchTerm) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            clearFilters();
            if (searchTerm) handleSearchChange("");
          }}
        >
          Clear all
        </Button>
      )}
    </div>
  );
}
