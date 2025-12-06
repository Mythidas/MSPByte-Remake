# Redis Infrastructure for MSPByte Pipeline

This directory contains Redis configuration for the MSPByte pipeline queue system.

## Quick Start

### Local Development

```bash
# Start Redis
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f redis

# Stop Redis
docker-compose down

# Stop and remove data
docker-compose down -v
```

### Verify Connection

```bash
# Using redis-cli
docker exec -it mspbyte-redis redis-cli ping
# Expected: PONG

# Check persistence
docker exec -it mspbyte-redis redis-cli
> INFO persistence
> exit
```

## Configuration

### Persistence

Redis is configured with dual persistence:

1. **AOF (Append-Only File)**
   - Writes every operation to disk
   - `appendfsync everysec` - sync every second
   - Max 1 second of data loss on crash

2. **RDB (Snapshots)**
   - Save 900 1 - snapshot if 1 key changed in 15 min
   - Save 300 10 - snapshot if 10 keys changed in 5 min
   - Save 60 10000 - snapshot if 10k keys changed in 1 min

### Memory

- Max memory: 512MB
- Policy: `noeviction` - fail writes when full (don't lose data)

## Production Setup

### Redis Cloud (Recommended)

1. Sign up at https://redis.com/try-free/
2. Create database
3. Note connection details
4. Update `.env`:
   ```
   REDIS_HOST=your-redis-host.cloud.redislabs.com
   REDIS_PORT=12345
   REDIS_PASSWORD=your-password
   ```

### Self-Hosted

Use `redis.conf` as base configuration:

```bash
# Install Redis
sudo apt-get install redis-server

# Copy config
sudo cp redis.conf /etc/redis/redis.conf

# Start
sudo systemctl start redis
sudo systemctl enable redis
```

## Monitoring

### Check Health

```bash
# Connection
redis-cli ping

# Memory usage
redis-cli INFO memory

# Queue depth
redis-cli LLEN bull:pipeline-jobs:wait

# Connected clients
redis-cli CLIENT LIST
```

### Metrics

Key metrics to monitor:
- `used_memory` - current memory usage
- `connected_clients` - active connections
- `instantaneous_ops_per_sec` - operations per second
- `aof_current_size` - AOF file size

## Troubleshooting

### Redis won't start

```bash
# Check logs
docker-compose logs redis

# Common issues:
# - Port 6379 already in use: `lsof -i :6379`
# - Permissions on redis.conf: `chmod 644 redis.conf`
# - Invalid config: `redis-server redis.conf --test-memory 1`
```

### Data recovery

```bash
# AOF file location (inside container)
/data/appendonly.aof

# RDB file location
/data/dump.rdb

# Backup
docker cp mspbyte-redis:/data ./redis-backup

# Restore
docker cp ./redis-backup/appendonly.aof mspbyte-redis:/data/
docker cp ./redis-backup/dump.rdb mspbyte-redis:/data/
docker-compose restart redis
```

## Data Retention

BullMQ automatically cleans up:
- Completed jobs: Keep last 1000 or 24 hours
- Failed jobs: Keep last 5000 or 7 days

Manual cleanup:
```bash
# Clear all jobs
redis-cli FLUSHDB

# Clear specific queue
redis-cli DEL bull:pipeline-jobs:wait
redis-cli DEL bull:pipeline-jobs:active
redis-cli DEL bull:pipeline-jobs:completed
```
