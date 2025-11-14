# DataTable Component

A comprehensive, reusable data table component built with TanStack Table and Shadcn UI. Inspired by the Svelte DataTable with full feature parity.

## Features

- **Client-side filtering and sorting** - Fast, responsive filtering with multiple operator types
- **URL state management** - Filters, pagination, search, and views persist in URL
- **Views system** - Predefined filter combinations for quick access
- **Composable filters** - Combine view filters with dynamic filters
- **Row selection** - Checkboxes with bulk actions
- **Global search** - Search across all searchable columns
- **Client-side pagination** - Configurable page sizes (25, 50, 100)
- **Column visibility toggle** - Show/hide columns as needed
- **Nested field support** - Access nested object properties with dot notation
- **Type-safe** - Full TypeScript support

## Quick Start

```tsx
import { DataTable, DataTableColumn, TableView } from "@/components/DataTable";

const columns: DataTableColumn<YourType>[] = [
  {
    key: "name",
    title: "Name",
    sortable: true,
    searchable: true,
    filter: {
      type: "text",
      operators: ["eq", "contains", "startsWith"],
      placeholder: "Search names...",
    },
  },
  {
    key: "status",
    title: "Status",
    filter: {
      type: "select",
      operators: ["eq", "in"],
      options: [
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
      ],
    },
  },
];

const views: TableView[] = [
  {
    id: "active",
    label: "Active Items",
    filters: [{ field: "status", operator: "eq", value: "active" }],
  },
];

export default function MyPage() {
  const data = useQuery(api.myTable.list);

  return (
    <DataTable
      data={data || []}
      columns={columns}
      views={views}
      enableRowSelection={true}
      enableGlobalSearch={true}
      enableFilters={true}
      enablePagination={true}
    />
  );
}
```

## Column Configuration

### Basic Column

```tsx
{
  key: "name",           // Field key (supports dot notation like "user.email")
  title: "Name",         // Display header
  sortable: true,        // Enable sorting
  searchable: true,      // Include in global search
}
```

### Custom Cell Rendering

```tsx
{
  key: "status",
  title: "Status",
  cell: ({ value, row }) => (
    <Badge variant={value === "active" ? "success" : "secondary"}>
      {value}
    </Badge>
  ),
}
```

### Filter Configuration

#### Text Filter
```tsx
filter: {
  type: "text",
  operators: ["eq", "ne", "contains", "startsWith", "endsWith"],
  placeholder: "Search...",
}
```

#### Select Filter
```tsx
filter: {
  type: "select",
  operators: ["eq", "ne", "in", "nin"],
  options: [
    { label: "Active", value: "active" },
    { label: "Inactive", value: "inactive" },
  ],
}
```

#### Number Filter
```tsx
filter: {
  type: "number",
  operators: ["eq", "ne", "gt", "gte", "lt", "lte"],
  placeholder: "Enter amount...",
}
```

#### Boolean Filter
```tsx
filter: {
  type: "boolean",
  operators: ["eq"],
}
```

#### Date Filter
```tsx
filter: {
  type: "date",
  operators: ["eq", "ne", "gt", "gte", "lt", "lte"],
}
```

## Views

Views are predefined filter combinations that users can quickly switch between:

```tsx
const views: TableView[] = [
  {
    id: "active",
    label: "Active Sites",
    filters: [
      { field: "status", operator: "eq", value: "active" },
    ],
  },
  {
    id: "recent",
    label: "Recently Updated",
    filters: [
      { field: "updatedAt", operator: "gte", value: Date.now() - 7 * 24 * 60 * 60 * 1000 },
    ],
  },
];
```

## Row Actions (Bulk Actions)

```tsx
const rowActions: RowAction<Site>[] = [
  {
    label: "Archive",
    icon: <Archive className="h-4 w-4" />,
    variant: "outline",
    onClick: (selectedRows) => {
      console.log("Archive:", selectedRows);
    },
  },
  {
    label: "Delete",
    icon: <Trash2 className="h-4 w-4" />,
    variant: "destructive",
    onClick: (selectedRows) => {
      // Handle deletion
    },
  },
];
```

## Advanced Usage

### Controlled Filters (for Convex Integration)

```tsx
const [filters, setFilters] = useState<TableFilter[]>([]);

// Pass filters to Convex query
const data = useQuery(api.myTable.list, { filters });

<DataTable
  data={data || []}
  columns={columns}
  controlledFilters={filters}
  onFiltersChange={setFilters}
/>
```

### Custom Row Click Handler

```tsx
<DataTable
  data={data}
  columns={columns}
  onRowClick={(row) => {
    router.push(`/detail/${row._id}`);
  }}
/>
```

### Disable Features

```tsx
<DataTable
  data={data}
  columns={columns}
  enableRowSelection={false}
  enableGlobalSearch={false}
  enableFilters={false}
  enablePagination={false}
  enableColumnToggle={false}
  enableURLState={false}
/>
```

## URL State Format

The table automatically syncs state to URL parameters:

- `page` - Current page number (1-indexed)
- `size` - Page size (25, 50, 100)
- `search` - Global search query
- `filters` - Serialized filters in format: `field:operator:JSON.stringify(value);...`
- `view` - Active view ID

Example URL:
```
/sites?page=2&size=50&search=acme&filters=status:eq:"active";name:contains:"test"&view=active
```

## Nested Field Access

Use dot notation to access nested object properties:

```tsx
{
  key: "user.email",
  title: "User Email",
  sortable: true,
}

// Accesses: row.user.email
```

## Filter Operators

- **Text**: `eq`, `ne`, `contains`, `startsWith`, `endsWith`
- **Select**: `eq`, `ne`, `in`, `nin`
- **Number**: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`
- **Boolean**: `eq`
- **Date**: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`

## Components

The DataTable is composed of several sub-components that can be used independently:

- `DataTable` - Main component
- `DataTableToolbar` - Search, filters, views, column toggle
- `DataTablePagination` - Pagination controls
- `DataTableFilterBuilder` - Dialog for adding filters
- `DataTableFilterChips` - Display active filters as removable chips
- `DataTableViewSelector` - View switcher (tabs or dropdown)
- `DataTableColumnToggle` - Column visibility toggle

## Hooks

For advanced customization, use the underlying hooks:

```tsx
import { useDataTable, useDataTableFilters, useDataTableURL } from "@/components/DataTable";

const { table, filters, addFilter, removeFilter } = useDataTable({
  data,
  columns,
  // ... options
});
```

## Example: Sites Page

See `/app/secure/sites/page.tsx` for a complete working example showing:
- Status badges with custom rendering
- Date formatting
- Multiple filter types
- Views for different site statuses
- Bulk actions (Archive, Delete, Export)
- Row click navigation

## Architecture

```
DataTable/
├── DataTable.tsx                 # Main component
├── DataTableToolbar.tsx          # Toolbar with search/filters/views
├── DataTablePagination.tsx       # Pagination controls
├── DataTableFilterBuilder.tsx    # Filter creation dialog
├── DataTableFilterChips.tsx      # Active filter chips
├── DataTableViewSelector.tsx     # View switcher
├── DataTableColumnToggle.tsx     # Column visibility
├── types.ts                      # TypeScript definitions
├── hooks/
│   ├── useDataTable.ts          # Main table hook
│   ├── useDataTableFilters.ts   # Filter management
│   └── useDataTableURL.ts       # URL state sync
├── filter-inputs/
│   ├── TextFilterInput.tsx
│   ├── SelectFilterInput.tsx
│   ├── NumberFilterInput.tsx
│   ├── BooleanFilterInput.tsx
│   └── DateFilterInput.tsx
└── utils/
    ├── nested.ts                # Nested field access
    ├── filters.ts               # Filter serialization/matching
    └── operators.ts             # Operator definitions
```
