# Frontend Library

## API Re-export (`api.ts`)

This file provides a client-safe re-export of the Convex API.

### Why is this needed?

When importing from `@workspace/database/convex/_generated/api`, Next.js tries to resolve the TypeScript definition file (`api.d.ts`), which contains imports to server-only modules. This causes build errors:

```
Module not found: Can't resolve './vector_search.js'
```

### Solution

We import from the JavaScript file (`api.js`) instead, which uses the generic `anyApi` export that works on both client and server. TypeScript still provides full type inference.

### Usage

Always import the Convex API from this file in client components:

```typescript
// ✅ Correct
import { api } from "@/lib/api";

// ❌ Wrong - causes build errors
import { api } from "@workspace/database/convex/_generated/api";
```

This pattern is also used in the SvelteKit app at `apps/web/src/lib/convex/index.ts`.
