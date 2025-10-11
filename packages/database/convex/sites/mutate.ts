import { v } from "convex/values";
import { mutation } from "../_generated/server.js";
import { isAuthenticated, isValidTenant } from "../helpers/validators.js";

export const updatePSAConfig = mutation({
  args: {
    id: v.id("sites"),
    config: v.optional(
      v.object({
        psaIntegrationId: v.id("integrations"),
        psaCompanyId: v.string(),
        psaParentCompanyId: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    const site = await ctx.db.get(args.id);
    if (!site) {
      throw new Error("Resource not found");
    }
    await isValidTenant(identity.tenantId, site.tenantId);

    await ctx.db.patch(args.id, {
      psaCompanyId: args.config?.psaCompanyId,
      psaIntegrationId: args.config?.psaIntegrationId,
      psaParentCompanyId: args.config?.psaParentCompanyId,
    });

    return true;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    psaIntegrationId: v.optional(v.id("integrations")),
    psaCompanyId: v.optional(v.string()),
    psaParentCompanyId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);

    const site = await ctx.db.insert("sites", {
      ...args,
      tenantId: identity.tenantId,
      slug: generateSUUID(),
      status: "active",
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),
    });

    return ctx.db.get(site);
  },
});

const generateSUUID = (): string => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let suuid = "";
  for (let i = 0; i < 8; i++) {
    suuid += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return suuid;
};
