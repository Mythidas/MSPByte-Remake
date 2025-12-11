import { v } from "convex/values";
import { mutation } from "../_generated/server.js";
import { isValidSecret } from "../helpers/validators.js";

/**
 * Logs a successful ticket creation for billing purposes
 * Validates API secret before executing
 */
export const logTicketUsage = mutation({
  args: {
    secret: v.string(),
    tenantId: v.id("tenants"),
    siteId: v.id("sites"),
    agentId: v.id("agents"),
    ticketId: v.string(),
    ticketSummary: v.string(),
    psaType: v.string(),
    endpoint: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, { secret, ...args }) => {
    await isValidSecret(secret);

    const now = Date.now();
    const date = new Date(now);

    // Format billing period as YYYY-MM
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const billingPeriod = `${year}-${month}`;

    await ctx.db.insert("ticket_usage", {
      ...args,
      billingPeriod,
      createdAt: now,
    });

    return { success: true, billingPeriod };
  },
});
