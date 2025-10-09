# Supabase to Convex Migration Guide

This guide will help you complete the migration from Supabase to Convex. The foundation has been laid, and this document will show you how to migrate the remaining features.

## 📋 Migration Status

### ✅ Completed
- [x] **Authentication wrapper** - `useAuthQuery` and `useAuthMutation` in `convex/helper.ts`
- [x] **Schema definitions** - Core tables defined in `convex/schema.ts`
- [x] **Utility functions** - Pagination, filtering, sorting helpers in `convex/utils.ts`
- [x] **Sites queries** - Read-only operations in `convex/sites.ts`
- [x] **Convex client wrapper** - Easy-to-use helpers in `apps/web/src/lib/convex/client.ts`
- [x] **Example integration** - Sites page updated with Convex code (commented out)

### 🚧 TODO
- [ ] Sites mutations (create, update, delete)
- [ ] Users queries and mutations
- [ ] Integrations queries and mutations
- [ ] Data sources queries and mutations
- [ ] Agents queries and mutations
- [ ] Scheduled jobs queries and mutations
- [ ] Other tables as needed
- [ ] Data migration from Supabase to Convex
- [ ] Remove old Supabase code

---

## 🏗️ Architecture Overview

### File Structure
```
packages/database/convex/
├── schema.ts           # Table definitions with validation
├── helper.ts           # useAuthQuery & useAuthMutation wrappers
├── types.ts            # Shared TypeScript types
├── utils.ts            # Helper functions (pagination, filtering, etc.)
├── sites.ts            # Sites queries & mutations (EXAMPLE)
└── auth.config.ts      # Clerk authentication config

apps/web/src/lib/convex/
└── client.ts           # Convex client helpers for Svelte components
```

### Key Patterns

#### 1. **Authenticated Queries**
```typescript
// In: packages/database/convex/yourFeature.ts
import { v } from "convex/values";
import { useAuthQuery } from "./helper";

export const getItems = useAuthQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // ctx.identity is guaranteed to exist
    return await ctx.db.query("items").take(args.limit ?? 100);
  },
});
```

#### 2. **Authenticated Mutations**
```typescript
// In: packages/database/convex/yourFeature.ts
import { v } from "convex/values";
import { useAuthMutation } from "./helper";
import { now } from "./utils";

export const createItem = useAuthMutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("items", {
      name: args.name,
      createdAt: now(),
      updatedAt: now(),
    });
  },
});
```

#### 3. **Using in Svelte Components**
```typescript
<script lang="ts">
  import { convexApi, useConvexQuery, useConvexMutation } from '$lib/convex/client';

  // Query
  const items = useConvexQuery(convexApi.yourFeature.getItems, { limit: 10 });

  // Mutation
  const createItem = useConvexMutation(convexApi.yourFeature.createItem);

  async function handleCreate() {
    await createItem({ name: "New Item" });
  }
</script>

{#if items.isLoading}
  <p>Loading...</p>
{:else if items.data}
  {#each items.data as item}
    <p>{item.name}</p>
  {/each}
{/if}
```

---

## 🔄 Migration Steps

### Step 1: Add Table to Schema

If the table doesn't exist in `convex/schema.ts`, add it:

```typescript
// In: packages/database/convex/schema.ts
export default defineSchema({
  // ... existing tables

  yourTable: defineTable({
    name: v.string(),
    status: v.union(v.literal("active"), v.literal("inactive")),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_status", ["status"]),
});
```

### Step 2: Create Queries File

Create a new file like `convex/yourFeature.ts`:

```typescript
import { v } from "convex/values";
import { useAuthQuery, useAuthMutation } from "./helper";
import { now } from "./utils";

// ============================================================================
// READ OPERATIONS (Start here!)
// ============================================================================

export const getItems = useAuthQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.query("yourTable").take(args.limit ?? 100);
  },
});

export const getItemById = useAuthQuery({
  args: {
    id: v.id("yourTable"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// ============================================================================
// WRITE OPERATIONS (Add after queries work)
// ============================================================================

export const createItem = useAuthMutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("yourTable", {
      name: args.name,
      createdAt: now(),
      updatedAt: now(),
    });
  },
});

export const updateItem = useAuthMutation({
  args: {
    id: v.id("yourTable"),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: now(),
    });
  },
});
```

### Step 3: Update Components

In your Svelte component, import Convex and keep Supabase code commented:

```svelte
<script lang="ts">
  // NEW: Convex
  import { convexApi, useConvexQuery } from '$lib/convex/client';

  // OLD: Supabase (keep for now)
  import { createClient } from '$lib/database/client';
  import { ORM } from '$lib/database/orm';

  // TODO: Uncomment when ready to test
  /*
  const items = useConvexQuery(convexApi.yourFeature.getItems, { limit: 10 });
  */

  // OLD: Keep this until Convex is ready
  const orm = new ORM(createClient());
  // ... existing code
</script>
```

### Step 4: Test & Verify

1. **Run Convex dev server** (if not already running):
   ```bash
   npx convex dev
   ```

2. **Uncomment your Convex code** in the component

3. **Test the feature** thoroughly

4. **Remove Supabase code** once verified

---

## 📚 Common Patterns & Examples

### Pattern 1: Pagination

```typescript
export const getItemsPaginated = useAuthQuery({
  args: {
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<PaginatedResult<Doc<"items">>> => {
    const page = args.page ?? 0;
    const pageSize = args.pageSize ?? 100;
    const offset = page * pageSize;

    let query = ctx.db.query("items");

    // Apply search
    if (args.search) {
      query = query.filter((q) =>
        q.eq(q.field("name"), args.search)
      );
    }

    // Get results
    const allResults = await query.order("desc").collect();
    const total = allResults.length;
    const rows = allResults.slice(offset, offset + pageSize);

    return {
      rows,
      total,
      page,
      pageSize,
      hasMore: offset + pageSize < total,
    };
  },
});
```

### Pattern 2: Replacing Views

Supabase views → Convex queries with joins:

```typescript
// OLD: Supabase view "items_view" with joined data
// NEW: Convex query that fetches and joins

export const getItemsWithDetails = useAuthQuery({
  args: {},
  handler: async (ctx, args) => {
    const items = await ctx.db.query("items").collect();

    // Join related data
    return await Promise.all(
      items.map(async (item) => {
        const category = item.categoryId
          ? await ctx.db.get(item.categoryId)
          : null;

        return {
          ...item,
          categoryName: category?.name,
        };
      })
    );
  },
});
```

### Pattern 3: Filters

```typescript
export const getFilteredItems = useAuthQuery({
  args: {
    status: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("items");

    if (args.status) {
      query = query.filter((q) => q.eq(q.field("status"), args.status));
    }

    if (args.categoryId) {
      query = query.filter((q) => q.eq(q.field("categoryId"), args.categoryId));
    }

    return await query.collect();
  },
});
```

### Pattern 4: Soft Delete

```typescript
export const deleteItem = useAuthMutation({
  args: {
    id: v.id("items"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      deletedAt: now(),
      updatedAt: now(),
    });
  },
});
```

---

## 🔍 Supabase ORM → Convex Mapping

| Supabase ORM | Convex Equivalent |
|--------------|-------------------|
| `orm.getRow('table', { filters })` | `ctx.db.query("table").filter(...).first()` |
| `orm.getRows('table', { pagination })` | `ctx.db.query("table").take(limit)` |
| `orm.insertRows('table', { rows })` | `ctx.db.insert("table", data)` |
| `orm.updateRow('table', { id, row })` | `ctx.db.patch(id, data)` |
| `orm.deleteRows('table', { id })` | `ctx.db.patch(id, { deletedAt: now() })` |
| `orm.upsertRows('table', { rows })` | Check existence, then insert or patch |

---

## 🎯 Next Steps

1. **Complete Sites Mutations**
   - Uncomment the mutation stubs in `convex/sites.ts`
   - Test create, update, and delete operations

2. **Migrate Users Feature**
   - Create `convex/users.ts`
   - Follow the sites pattern
   - Update user-related components

3. **Migrate Integrations**
   - Create `convex/integrations.ts`
   - Handle complex queries with joins
   - Update integration pages

4. **Migrate Data Sources**
   - Create `convex/dataSources.ts`
   - Handle relationships
   - Update integration configuration

5. **Data Migration**
   - Export data from Supabase
   - Create migration scripts
   - Import into Convex

6. **Cleanup**
   - Remove all Supabase code
   - Remove Supabase dependencies
   - Update environment variables

---

## 💡 Tips

- **Start with read-only queries** - They're safer and easier to test
- **Keep Supabase code** until Convex is fully working
- **Test incrementally** - Don't migrate everything at once
- **Use the sites feature as a reference** - It's a complete example
- **Check indexes** - Add indexes for frequently queried fields
- **Watch for N+1 queries** - Use Promise.all for parallel fetches

---

## 🆘 Troubleshooting

### Error: "Unauthorized: User must be authenticated"
- Make sure you're logged in through Clerk
- Check that `convexClient.setAuth()` is called in `+layout.svelte`

### Query returns undefined
- Check that the query is using `useAuthQuery` correctly
- Verify the table name matches the schema
- Check the Convex dashboard for errors

### Type errors
- Make sure types are exported from `convex/types.ts`
- Check that `_generated/api.ts` is up to date
- Run `npx convex dev` to regenerate types

---

## 📖 Resources

- **[SCHEMA_REFERENCE.md](./SCHEMA_REFERENCE.md)** - Complete table reference with all fields and indexes
- [Convex Documentation](https://docs.convex.dev)
- [convex-svelte Documentation](https://github.com/get-convex/convex-svelte)
- [Clerk + Convex Integration](https://docs.convex.dev/auth/clerk)

---

**Happy migrating! 🚀**
