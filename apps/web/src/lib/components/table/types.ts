import type { Snippet } from 'svelte';
import z from 'zod';

export type DataTableCell<T> = {
    row: T;
    column: DataTableColumn<T>;
};

/**
 * Filter component types
 */
export type FilterComponentType = 'text' | 'search' | 'select' | 'date' | 'number' | 'boolean';

/**
 * Filter configuration for a column
 */
export type ColumnFilterConfig = {
    label?: string;
    component: FilterComponentType;
    operators: FilterOperator[];
    defaultOperator?: FilterOperator;
    options?: { label: string; value: any }[]; // for select component
    multiple?: boolean; // for select with 'in' operator
    placeholder?: string;
};

/**
 * Standalone filter field definition (decoupled from columns)
 * Allows filtering on fields that aren't displayed as columns,
 * or multiple filters per column
 *
 * @example
 * const filterFields: FilterField[] = [
 *   {
 *     key: 'rawData.packages.protection.status',
 *     label: 'Upgradeable',
 *     config: {
 *       component: 'select',
 *       operators: ['eq'],
 *       options: [
 *         { label: 'Upgradeable', value: 'upgradable' },
 *         { label: 'Up to date', value: 'upToDate' }
 *       ]
 *     }
 *   }
 * ];
 */
export type FilterField = {
    key: string; // Field path (supports dot notation)
    label: string; // Display name in filter builder
    config: ColumnFilterConfig; // Filter component configuration
};

export type DataTableColumn<T> = {
    key: string;
    title: string;
    type?: 'string' | 'number' | 'boolean' | 'date';

    render?: (cell: DataTableCell<T>) => string;
    cell?: Snippet<[DataTableCell<T>]>;

    sort?: (rowA: T, rowB: T, dir: 'asc' | 'desc') => number;

    sortable?: boolean;
    hideable?: boolean;
    searchable?: boolean;
    filterable?: boolean; // Legacy: if true, shows in generic filter builder
    width?: string;

    // New composable filter system
    filter?: ColumnFilterConfig;
};

export type DataTableFilter = Record<string, any>;

export type SortDirection = 'asc' | 'desc';

export type DataTableSort = {
    column: string;
    direction: SortDirection;
};

// ============================================================================
// FILTER SYSTEM TYPES
// ============================================================================

/**
 * Filter operators matching dynamicCrud operators
 */
export type FilterOperator =
    | 'eq' // equals
    | 'ne' // not equals
    | 'gt' // greater than
    | 'gte' // greater than or equal
    | 'lt' // less than
    | 'lte' // less than or equal
    | 'in' // in array
    | 'nin' // not in array
    | 'contains' // string contains
    | 'startsWith' // string starts with
    | 'endsWith'; // string ends with

/**
 * Single filter condition
 */
export type TableFilter = {
    field: string;
    operator: FilterOperator;
    value: any;
};

/**
 * Complex filter with logical operators
 */
export type TableFilterGroup = {
    and?: TableFilter[];
    or?: TableFilter[];
    not?: TableFilter;
};

// ============================================================================
// VIEWS SYSTEM TYPES
// ============================================================================

/**
 * Predefined view with filters
 */
export type TableView = {
    name: string;
    label: string;
    description?: string;
    icon?: any;
    filters: TableFilter[];
};

// ============================================================================
// URL STATE SCHEMA
// ============================================================================

export const DataTableURLStateSchema = z.object({
    page: z.string().default('1'),
    size: z.string().default('50'),

    globalSearch: z.string().default(''),
    sort: z.string().default(''),

    // Filters as JSON string array
    filters: z.string().default(''),

    // Active view name
    view: z.string().default('')
});

export type DataTableURLState = z.infer<typeof DataTableURLStateSchema>;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get available operators for a field type
 */
export function getOperatorsForType(type?: string): FilterOperator[] {
    switch (type) {
        case 'string':
            return ['eq', 'ne', 'contains', 'startsWith', 'endsWith', 'in', 'nin'];
        case 'number':
            return ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin'];
        case 'boolean':
            return ['eq', 'ne'];
        case 'date':
            return ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'];
        default:
            return ['eq', 'ne', 'contains', 'in', 'nin'];
    }
}

/**
 * Get operator display label
 */
export function getOperatorLabel(operator: FilterOperator): string {
    const labels: Record<FilterOperator, string> = {
        eq: 'equals',
        ne: 'not equals',
        gt: 'greater than',
        gte: 'greater than or equal',
        lt: 'less than',
        lte: 'less than or equal',
        in: 'is one of',
        nin: 'is not one of',
        contains: 'contains',
        startsWith: 'starts with',
        endsWith: 'ends with'
    };
    return labels[operator];
}

/**
 * Convert table filters to dynamicCrud filter format
 */
export function convertToDynamicCrudFilters(filters: TableFilter[]): any {
    if (filters.length === 0) return undefined;

    // Convert each filter to dynamicCrud format
    const converted: any = {};

    for (const filter of filters) {
        const { field, operator, value } = filter;

        // Simple equality
        if (operator === 'eq') {
            converted[field] = value;
        }
        // Operators require object syntax
        else {
            if (!converted[field]) {
                converted[field] = {};
            }
            converted[field][operator] = value;
        }
    }

    return converted;
}

/**
 * Serialize a single value for URL
 */
function serializeValue(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return value.join(',');
    return String(value);
}

/**
 * Deserialize a single value from URL using column type information
 */
function deserializeValue(
    valueStr: string,
    operator: FilterOperator,
    fieldName: string,
    columns?: DataTableColumn<any>[]
): any {
    if (valueStr === 'null') return null;
    if (valueStr === 'undefined') return undefined;

    // Handle array operators
    if (operator === 'in' || operator === 'nin') {
        return valueStr.split(',').map((v) => v.trim());
    }

    // Look up column type if columns provided
    const column = columns?.find((col) => col.key === fieldName);
    const columnType = column?.type;

    // Parse based on column type
    if (columnType === 'number') {
        const num = Number(valueStr);
        return isNaN(num) ? valueStr : num;
    }

    if (columnType === 'boolean') {
        if (valueStr === 'true') return true;
        if (valueStr === 'false') return false;
        return valueStr;
    }

    if (columnType === 'date') {
        // Dates are stored as timestamps (numbers)
        const num = Number(valueStr);
        return isNaN(num) ? valueStr : num;
    }

    // For string type or no type info, keep as string
    if (columnType === 'string' || !columnType) {
        return valueStr;
    }

    // Fallback: try smart parsing if no column type (backwards compat)
    const num = Number(valueStr);
    if (!isNaN(num) && valueStr !== '') {
        return num;
    }

    if (valueStr === 'true') return true;
    if (valueStr === 'false') return false;

    return valueStr;
}

/**
 * Serialize filters for URL (human-readable format: field:operator:value)
 * Multiple filters separated by semicolons
 * Examples: status:eq:active;name:contains:test
 */
export function serializeFilters(filters: TableFilter[]): string {
    if (filters.length === 0) return '';

    return filters
        .map((filter) => {
            const value = serializeValue(filter.value);
            // URL encode each part to handle special characters
            const field = encodeURIComponent(filter.field);
            const operator = encodeURIComponent(filter.operator);
            const encodedValue = encodeURIComponent(value);
            return `${field}:${operator}:${encodedValue}`;
        })
        .join(';');
}

/**
 * Deserialize filters from URL
 */
export function deserializeFilters(
    filtersString: string,
    columns?: DataTableColumn<any>[]
): TableFilter[] {
    if (!filtersString || filtersString === '' || filtersString === '[]') return [];

    try {
        // New readable format: field:operator:value;field:operator:value
        const filterParts = filtersString.split(';');
        const filters: TableFilter[] = [];

        for (const part of filterParts) {
            const [encodedField, encodedOperator, ...encodedValueParts] = part.split(':');
            if (!encodedField || !encodedOperator || encodedValueParts.length === 0) continue;

            const field = decodeURIComponent(encodedField);
            const operator = decodeURIComponent(encodedOperator) as FilterOperator;
            const valueStr = decodeURIComponent(encodedValueParts.join(':'));

            filters.push({
                field,
                operator,
                value: deserializeValue(valueStr, operator, field, columns)
            });
        }

        return filters;
    } catch {
        // Fallback to base64/JSON format for backwards compatibility
        try {
            const json = atob(filtersString);
            const parsed = JSON.parse(json);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            try {
                const parsed = JSON.parse(filtersString);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        }
    }
}
