import { DataTableFilters } from "@/components/DataTable/DataTableFilters";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { DataTableView, DataTableFilter } from "@/lib/types/datatable";
import { RefreshCw, Download, Eye } from "lucide-react";

export default function DataTableToolbar<T extends Record<string, any>>({
  views,
  activeView,
  applyView,
  columns,
  addFilter,
  enableRefresh,
  loading,
  handleRefresh,
  enableSelection,
  selectedRows,
  actions,
  enableExport,
  exportData,
  enableColumnToggle,
  visibleColumns,
  setVisibleColumns,
}: {
  views: DataTableView[];
  activeView: string | null;
  applyView: (view: DataTableView) => void;
  columns: any[];
  addFilter: (filter: DataTableFilter) => void;
  enableRefresh: boolean;
  loading: boolean;
  handleRefresh: () => void;
  enableSelection: boolean;
  selectedRows: T[];
  actions: any[];
  enableExport: boolean;
  exportData: (format: "csv" | "tsv") => void;
  enableColumnToggle: boolean;
  visibleColumns: Set<string>;
  setVisibleColumns: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {views.length > 0 && (
          <Select
            value={activeView || ""}
            onValueChange={(value) => {
              const view = views.find((v) => v.id === value);
              if (view) applyView(view);
            }}
          >
            <SelectTrigger className="w-60">
              <SelectValue placeholder="Select view" />
            </SelectTrigger>
            <SelectContent>
              {views.map((view) => (
                <SelectItem key={view.id} value={view.id}>
                  {view.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <DataTableFilters columns={columns} onAddFilter={addFilter} />

        {enableRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {enableSelection && selectedRows.length > 0 && actions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Actions ({selectedRows.length})
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {actions.map((action) => (
                <DropdownMenuItem
                  key={action.id}
                  onClick={() => action.onClick(selectedRows)}
                  disabled={action.disabled?.(selectedRows)}
                >
                  {action.icon && <span className="mr-2">{action.icon}</span>}
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {enableExport && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => exportData("csv")}>
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportData("tsv")}>
                Export TSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {enableColumnToggle && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={visibleColumns.has(column.key)}
                  onCheckedChange={(checked) => {
                    setVisibleColumns((prev) => {
                      const newVisible = new Set(prev);
                      if (checked) {
                        newVisible.add(column.key);
                      } else {
                        newVisible.delete(column.key);
                      }
                      return newVisible;
                    });
                  }}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
