// Main component
export { DataTable } from "./DataTable";

// Types
export type {
  FilterOperator,
  TableFilter,
  FilterConfig,
  FilterField,
  DataTableColumn,
  TableView,
  RowAction,
  DataTableProps,
  URLState,
} from "./types";

// Hooks (for advanced usage)
export { useDataTable } from "./hooks/useDataTable";
export { useDataTableFilters } from "./hooks/useDataTableFilters";
export { useDataTableURL } from "./hooks/useDataTableURL";

// Sub-components (for custom toolbars)
export { DataTableToolbar } from "./DataTableToolbar";
export { DataTablePagination } from "./DataTablePagination";
export { DataTableFilterBuilder } from "./DataTableFilterBuilder";
export { DataTableFilterChips } from "./DataTableFilterChips";
export { DataTableViewSelector } from "./DataTableViewSelector";
export { DataTableColumnToggle } from "./DataTableColumnToggle";

// Utils
export { getNestedValue } from "./utils/nested";
export {
  serializeFilters,
  deserializeFilters,
  applyFilters,
  matchesOperator,
  getOperatorLabel,
} from "./utils/filters";
export { OPERATOR_MAP } from "./utils/operators";
