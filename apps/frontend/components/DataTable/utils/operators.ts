import { FilterOperator } from "../types";

/**
 * Get available operators for each filter component type
 */
export const OPERATOR_MAP = {
    text: ["eq", "ne", "contains", "startsWith", "endsWith"] as FilterOperator[],
    select: ["eq", "ne", "in", "nin"] as FilterOperator[],
    number: ["eq", "ne", "gt", "gte", "lt", "lte"] as FilterOperator[],
    boolean: ["eq"] as FilterOperator[],
    date: ["eq", "ne", "gt", "gte", "lt", "lte"] as FilterOperator[],
};

/**
 * Get default operator for a component type
 */
export function getDefaultOperator(component: keyof typeof OPERATOR_MAP): FilterOperator {
    const defaults: Record<string, FilterOperator> = {
        text: "contains",
        select: "eq",
        number: "eq",
        boolean: "eq",
        date: "eq",
    };
    return defaults[component];
}
