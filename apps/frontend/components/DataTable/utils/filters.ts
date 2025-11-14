import { FilterOperator, TableFilter } from "../types";
import { getNestedValue } from "./nested";

/**
 * Serialize filters to URL-safe string
 * Format: field:operator:value;field:operator:value
 */
export function serializeFilters(filters: TableFilter[]): string {
    return filters
        .map((f) => {
            const field = encodeURIComponent(f.field);
            const operator = f.operator;
            const value = encodeURIComponent(JSON.stringify(f.value));
            return `${field}:${operator}:${value}`;
        })
        .join(";");
}

/**
 * Deserialize filters from URL string
 */
export function deserializeFilters(str: string): TableFilter[] {
    if (!str) return [];

    try {
        return str.split(";").map((part) => {
            const [field, operator, value] = part.split(":");
            return {
                field: decodeURIComponent(field),
                operator: operator as FilterOperator,
                value: JSON.parse(decodeURIComponent(value)),
            };
        });
    } catch (error) {
        console.error("Failed to deserialize filters:", error);
        return [];
    }
}

/**
 * Apply filters to data array (client-side filtering)
 */
export function applyFilters<T>(data: T[], filters: TableFilter[]): T[] {
    if (!filters || filters.length === 0) return data;

    return data.filter((row) => {
        return filters.every((filter) => {
            const value = getNestedValue(row, filter.field);
            return matchesOperator(value, filter.operator, filter.value);
        });
    });
}

/**
 * Check if a value matches a filter operator
 */
export function matchesOperator(value: any, operator: FilterOperator, filterValue: any): boolean {
    // Handle null/undefined
    if (value == null) {
        return operator === "ne" || operator === "nin";
    }

    switch (operator) {
        case "eq":
            // Convert both to strings for comparison to handle "313" === 313
            return String(value) === String(filterValue);

        case "ne":
            // Convert both to strings for comparison
            return String(value) !== String(filterValue);

        case "gt":
            return value > filterValue;

        case "gte":
            return value >= filterValue;

        case "lt":
            return value < filterValue;

        case "lte":
            return value <= filterValue;

        case "in":
            return Array.isArray(filterValue) && filterValue.includes(value);

        case "nin":
            return Array.isArray(filterValue) && !filterValue.includes(value);

        case "contains":
            return String(value).toLowerCase().includes(String(filterValue).toLowerCase());

        case "startsWith":
            return String(value).toLowerCase().startsWith(String(filterValue).toLowerCase());

        case "endsWith":
            return String(value).toLowerCase().endsWith(String(filterValue).toLowerCase());

        default:
            return false;
    }
}

/**
 * Get human-readable operator label
 */
export function getOperatorLabel(operator: FilterOperator): string {
    const labels: Record<FilterOperator, string> = {
        eq: "equals",
        ne: "not equals",
        gt: "greater than",
        gte: "greater than or equal",
        lt: "less than",
        lte: "less than or equal",
        in: "in",
        nin: "not in",
        contains: "contains",
        startsWith: "starts with",
        endsWith: "ends with",
    };
    return labels[operator];
}

/**
 * Format filter value for display
 */
export function formatFilterValue(value: any): string {
    if (Array.isArray(value)) {
        return value.join(", ");
    }
    if (typeof value === "boolean") {
        return value ? "Yes" : "No";
    }
    if (value instanceof Date) {
        return value.toLocaleDateString();
    }
    return String(value);
}
