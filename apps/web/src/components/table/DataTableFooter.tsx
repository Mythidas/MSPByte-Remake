"use client";

import { useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { cn } from "@/lib/utils";
import { DataTablePagination } from "@/lib/types/datatable";

interface DataTableFooterProps {
  pagination: DataTablePagination;
  onPaginationChange: (pagination: DataTablePagination) => void;
  selectedCount?: number;
  className?: string;
  pageSizeOptions?: number[];
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function DataTableFooter({
  pagination,
  onPaginationChange,
  selectedCount = 0,
  className,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: DataTableFooterProps) {
  const { page, pageSize, total } = pagination;

  // Calculate pagination info
  const totalPages = useMemo(() => {
    return Math.ceil(total / pageSize);
  }, [total, pageSize]);

  const startItem = useMemo(() => {
    return page * pageSize + 1;
  }, [page, pageSize]);

  const endItem = useMemo(() => {
    return Math.min((page + 1) * pageSize, total);
  }, [page, pageSize, total]);

  const isFirstPage = page === 0;
  const isLastPage = page >= totalPages - 1;

  // Handle pagination changes
  const handlePageChange = (newPage: number) => {
    if (newPage >= 0 && newPage < totalPages) {
      onPaginationChange({
        ...pagination,
        page: newPage,
      });
    }
  };

  const handlePageSizeChange = (newPageSize: number) => {
    // Calculate the current item offset
    const currentOffset = page * pageSize;
    // Calculate the new page to maintain position
    const newPage = Math.floor(currentOffset / newPageSize);

    onPaginationChange({
      ...pagination,
      page: newPage,
      pageSize: newPageSize,
    });
  };

  const goToFirstPage = () => handlePageChange(0);
  const goToLastPage = () => handlePageChange(totalPages - 1);
  const goToPreviousPage = () => handlePageChange(page - 1);
  const goToNextPage = () => handlePageChange(page + 1);

  // Don't render footer if there's no data
  if (total === 0) {
    return null;
  }

  return (
    <div
      className={cn("flex items-center justify-between px-2 py-3", className)}
    >
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        {/* Selection info */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-1">
            <span className="font-medium">{selectedCount}</span>
            <span>row{selectedCount === 1 ? "" : "s"} selected</span>
          </div>
        )}

        {/* Row count info */}
        <div className="flex items-center gap-1">
          {total > 0 ? (
            <>
              <span>Showing</span>
              <span className="font-medium">{startItem}</span>
              <span>to</span>
              <span className="font-medium">{endItem}</span>
              <span>of</span>
              <span className="font-medium">{total}</span>
              <span>row{total === 1 ? "" : "s"}</span>
            </>
          ) : (
            <span>No rows</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Page size selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-16">
                {pageSize}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {pageSizeOptions.map((size) => (
                <DropdownMenuItem
                  key={size}
                  onClick={() => handlePageSizeChange(size)}
                  className={pageSize === size ? "bg-accent" : ""}
                >
                  {size}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Page info */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <span>Page</span>
          <span className="font-medium">{page + 1}</span>
          <span>of</span>
          <span className="font-medium">{totalPages}</span>
        </div>

        {/* Pagination controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={goToFirstPage}
            disabled={isFirstPage || totalPages <= 1}
            className="h-8 w-8 p-0"
          >
            <ChevronsLeft className="h-4 w-4" />
            <span className="sr-only">Go to first page</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousPage}
            disabled={isFirstPage || totalPages <= 1}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Go to previous page</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextPage}
            disabled={isLastPage || totalPages <= 1}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Go to next page</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToLastPage}
            disabled={isLastPage || totalPages <= 1}
            className="h-8 w-8 p-0"
          >
            <ChevronsRight className="h-4 w-4" />
            <span className="sr-only">Go to last page</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
