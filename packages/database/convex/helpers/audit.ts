import { v } from "convex/values";
import { mutation, MutationCtx } from "../_generated/server.js";
import { isAuthenticated, isValidSecret } from "./validators.js";

/**
 * Create an audit log entry
 *
 * @param tableName - Table name where the change occurred
 * @param recordId - ID of the record that was changed
 * @param action - Type of action (create, update, delete)
 * @param changes - JSON object describing the changes made
 * @returns ID of the created audit log entry
 */
export const createAuditLog = mutation({
  args: {
    tableName: v.string(),
    recordId: v.string(),
    action: v.union(
      v.literal("create"),
      v.literal("update"),
      v.literal("delete"),
    ),
    changes: v.any(),
  },
  handler: async (ctx: MutationCtx, args) => {
    const identity = await isAuthenticated(ctx);

    const auditLogId = await ctx.db.insert("audit_log", {
      tenantId: identity.tenantId,
      userId: identity._id,
      tableName: args.tableName,
      recordId: args.recordId,
      action: args.action,
      changes: args.changes,
    });

    return auditLogId;
  },
});

/**
 * Create an audit log entry (server-side with secret)
 */
export const createAuditLog_s = mutation({
  args: {
    tableName: v.string(),
    recordId: v.string(),
    action: v.union(
      v.literal("create"),
      v.literal("update"),
      v.literal("delete"),
    ),
    changes: v.any(),
    tenantId: v.id("tenants"),
    userId: v.optional(v.id("users")),
    secret: v.string(),
  },
  handler: async (ctx: MutationCtx, args) => {
    await isValidSecret(args.secret);

    const auditLogId = await ctx.db.insert("audit_log", {
      tenantId: args.tenantId,
      userId: args.userId,
      tableName: args.tableName,
      recordId: args.recordId,
      action: args.action,
      changes: args.changes,
    });

    return auditLogId;
  },
});
