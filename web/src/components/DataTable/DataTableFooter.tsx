import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { DataTablePagination } from "@/lib/types/datatable";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function DataTableFooter<T extends Record<string, any>>({
  pagination,
  selectedRows,
  searchTerm,
  changePageSize,
  goToPage,
  loading,
}: {
  pagination: DataTablePagination;
  selectedRows: T[];
  searchTerm: string;
  changePageSize: (pageSize: number) => void;
  goToPage: (page: number) => void;
  loading: boolean;
}) {
  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-muted-foreground">
        Showing {(pagination.page - 1) * pagination.pageSize + 1} to{" "}
        {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
        {pagination.total} results
        {selectedRows.length > 0 && (
          <span className="ml-2">({selectedRows.length} selected)</span>
        )}
        {searchTerm && <span className="ml-2">• Filtered by search</span>}
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={pagination.pageSize.toString()}
          onValueChange={(value) => changePageSize(Number(value))}
        >
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10, 20, 50, 100].map((size) => (
              <SelectItem key={size} value={size.toString()}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(pagination.page - 1)}
          disabled={pagination.page === 1 || loading}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span className="text-sm">
          Page {pagination.page} of {totalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(pagination.page + 1)}
          disabled={pagination.page >= totalPages || loading}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
