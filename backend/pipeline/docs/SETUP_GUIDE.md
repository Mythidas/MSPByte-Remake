# MSPByte Pipeline Setup Guide

Complete step-by-step guide to set up and run the MSPByte Pipeline in production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Start Infrastructure](#start-infrastructure)
4. [Configure Database](#configure-database)
5. [Start Pipeline](#start-pipeline)
6. [Verify Health](#verify-health)
7. [Trigger Syncs](#trigger-syncs)
8. [Setup Monitoring](#setup-monitoring)
9. [Production Deployment](#production-deployment)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- **Node.js**: v20+ (for Bun compatibility)
- **Bun**: v1.0+ ([install](https://bun.sh))
- **Docker**: v20+ (for Redis and NATS)
- **Docker Compose**: v2.0+

### Recommended

- **Prometheus**: For metrics collection ([install](https://prometheus.io/download/))
- **Grafana**: For dashboards ([install](https://grafana.com/grafana/download))

### Accounts

- **Convex Account**: For database ([signup](https://convex.dev))
- **Microsoft 365**: If using M365 integration

---

## Environment Setup

### Step 1: Clone and Install

```bash
# Navigate to pipeline directory
cd backend/pipeline

# Install dependencies
bun install
```

### Step 2: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your values
nano .env
```

**Required Configuration**:

```env
# Convex (get from https://dashboard.convex.dev)
CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_API_KEY=your-api-key-here

# Infrastructure (defaults work for local development)
NATS_URL=nats://localhost:4222
REDIS_HOST=localhost
REDIS_PORT=6379

# HTTP Server
PORT=3001

# Queue (20 concurrent jobs recommended for production)
QUEUE_CONCURRENCY=20

# Feature Flags (all enabled for production)
FEATURE_NEW_PIPELINE=true
FEATURE_NEW_PIPELINE_ROLLOUT=100
FEATURE_UNIFIED_ANALYZER=true
FEATURE_ALERT_MANAGER=true
FEATURE_BATCH_LOADING=true
FEATURE_PERFORMANCE_MONITORING=true

# Performance Tuning
SLOW_QUERY_THRESHOLD_MS=100
```

---

## Start Infrastructure

### Using Docker Compose (Recommended)

```bash
# Start Redis + NATS (from backend directory)
cd backend
docker-compose up -d

# Verify services are running
docker-compose ps

# Expected output:
# NAME                COMMAND                  SERVICE   STATUS    PORTS
# mspbyte-nats        "nats-server ..."       nats      Up        0.0.0.0:4222->4222/tcp
# mspbyte-redis       "docker-entrypoint..."   redis     Up        0.0.0.0:6379->6379/tcp

# Check logs if issues
docker-compose logs -f
```

### Manual Start (Alternative)

**Redis**:
```bash
docker run -d \
  --name mspbyte-redis \
  -p 6379:6379 \
  -v redis-data:/data \
  redis:7-alpine \
  redis-server --save 60 1
```

**NATS**:
```bash
docker run -d \
  --name mspbyte-nats \
  -p 4222:4222 \
  -p 8222:8222 \
  -v nats-data:/data \
  nats:latest \
  --jetstream \
  --store_dir=/data \
  --http_port=8222
```

### Verify Infrastructure

```bash
# Check Redis
redis-cli ping
# Should return: PONG

# Check NATS
curl http://localhost:8222/healthz
# Should return: ok
```

---

## Configure Database

### Step 1: Setup Convex Project

1. **Create Account**: Go to [convex.dev](https://convex.dev) and sign up
2. **Create Project**: Click "New Project"
3. **Get Credentials**:
   - Navigate to Settings → API Keys
   - Copy `CONVEX_URL` and `CONVEX_API_KEY`
   - Paste into `.env` file

### Step 2: Deploy Schema

```bash
# Deploy database schema with composite indexes
cd packages/database
bunx convex deploy

# Verify indexes are created
bunx convex dev
# Then in Convex dashboard, check tables → entity_alerts and entity_relationships
# Should see Phase 6 composite indexes
```

### Step 3: Seed Initial Data (Optional)

If you need test data:

```bash
# Create test tenant
bunx convex run helpers:createTestTenant

# Create test integration (M365)
bunx convex run helpers:createTestIntegration

# Create test data source
bunx convex run helpers:createTestDataSource
```

---

## Start Pipeline

### Development Mode

```bash
cd backend/pipeline
bun run dev
```

### Production Mode

```bash
cd backend/pipeline
bun run start
```

### Expected Startup Output

```
[Main] Starting MSPByte Pipeline (Fresh Architecture)
[Main] NATS connected
[QueueManager] QueueManager initialized successfully
[Main] Microsoft365Adapter started
[Main] All processors started (8 processors)
[Main] Microsoft365Linker started
[Main] UnifiedAnalyzer initialized
[Main] AlertManager initialized
[HTTPServer] HTTP server listening on port 3001
  Endpoints:
    health: http://localhost:3001/health
    metrics: http://localhost:3001/metrics
    api: http://localhost:3001/api
[JobScheduler] Initializing job scheduler...
[JobScheduler] Loaded 1 active integrations
[JobScheduler] Loaded 2 active data sources
[JobScheduler] Job scheduler initialized: 10 repeatable jobs registered
[Main] Pipeline started successfully
  Phase: Phase 7 Complete - Production Ready
  Components: adapters=1, processors=8, linkers=1, analyzers=1, alertManagers=1, httpServer=1, jobScheduler=1
  Infrastructure: port=3001, queueConcurrency=20, scheduledJobs=10
```

---

## Verify Health

### Health Check

```bash
curl http://localhost:3001/health
```

**Expected Response**:
```json
{
  "status": "healthy",
  "timestamp": 1701234567890,
  "services": {
    "redis": "connected",
    "nats": "connected",
    "workers": {
      "active": 0,
      "waiting": 0,
      "concurrency": 20
    }
  }
}
```

### Metrics Check

```bash
curl http://localhost:3001/metrics
```

**Expected Response** (sample):
```
# HELP mspbyte_pipeline_executions_total Total number of pipeline executions
# TYPE mspbyte_pipeline_executions_total counter
mspbyte_pipeline_executions_total{status="success"} 0
mspbyte_pipeline_executions_total{status="error"} 0

# HELP mspbyte_feature_flags Feature flag status (1=enabled, 0=disabled)
# TYPE mspbyte_feature_flags gauge
mspbyte_feature_flags{flag="new_pipeline"} 1
mspbyte_feature_flags{flag="unified_analyzer"} 1
...
```

### Feature Flags Check

```bash
curl http://localhost:3001/api/feature-flags
```

**Expected Response**:
```json
{
  "tenantId": null,
  "flags": [
    {
      "name": "new_pipeline",
      "description": "Enable new pipeline architecture (Phases 1-7)",
      "globalEnabled": true,
      "rolloutPercentage": 100,
      "tenantOverrideCount": 0
    },
    ...
  ]
}
```

---

## Trigger Syncs

### Automatic Syncs (JobScheduler)

The JobScheduler automatically registers recurring jobs based on `integrations.supportedTypes.rateMinutes`.

**Example**:
- Integration: `microsoft-365`
- Entity Types: `identities`, `groups`, `roles`, `policies`, `licenses`
- Rate: 60 minutes (from DB)
- Cron Pattern: `0 * * * *` (hourly)

**Jobs auto-fire** without manual intervention!

### Manual Sync (API)

```bash
curl -X POST http://localhost:3001/api/jobs/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "action": "microsoft-365.sync.identities",
    "tenantId": "your_tenant_id",
    "dataSourceId": "your_datasource_id",
    "priority": 5
  }'
```

**Response**:
```json
{
  "jobId": "12345",
  "action": "microsoft-365.sync.identities",
  "tenantId": "your_tenant_id",
  "dataSourceId": "your_datasource_id",
  "scheduledAt": 1701234567890
}
```

### Check Job Status

```bash
curl http://localhost:3001/api/jobs/12345
```

**Response**:
```json
{
  "id": "12345",
  "name": "microsoft-365.sync.identities",
  "data": {
    "action": "microsoft-365.sync.identities",
    "tenantId": "your_tenant_id",
    "dataSourceId": "your_datasource_id"
  },
  "state": "completed",
  "progress": 100,
  "attemptsMade": 1,
  "timestamp": 1701234567890,
  "processedOn": 1701234567900,
  "finishedOn": 1701234597900
}
```

### List Jobs

```bash
# All jobs
curl http://localhost:3001/api/jobs

# Only waiting jobs
curl http://localhost:3001/api/jobs?status=waiting

# Only active jobs
curl http://localhost:3001/api/jobs?status=active&limit=100
```

---

## Setup Monitoring

### Prometheus

**Step 1: Install Prometheus**

```bash
# macOS
brew install prometheus

# Linux (Ubuntu/Debian)
sudo apt-get install prometheus

# Or download: https://prometheus.io/download/
```

**Step 2: Configure Prometheus**

```bash
# Use provided config
cp backend/pipeline/prometheus.yml /path/to/prometheus/

# Or edit existing prometheus.yml to add:
scrape_configs:
  - job_name: 'mspbyte-pipeline'
    scrape_interval: 15s
    metrics_path: '/metrics'
    static_configs:
      - targets: ['localhost:3001']
```

**Step 3: Start Prometheus**

```bash
prometheus --config.file=prometheus.yml

# Access UI: http://localhost:9090
```

**Step 4: Verify Scraping**

1. Go to http://localhost:9090/targets
2. Find `mspbyte-pipeline` target
3. Status should be **UP**

### Grafana (Optional)

**Step 1: Install Grafana**

```bash
# macOS
brew install grafana

# Linux
sudo apt-get install grafana

# Start service
brew services start grafana  # macOS
sudo systemctl start grafana-server  # Linux
```

**Step 2: Add Data Source**

1. Go to http://localhost:3000 (default credentials: admin/admin)
2. Configuration → Data Sources → Add data source
3. Select **Prometheus**
4. URL: `http://localhost:9090`
5. Save & Test

**Step 3: Create Dashboard**

Sample queries:

```promql
# Pipeline success rate
rate(mspbyte_pipeline_executions_total{status="success"}[5m]) / rate(mspbyte_pipeline_executions_total[5m])

# Average pipeline duration
mspbyte_pipeline_duration_ms

# Active workers
mspbyte_stage_executions_total{status="success"}

# Slow query rate
(mspbyte_slow_queries_total / mspbyte_queries_total) * 100
```

---

## Production Deployment

### Using PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start pipeline
cd backend/pipeline
pm2 start bun --name "mspbyte-pipeline" -- run start

# View logs
pm2 logs mspbyte-pipeline

# Monitor
pm2 monit

# Setup auto-restart on boot
pm2 startup
pm2 save
```

### Using Systemd

**Create service file**: `/etc/systemd/system/mspbyte-pipeline.service`

```ini
[Unit]
Description=MSPByte Pipeline
After=network.target docker.service

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/MSPByte-Remake/backend/pipeline
Environment="NODE_ENV=production"
ExecStart=/usr/local/bin/bun run start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**Enable and start**:

```bash
sudo systemctl daemon-reload
sudo systemctl enable mspbyte-pipeline
sudo systemctl start mspbyte-pipeline

# Check status
sudo systemctl status mspbyte-pipeline

# View logs
sudo journalctl -u mspbyte-pipeline -f
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM oven/bun:1

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./
RUN bun install

# Copy source
COPY . .

EXPOSE 3001

CMD ["bun", "run", "start"]
```

**Build and run**:

```bash
# Build image
docker build -t mspbyte-pipeline .

# Run container
docker run -d \
  --name mspbyte-pipeline \
  -p 3001:3001 \
  --env-file .env \
  --network mspbyte-network \
  mspbyte-pipeline
```

---

## Troubleshooting

### Pipeline Won't Start

**Error**: `NATS connection failed`

**Solution**:
```bash
# Check if NATS is running
docker ps | grep nats

# If not running, start it
docker-compose up -d nats

# Check NATS health
curl http://localhost:8222/healthz
```

**Error**: `Redis connection refused`

**Solution**:
```bash
# Check if Redis is running
docker ps | grep redis

# If not running, start it
docker-compose up -d redis

# Test Redis
redis-cli ping
```

**Error**: `Convex API key invalid`

**Solution**:
1. Go to Convex dashboard: https://dashboard.convex.dev
2. Settings → API Keys
3. Copy API key
4. Update `.env`: `CONVEX_API_KEY=your_key`
5. Restart pipeline

### No Jobs Running

**Issue**: JobScheduler shows 0 repeatable jobs

**Solution**:
```bash
# Check database for active integrations
# In Convex dashboard:
# 1. Go to Data → integrations table
# 2. Verify isActive = true
# 3. Verify supportedTypes has rateMinutes set

# Check active data sources
# Data → data_sources table
# 1. Verify status = "active"
# 2. Verify integrationId matches integration
```

**Issue**: Jobs scheduled but not executing

**Solution**:
```bash
# Check worker status
curl http://localhost:3001/health

# Should show workers > 0
# If workers = 0, check QUEUE_CONCURRENCY in .env

# Check Redis
redis-cli

# In Redis CLI:
KEYS *
# Should see BullMQ keys like "bull:pipeline-jobs:*"
```

### Slow Performance

**Issue**: Pipeline taking >2 minutes

**Solution**:
```bash
# Check slow queries
curl http://localhost:3001/api/metrics/summary

# Look at slowQueryCount
# If high (>10), check:
# 1. Are composite indexes deployed? (Phase 6)
# 2. Is batch loading enabled? FEATURE_BATCH_LOADING=true
# 3. Increase QUEUE_CONCURRENCY if CPU allows
```

**Issue**: High memory usage

**Solution**:
```bash
# Check worker count
# Lower QUEUE_CONCURRENCY from 20 to 10

# Check debounce window
# Lower MAX_DEBOUNCE_WINDOW_MS from 300000 to 60000

# Enable metrics cleanup
# Metrics are auto-cleaned every 5 minutes (1-hour retention)
```

### Alerts Not Resolving

**Issue**: Alerts stay active after issues fixed

**Solution**:
```bash
# Verify AlertManager is enabled
# In .env:
FEATURE_ALERT_MANAGER=true

# Check logs for AlertManager events
# grep "AlertManager" in logs

# Ensure analysisTypes are explicit
# In code, events should have:
# { analysisTypes: ['mfa', 'policy', ...], findings: { mfa: [] } }
```

---

## Useful Commands

```bash
# Infrastructure
docker-compose up -d          # Start infrastructure
docker-compose down           # Stop infrastructure
docker-compose logs -f        # View logs
docker-compose ps             # Check status

# Pipeline
bun run dev                   # Development mode
bun run start                 # Production mode
bun run test:queue            # Test queue system

# Health & Metrics
curl http://localhost:3001/health
curl http://localhost:3001/metrics
curl http://localhost:3001/api/feature-flags

# Jobs
curl -X POST http://localhost:3001/api/jobs/schedule -d '...'
curl http://localhost:3001/api/jobs/12345
curl http://localhost:3001/api/jobs?status=active

# Feature Flags
curl http://localhost:3001/api/feature-flags
curl -X POST http://localhost:3001/api/feature-flags/new_pipeline/tenant/abc -d '{"enabled":true}'

# Monitoring
prometheus --config.file=prometheus.yml
grafana-server  # or: brew services start grafana
```

---

## Next Steps

1. **Configure Integrations**: Add M365, other integrations in Convex
2. **Setup Alerts**: Configure Prometheus alerts (see prometheus.yml comments)
3. **Create Dashboards**: Build Grafana dashboards for monitoring
4. **Enable SSL**: Add HTTPS with reverse proxy (nginx, caddy)
5. **Scale Workers**: Increase QUEUE_CONCURRENCY for higher load
6. **Add Tenants**: Create tenants and data sources in database
7. **Test Syncs**: Trigger manual syncs and verify data flow

---

## Support

- **Documentation**: See `docs/MIGRATION_GUIDE.md` for deployment strategy
- **Architecture**: See `PHASE*_COMPLETION_GUIDE.md` files
- **Issues**: Check logs first, then review troubleshooting section

---

**Version**: 1.0.0
**Last Updated**: 2025-12-07
**Phases Covered**: 1-7 (Complete Pipeline + Production Setup)
