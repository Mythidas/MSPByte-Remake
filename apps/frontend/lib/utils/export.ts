import { DataTableColumn } from "@/components/DataTable";

/**
 * Export utilities for DataTable
 * Supports CSV and JSON export formats
 */

/**
 * Convert data to CSV format
 * @param data Array of objects to export
 * @param columns Column definitions to determine which fields to export
 * @returns CSV string
 */
export function convertToCSV<T>(
  data: T[],
  columns: DataTableColumn<T>[],
): string {
  if (!data.length) return "";

  // Get column keys and headers
  const exportColumns = columns.filter((col) => col.key); // Only export columns with keys
  const headers = exportColumns.map((col) => col.title || col.key);

  // Build CSV rows
  const csvRows: string[] = [];

  // Add header row
  csvRows.push(headers.map((h) => escapeCSVValue(h)).join(","));

  // Add data rows
  data.forEach((row) => {
    const values = exportColumns.map((col) => {
      const rawValue = getNestedValue(row, col.key!);
      let value: any;

      // If column has an exportValue function, use it
      if (col.exportValue) {
        try {
          value = col.exportValue({ row, value: rawValue });
        } catch (error) {
          // If export function fails, fall back to raw value
          console.warn(`Failed to export value for column ${col.key}:`, error);
          value = rawValue;
        }
      } else {
        // No export function, use raw value
        value = rawValue;
      }

      return escapeCSVValue(formatValueForExport(value));
    });
    csvRows.push(values.join(","));
  });

  return csvRows.join("\n");
}

/**
 * Convert data to JSON format
 * @param data Array of objects to export
 * @param columns Column definitions to determine which fields to export
 * @returns JSON string (pretty-printed)
 */
export function convertToJSON<T>(
  data: T[],
  columns: DataTableColumn<T>[],
): string {
  if (!data.length) return "[]";

  // Get column keys
  const exportColumns = columns.filter((col) => col.key);

  // Build JSON objects with only the specified columns
  const jsonData = data.map((row) => {
    const obj: Record<string, any> = {};
    exportColumns.forEach((col) => {
      const key = col.key!;
      const fieldName = col.title || key.split(".").pop() || key;
      const rawValue = getNestedValue(row, key);
      let value: any;

      // If column has an exportValue function, use it
      if (col.exportValue) {
        try {
          value = col.exportValue({ row, value: rawValue });
        } catch (error) {
          // If export function fails, fall back to raw value
          console.warn(`Failed to export value for column ${col.key}:`, error);
          value = rawValue;
        }
      } else {
        // No export function, use raw value
        value = rawValue;
      }

      obj[fieldName] = value;
    });
    return obj;
  });

  return JSON.stringify(jsonData, null, 2);
}

/**
 * Export data to CSV file
 * @param data Array of objects to export
 * @param columns Column definitions
 * @param filename Name of the file (without extension)
 */
export function exportToCSV<T>(
  data: T[],
  columns: DataTableColumn<T>[],
  filename: string = "export",
) {
  const csv = convertToCSV(data, columns);
  downloadFile(csv, `${filename}.csv`, "text/csv");
}

/**
 * Export data to JSON file
 * @param data Array of objects to export
 * @param columns Column definitions
 * @param filename Name of the file (without extension)
 */
export function exportToJSON<T>(
  data: T[],
  columns: DataTableColumn<T>[],
  filename: string = "export",
) {
  const json = convertToJSON(data, columns);
  downloadFile(json, `${filename}.json`, "application/json");
}

/**
 * Trigger browser download of a file
 * @param content File content as string
 * @param filename Name of the file
 * @param mimeType MIME type of the file
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string,
) {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Get nested value from object using dot notation
 * @param obj Object to get value from
 * @param path Dot-notation path (e.g., "normalizedData.name")
 * @returns Value at path or empty string if not found
 */
function getNestedValue(obj: any, path: string): any {
  if (!path) return obj;

  const keys = path.split(".");
  let value = obj;

  for (const key of keys) {
    if (value === null || value === undefined) {
      return "";
    }
    value = value[key];
  }

  return value;
}

/**
 * Format value for export (handle arrays, objects, booleans, etc.)
 * @param value Value to format
 * @returns Formatted string value
 */
function formatValueForExport(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.join("; ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

/**
 * Escape value for CSV (handle quotes, commas, newlines)
 * @param value Value to escape
 * @returns Escaped value
 */
function escapeCSVValue(value: string): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Generate filename with timestamp
 * @param baseName Base name for the file
 * @param extension File extension (with dot)
 * @returns Filename with timestamp
 */
export function generateTimestampedFilename(
  baseName: string,
  extension: string,
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  return `${baseName}-${timestamp}${extension}`;
}
