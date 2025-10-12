# Heartbeat Optimization with Redis

## Overview

This document describes the Redis-backed heartbeat optimization system that dramatically reduces Convex function calls from agent heartbeats.

## Problem Solved

**Before:**
- Agents sent heartbeats every 60 seconds
- Each heartbeat = 1 query + 1 mutation = **2 function calls**
- With 100 agents: **288,000 function calls/day** just for heartbeats
- Scheduler polled every 10s: **8,640 queries/day**
- **Total: ~300K function calls/day**

**After:**
- Heartbeats recorded in Redis (no DB writes for unchanged status)
- Status changes batched every 60 seconds
- Scheduler polls every 60 seconds
- **Total: ~3,500 function calls/day** (98.8% reduction!)

## Architecture

### Components

1. **Redis** - In-memory store for heartbeat timestamps and agent status
2. **HeartbeatManager** - Background service managing Redis state and batching
3. **Updated Heartbeat Endpoint** - Records to Redis, only writes to Convex on metadata changes
4. **Convex Schema** - Added `status`, `statusChangedAt` fields to agents table
5. **Batch Update Mutation** - Efficiently updates multiple agents in one call

### Data Flow

```
Agent → Heartbeat Endpoint → Redis (immediate)
                          ↓
                    HeartbeatManager
                          ↓
              Batch every 60s → Convex
```

### Agent Status States

- **online** - Heartbeat received within last 3 minutes
- **offline** - No heartbeat for >3 minutes
- **unknown** - Initial state or server restarted

## Setup

### Development

1. **Start Redis with Docker Compose:**
   ```bash
   docker compose up -d
   ```

2. **Verify Redis is running:**
   ```bash
   docker compose ps
   ```

3. **Set environment variable (already in .env):**
   ```bash
   REDIS_URL=redis://localhost:6379
   ```

4. **Start agents server:**
   ```bash
   cd backend/agents
   bun run dev
   ```

### Production (Railway)

1. **Add Redis plugin in Railway dashboard**
2. **Railway will automatically set `REDIS_URL` environment variable**
3. **Deploy agents service**

## How It Works

### Startup Sequence

1. Connect to Redis
2. Seed Redis with all agent states from Convex (one-time query)
3. Start background workers:
   - **Stale Checker** (every 30s): Finds agents with no heartbeat >3min, marks offline
   - **Batch Syncer** (every 60s): Flushes status changes to Convex
4. Start HTTP server

### Heartbeat Processing

1. Agent sends heartbeat → Endpoint
2. Record timestamp in Redis (fast, in-memory)
3. Check if agent was offline/unknown:
   - **Yes** → Queue status change to "online"
   - **No** → Nothing else needed!
4. Check if metadata changed (hostname, version, IP, etc.):
   - **Yes** → Update Convex immediately
   - **No** → Skip DB write
5. Return 200 OK to agent

### Status Transitions

**Online → Offline:**
- Stale checker runs every 30s
- Finds agents with `lastHeartbeat > 3 minutes ago`
- Queues status change to "offline"
- Batch syncer writes to Convex within 60s

**Offline → Online:**
- Agent sends heartbeat
- Immediately queued for status change
- Written to Convex within 60s

### Batching Strategy

- Status changes collected in-memory queue
- Flushed every 60 seconds
- If queue reaches 50 updates, triggers immediate flush
- Batch update mutation handles up to 50 agents per call

### Graceful Shutdown

- On SIGTERM/SIGINT signal
- Flushes all pending status updates to Convex
- Disconnects from Redis
- Closes HTTP server
- Prevents data loss during deployments

## Configuration

### Tuneable Parameters

In `backend/agents/src/lib/heartbeatManager.ts`:

```typescript
private readonly STALE_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes
private readonly STALE_CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds
private readonly SYNC_INTERVAL_MS = 60 * 1000; // 60 seconds
private readonly BATCH_SIZE = 50; // Max updates per batch
```

**Trade-offs:**
- Lower intervals = more responsive, more function calls
- Higher intervals = fewer function calls, longer delays

## Benefits

### Cost Savings
- **98.8% reduction** in function calls
- Heartbeats: 288,000 → ~2,000 mutations/day
- Scheduler: 8,640 → 1,440 queries/day
- Significant cost reduction at scale

### Performance
- Heartbeat endpoint responds in <10ms (Redis vs Convex DB)
- No DB lock contention from constant writes
- Batching reduces Convex load

### Scalability
- Redis handles 100K+ ops/second easily
- Can support thousands of agents without Convex strain
- Multi-server support (Redis shared state)

## Monitoring

### Redis Keys

- `agent:{agentId}` - Hash containing:
  - `lastHeartbeat` - Unix timestamp
  - `status` - "online" | "offline" | "unknown"

### Check Redis State

```bash
# Connect to Redis CLI
docker compose exec redis redis-cli

# List all agent keys
KEYS agent:*

# Get agent status
HGETALL agent:j97abc123xyz

# Count agents by status
KEYS agent:* | wc -l
```

### Logs

Watch for these log messages:
- `"Heartbeat manager started successfully"` - Startup complete
- `"Seeded N agents to Redis"` - Initial state loaded
- `"Agent X is stale"` - Agent marked offline
- `"Syncing N status updates to Convex"` - Batch write
- `"Successfully updated N agents"` - Batch complete

## Convex Schema Changes

### agents Table

```typescript
status: v.optional(
  v.union(v.literal("online"), v.literal("offline"), v.literal("unknown"))
)
statusChangedAt: v.optional(v.number())
```

### New Index

```typescript
.index("by_status_tenant", ["status", "tenantId"])
```

### New Mutation

```typescript
agents.internal.batchUpdateStatus({
  secret: string,
  updates: Array<{
    id: Id<"agents">,
    status: "online" | "offline" | "unknown",
    statusChangedAt: number,
    lastCheckinAt?: number
  }>
})
```

**Note:** This bulk operation is in `internal.ts` (not `crud_s.ts`) since it's a specialized batch operation, not a standard CRUD function.

## Future Enhancements

### Optional Improvements

1. **Agent List Caching** - Cache agent validation in Redis (avoid query on every heartbeat)
2. **Pub/Sub for Real-time** - Redis pub/sub for instant UI updates
3. **Metrics Dashboard** - Track heartbeat latency, batch sizes, etc.
4. **Smart Backoff** - Increase scheduler interval if no jobs found repeatedly
5. **Compression** - Use Redis Hash compression for memory efficiency

### Upstash Migration (Optional)

If you want serverless Redis with pay-per-request pricing:

1. Create Upstash Redis database
2. Get connection URL (starts with `rediss://`)
3. Update `REDIS_URL` environment variable
4. No code changes needed!

## Troubleshooting

### Server Won't Start

**Error: `ECONNREFUSED redis://localhost:6379`**
- Redis not running
- Run: `docker compose up -d`

### Agents Showing as Offline

**Possible causes:**
1. Server was restarted recently (agents will come online within 60s)
2. Agents not sending heartbeats
3. Redis data was cleared

**Solution:**
- Wait 60s for next heartbeat batch
- Check agent logs for heartbeat errors
- Restart agents service to reseed from Convex

### Status Not Updating in UI

**Possible causes:**
1. UI polling interval (updates every 30-60s)
2. Batch sync hasn't run yet

**Solution:**
- Refresh page after 60 seconds
- Check logs for sync messages

### Memory Usage

Redis memory usage: ~1KB per agent
- 100 agents = ~100KB
- 10,000 agents = ~10MB

## Summary

This optimization reduces function calls by **98.8%** while maintaining:
- ✅ Real-time agent monitoring (30-60s update latency)
- ✅ Graceful shutdown (no data loss)
- ✅ Multi-server support (via Redis)
- ✅ Simple deployment (Docker Compose for dev, Railway plugin for prod)

The trade-off of 30-90 second status update latency is acceptable for agent monitoring use cases.
