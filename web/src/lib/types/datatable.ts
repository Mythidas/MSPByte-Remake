import { PaginationOptions } from "@workspace/shared/types/database";

export type DataTableColumn<T> = {
  key: keyof T | (string & {});
  label: string;
  sortable?: boolean;
  searchable?: boolean;
  filterable?: boolean;
  width?: string;
  render?: (value: string, row: T) => React.ReactNode;
  exportTransform?: (value: string, row: T) => string;
  filterType?:
    | "text"
    | "select"
    | "date"
    | "number"
    | "boolean"
    | "multiselect";
  filterOptions?: Array<{ label: string; value: string }>;
};

export type DataTableFilter = {
  column: string;
  operator:
    | "eq"
    | "neq"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "like"
    | "ilike"
    | "in"
    | "is"
    | "jsonb_path";
  value: string;
  jsonbPath?: string;
};

export type DataTableSort = {
  column: string;
  direction: "asc" | "desc";
  jsonbPath?: string;
};

export type DataTablePagination = {
  page: number;
  pageSize: number;
  total: number;
};

export type DataTableView = {
  id: string;
  name: string;
  filters: DataTableFilter[];
  sorts?: DataTableSort[];
  columns?: string[]; // Specific columns to show
};

export type DataTableAction<T = string> = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  variant?: "default" | "destructive" | "outline";
  disabled?: (rows: T[]) => boolean;
  onClick: (rows: T[]) => Promise<void> | void;
};

export type DataTableFetchResult<T = string> = {
  data: T[];
  count: number;
  error?: string;
};

export type DataTableFetchParams = PaginationOptions;

export type DataTableProps<T = string> = {
  // Core props
  columns: DataTableColumn<T>[];
  fetcher: (params: DataTableFetchParams) => Promise<DataTableFetchResult<T>>;

  // Optional configuration
  initialFilters?: DataTableFilter[];
  initialSort?: DataTableSort[];
  initialPageSize?: number;
  views?: DataTableView[];
  actions?: DataTableAction<T>[];

  // URL state management
  useUrlState?: boolean;
  urlStateKey?: string;

  // Event listening
  eventChannel?: string; // Supabase realtime channel
  eventTable?: string;

  // Customization
  enableSearch?: boolean;
  searchPlaceholder?: string;
  searchableColumns?: (keyof T | (string & {}))[];
  enableSelection?: boolean;
  enableRefresh?: boolean;
  enableExport?: boolean;
  enableColumnToggle?: boolean;
  enableDensityToggle?: boolean;

  // Styling
  className?: string;
  emptyMessage?: string;
  loadingComponent?: React.ReactNode;
  bodyHeight?: string;

  // Callbacks
  onRowClick?: (row: T) => void;
  onSelectionChange?: (selectedRows: T[]) => void;
};
