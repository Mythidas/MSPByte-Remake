import { v } from "convex/values";
import { Id } from "../_generated/dataModel.js";
import { mutation, MutationCtx } from "../_generated/server.js";
import { isAuthenticated } from "../helpers/validators.js";

/**
 * Suppress an alert with a reason and optional expiration
 *
 * @param alertId - ID of the alert to suppress
 * @param reason - Reason for suppressing the alert
 * @param suppressedUntil - Optional timestamp when suppression expires
 * @returns Updated alert document
 */
export const suppressAlert = mutation({
  args: {
    alertId: v.id("entity_alerts"),
    reason: v.string(),
    suppressedUntil: v.optional(v.number()),
  },
  handler: async (ctx: MutationCtx, args) => {
    const identity = await isAuthenticated(ctx);

    // Get current alert state
    const alert = await ctx.db.get(args.alertId);
    if (!alert) {
      throw new Error("Alert not found");
    }

    // Verify tenant access
    if (alert.tenantId !== identity.tenantId) {
      throw new Error("Unauthorized: Alert belongs to a different tenant");
    }

    // Only allow suppression of active alerts
    if (alert.status !== "active") {
      throw new Error(`Cannot suppress alert with status: ${alert.status}`);
    }

    const now = Date.now();

    // Update alert status to suppressed
    await ctx.db.patch(args.alertId, {
      status: "suppressed",
      suppressedBy: identity._id,
      suppressedAt: now,
      suppressionReason: args.reason,
      suppressedUntil: args.suppressedUntil,
      updatedAt: now,
    });

    // Create audit log entry
    await ctx.db.insert("audit_log", {
      tenantId: identity.tenantId,
      userId: identity._id,
      tableName: "entity_alerts",
      recordId: args.alertId,
      action: "update",
      changes: {
        before: {
          status: "active",
        },
        after: {
          status: "suppressed",
          suppressedBy: identity._id,
          suppressedAt: now,
          suppressionReason: args.reason,
          suppressedUntil: args.suppressedUntil,
        },
        reason: args.reason,
      },
    });

    // Return updated alert
    const updatedAlert = await ctx.db.get(args.alertId);
    return updatedAlert;
  },
});

/**
 * Unsuppress an alert (reactivate it)
 *
 * @param alertId - ID of the alert to unsuppress
 * @returns Updated alert document
 */
export const unsuppressAlert = mutation({
  args: {
    alertId: v.id("entity_alerts"),
  },
  handler: async (ctx: MutationCtx, args) => {
    const identity = await isAuthenticated(ctx);

    // Get current alert state
    const alert = await ctx.db.get(args.alertId);
    if (!alert) {
      throw new Error("Alert not found");
    }

    // Verify tenant access
    if (alert.tenantId !== identity.tenantId) {
      throw new Error("Unauthorized: Alert belongs to a different tenant");
    }

    // Only allow unsuppression of suppressed alerts
    if (alert.status !== "suppressed") {
      throw new Error(`Cannot unsuppress alert with status: ${alert.status}`);
    }

    const now = Date.now();

    // Update alert status back to active
    await ctx.db.patch(args.alertId, {
      status: "active",
      suppressedBy: undefined,
      suppressedAt: undefined,
      suppressionReason: undefined,
      suppressedUntil: undefined,
      updatedAt: now,
    });

    // Create audit log entry
    await ctx.db.insert("audit_log", {
      tenantId: identity.tenantId,
      userId: identity._id,
      tableName: "entity_alerts",
      recordId: args.alertId,
      action: "update",
      changes: {
        before: {
          status: "suppressed",
          suppressedBy: alert.suppressedBy,
          suppressedAt: alert.suppressedAt,
          suppressionReason: alert.suppressionReason,
        },
        after: {
          status: "active",
        },
        reason: "Alert unsuppressed",
      },
    });

    // Return updated alert
    const updatedAlert = await ctx.db.get(args.alertId);
    return updatedAlert;
  },
});
