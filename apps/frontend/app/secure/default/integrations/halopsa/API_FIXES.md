# API Usage Fixes

## Changes Made

Fixed all API calls in the HaloPSA integration pages to use the correct `api.helpers.orm` patterns.

### Understanding the ORM API

The ORM helpers support two main query patterns:

#### 1. `api.helpers.orm.get` - Get a single record
```typescript
// By ID
const record = useQuery(api.helpers.orm.get, {
    tableName: 'sites',
    id: siteId
});

// By index + filters
const record = useQuery(api.helpers.orm.get, {
    tableName: 'data_sources',
    index: {
        name: 'by_integration',
        params: {
            integrationId: integration._id
        }
    },
    filters: {
        isPrimary: true
    }
});
```
**Returns**: Single record or `null`

#### 2. `api.helpers.orm.list` - Get multiple records
```typescript
// With index
const records = useQuery(api.helpers.orm.list, {
    tableName: 'entities',
    index: {
        name: 'by_data_source',
        params: {
            dataSourceId: dataSource._id
        }
    },
    filters: {
        entityType: 'companies'
    }
});

// Without index (uses by_tenant)
const records = useQuery(api.helpers.orm.list, {
    tableName: 'sites'
});
```
**Returns**: Array of records

### Files Fixed

1. **page.tsx** (Overview)
   - ✅ Changed integration query from `query_s.getBySlug` to `query.getBySlug` (client-side)
   - ✅ Fixed data source query to use `get` with index
   - ✅ Fixed scheduled jobs query to use `list` with index
   - ✅ Fixed companies query to use `list` with index and filters
   - ✅ Fixed failed jobs query to use proper index structure
   - ✅ Changed `dataSource?.[0]` to `dataSource` (get returns single record, not array)

2. **setup/page.tsx** (Setup)
   - ✅ Changed integration query from `query_s.getBySlug` to `query.getBySlug`
   - ✅ Fixed data source query to use `get` with index
   - ✅ Changed `dataSource?.[0]` to `dataSource`

3. **sync/page.tsx** (Sync Management)
   - ✅ Changed integration query from `query_s.getBySlug` to `query.getBySlug`
   - ✅ Fixed data source query to use `get` with index
   - ✅ Fixed all jobs query to use `list` with proper index
   - ✅ Changed `dataSource?.[0]` to `dataSource`
   - ✅ Fixed empty check from `!dataSource || dataSource.length === 0` to `!dataSource`

4. **companies/page.tsx** (Company Mapping)
   - ✅ Changed integration query from `query_s.getBySlug` to `query.getBySlug`
   - ✅ Fixed data source query to use `get` with index
   - ✅ Fixed companies query to use `list` with index and filters
   - ✅ Fixed sites query (removed unnecessary orderBy)
   - ✅ Changed `dataSource?.[0]` to `dataSource`

### Key Patterns

**Getting Primary Data Source:**
```typescript
const dataSource = useQuery(
    api.helpers.orm.get,
    integration ? {
        tableName: 'data_sources',
        index: {
            name: 'by_integration',
            params: {
                integrationId: integration._id
            }
        },
        filters: {
            isPrimary: true
        }
    } : 'skip'
);
```

**Getting Related Entities:**
```typescript
const companies = useQuery(
    api.helpers.orm.list,
    dataSource ? {
        tableName: 'entities',
        index: {
            name: 'by_data_source',
            params: {
                dataSourceId: dataSource._id
            }
        },
        filters: {
            entityType: 'companies'
        }
    } : 'skip'
);
```

**Getting Jobs:**
```typescript
const jobs = useQuery(
    api.helpers.orm.list,
    dataSource ? {
        tableName: 'scheduled_jobs',
        index: {
            name: 'by_data_source',
            params: {
                dataSourceId: dataSource._id
            }
        },
        filters: {
            status: 'failed'  // optional
        }
    } : 'skip'
);
```

### Integration Provider Pattern

The integration is fetched **once** server-side in `layout.tsx` using `api.integrations.query_s.getBySlug` with a secret, then passed down to all child pages via React Context.

**Architecture:**
1. **layout.tsx** (Server Component) - Fetches integration server-side
2. **IntegrationProvider** (Client Component) - Wraps children with context
3. **Page Components** - Use `useIntegration()` hook to access integration

**Benefits:**
- Single fetch at layout level (no redundant queries)
- Integration always available in pages (no null checks needed)
- Cleaner code (no conditional queries based on integration existence)

**Usage:**
```typescript
// In any page component
import { useIntegration } from "./integration-provider";

export default function MyPage() {
    const integration = useIntegration(); // Always defined

    // Use integration directly in queries
    const dataSource = useQuery(api.helpers.orm.get, {
        tableName: 'data_sources',
        index: {
            name: 'by_integration',
            params: { integrationId: integration._id }
        },
        filters: { isPrimary: true }
    });
    // ...
}
```
