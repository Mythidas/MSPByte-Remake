import type { License } from "@workspace/database/convex/types/normalized.js";

/**
 * Keywords that identify free, trial, or bulk-allocation licenses
 * that should be excluded from utilization metrics
 */
const BLOAT_KEYWORDS = [
    'FREE',
    'TRIAL',
    'EXPLORATORY',
    'FABRIC',
    'DEVELOPER',
    'NONPROFIT',
    'STUDENT',
    'FACULTY',
    'GRACE',
    'VIRAL'
];

/**
 * Threshold for detecting bulk free licenses
 * Microsoft typically allocates 10,000+ units for free tier licenses
 */
const HIGH_VOLUME_THRESHOLD = 10000;

/**
 * Detects if a license is a "bloat" license that should be excluded from
 * utilization metrics. Bloat licenses include:
 * - Free licenses (e.g., "Microsoft Fabric (Free)")
 * - Trial licenses (e.g., "Power Apps Plan 2 Trial")
 * - Exploratory/developer licenses
 * - Licenses with unrealistically high allocations (10k+ units)
 *
 * @param license - The license to check
 * @returns true if the license is considered bloat
 *
 * @example
 * ```typescript
 * const license = {
 *   name: "Microsoft Fabric (Free)",
 *   totalUnits: 1000000
 * };
 * isBloatLicense(license); // true
 * ```
 */
export function isBloatLicense(license: Partial<License> | { name?: string; skuPartNumber?: string; totalUnits?: number }): boolean {
    const name = license.name?.toUpperCase() || '';
    const sku = license.skuPartNumber?.toUpperCase() || '';
    const units = license.totalUnits || 0;

    // Check for explicit bloat keywords in name or SKU
    const hasMarker = BLOAT_KEYWORDS.some(keyword =>
        name.includes(keyword) || sku.includes(keyword)
    );

    // Check for unrealistically high allocation (bulk free licenses)
    const isHighVolume = units >= HIGH_VOLUME_THRESHOLD;

    return hasMarker || isHighVolume;
}

/**
 * Checks if a license is overused (consumed more than available)
 *
 * @param license - The license to check
 * @returns true if consumedUnits > totalUnits
 */
export function isLicenseOverused(license: Partial<License>): boolean {
    const consumed = license.consumedUnits || 0;
    const total = license.totalUnits || 0;

    // Only consider overused if we have valid data
    if (total === 0) return false;

    return consumed > total;
}

/**
 * Calculates the overage amount for an overused license
 *
 * @param license - The license to check
 * @returns The number of licenses consumed beyond the total, or 0 if not overused
 */
export function getLicenseOverage(license: Partial<License>): number {
    if (!isLicenseOverused(license)) return 0;

    const consumed = license.consumedUnits || 0;
    const total = license.totalUnits || 0;

    return consumed - total;
}

/**
 * Calculates license utilization percentage
 *
 * @param license - The license to calculate utilization for
 * @returns Percentage (0-100+) of license utilization, or 0 if no total units
 */
export function getLicenseUtilization(license: Partial<License>): number {
    const consumed = license.consumedUnits || 0;
    const total = license.totalUnits || 0;

    if (total === 0) return 0;

    return Math.round((consumed / total) * 100);
}
