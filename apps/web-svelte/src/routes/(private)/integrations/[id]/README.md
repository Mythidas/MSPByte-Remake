# Integration Detail Page

This directory contains a modular, config-driven integration detail page for MSP integrations.

## Files Overview

### Configuration & Data
- **`integrations.config.ts`** - Main configuration map for all integrations. Add new integrations here with their overview, setup steps, features, troubleshooting info, and custom tabs.
- **`mock-data.ts`** - Mock billing and setup status data. Replace with real API calls when backend is ready.

### Components
- **`IntegrationHeader.svelte`** - Header with integration name, icon, badges, and action buttons
- **`CostCard.svelte`** - Reusable card for displaying cost metrics with trend indicators
- **`SetupStatus.svelte`** - Shows integration connection status and last sync time
- **`FeatureList.svelte`** - Renders feature checkmarks in a grid layout

### Main Page
- **`+page.svelte`** - Main integration detail page with tabs:
  - Overview: Description and feature list
  - Setup: Requirements and step-by-step instructions
  - Configuration: Form for integration credentials
  - Billing: Breakdown of per-configuration costs
  - Troubleshooting: FAQ items
  - [Custom tabs]: E.g., "Site Mapping" for AutoTask

- **`+page.server.ts`** - Server load function that fetches integration from database

## Adding a New Integration

1. Add integration to database (`integrations` table)
2. Add config to `integrations.config.ts`:
   ```typescript
   myintegration: {
     overview: { description: "...", features: [...] },
     setup: { requirements: [...], steps: [...] },
     troubleshooting: [...],
     customTabs: [...]  // optional
   }
   ```
3. Add mock data to `mock-data.ts` (or wire up real backend)
4. The page will automatically render with all configured content!

## Design Principles

- **Config-driven**: All integration-specific content lives in `integrations.config.ts`
- **Modular**: Reusable components for common UI patterns
- **Shadcn-first**: Uses shadcn-svelte components, no custom colors
- **Per-config billing**: Shows cost breakdown per configuration item (e.g., sites mapped, devices monitored)
- **Extensible**: Supports custom tabs for integration-specific features

## Next Steps

- Wire up real billing API
- Implement configuration form with dynamic fields based on `config_schema`
- Add test connection functionality
- Create custom tab components (e.g., site mapping for AutoTask)
- Add enable/disable API integration
