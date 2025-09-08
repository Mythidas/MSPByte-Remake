export interface DataTableColumn<T> {
  key: keyof T | (string & {});
  label: string;
  sortable?: boolean;
  searchable?: boolean;
  filterable?: boolean;
  width?: string;
  render?: (value: string, row: T) => React.ReactNode;
  exportTransform?: (value: string, row: T) => string;
  jsonbPath?: string; // For JSONB column mapping
  filterType?:
    | "text"
    | "select"
    | "date"
    | "number"
    | "boolean"
    | "multiselect";
  filterOptions?: Array<{ label: string; value: string }>;
}

export interface DataTableFilter {
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
}

export interface DataTableSort {
  column: string;
  direction: "asc" | "desc";
  jsonbPath?: string;
}

export interface DataTablePagination {
  page: number;
  pageSize: number;
  total: number;
}

export interface DataTableView {
  id: string;
  name: string;
  filters: DataTableFilter[];
  sorts?: DataTableSort[];
  columns?: string[]; // Specific columns to show
}

export interface DataTableAction<T = string> {
  id: string;
  label: string;
  icon?: React.ReactNode;
  variant?: "default" | "destructive" | "outline";
  disabled?: (rows: T[]) => boolean;
  onClick: (rows: T[]) => Promise<void> | void;
}

export interface DataTableFetchResult<T = string> {
  data: T[];
  count: number;
  error?: string;
}

export interface DataTableFetchParams {
  page: number;
  pageSize: number;
  filters: DataTableFilter[];
  sorts: DataTableSort[];
}

export interface DataTableProps<T = string> {
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

  // Callbacks
  onRowClick?: (row: T) => void;
  onSelectionChange?: (selectedRows: T[]) => void;
}
