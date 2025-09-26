# Backend Architecture

MSPByte backend is designed as a scalable data processing pipeline that integrates with multiple external services and normalizes data for unified operations.

## Architecture Overview

```
DB Jobs → Scheduler → Adapters → Processors → Resolvers → Linkers → Workers
                         ↓
                NATS Event System (events/)
                         ↓
                  Normalized Database
```

## Directory Structure

```
backend/
├── events/           # NATS server - event-driven communication hub
├── services/         # Main application server hosting pipeline stages
└── pipeline/         # Data processing pipeline stages
    ├── scheduler/    # Poll DB jobs and trigger pipeline
    ├── adapters/     # Fetch data from external APIs
    ├── processors/   # Convert raw data to normalized format
    ├── resolvers/    # Clean up fragmented data
    ├── linkers/      # Create entity relationships
    └── workers/      # Custom business logic on processed data
```

## Data Processing Flow

### 1. **Scheduler**

- Poll database for scheduled jobs
- Trigger adapters via NATS events based on job type
- Handle job retry logic and scheduling future jobs
- Keep adapters focused on pure external API operations

### 2. **Adapters**

- Listen for scheduler events for their specific service
- Fetch data from external services (Microsoft365, AutoTask, Sophos, etc.)
- Handle API rate limits, authentication, pagination
- Store raw responses in `raw_data` column

### 3. **Processors**

- Convert service-specific data formats to normalized schema
- Transform raw_data → normalized_data
- Maintain type safety with shared type definitions

### 4. **Resolvers**

- Clean up fragmented or incomplete data
- Handle data consistency issues from external sources
- Could be considered the validation layer

### 5. **Linkers**

- Analyze processed data for entity relationships
- Create entries in `entity_relationship` table
- Link related entities across different services

### 6. **Workers**

- Execute custom business logic on clean data
- Generate reports, alerts, automations
- Handle client-specific workflows

## Data Storage Strategy

**Dual-column approach:**

- `raw_data`: Original API responses (service-specific schemas)
- `normalized_data`: Unified schema for cross-system operations

This enables:

- Service-specific UIs using raw data
- Unified analytics and operations using normalized data
- Data integrity and audit trails

## Event System

NATS server in `events/` provides:

- Decoupled communication between pipeline stages
- Event-driven architecture for scalability
- Future service separation without code changes

## Scaling Strategy

**Current:** Monolithic services app hosting all pipeline stages
**Future:** Split services based on bottlenecks:

1. Adapters (per external service rate limits)
2. Workers (custom logic resource requirements)
3. Processors/Resolvers (CPU vs DB scaling needs)

Each pipeline stage is designed as independent modules to enable easy service extraction when needed.
