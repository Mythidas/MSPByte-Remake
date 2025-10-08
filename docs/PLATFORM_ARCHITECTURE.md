# MSPByte Platform Architecture

## Vision: The Composable MSP Platform

MSPByte is designed to be the only MSP platform where you build YOUR workflow, not adapt to ours. The platform moves from a configuration-based approach to a **composable** approach, giving IT admins the building blocks to create their ideal MSP operations.

## Core Philosophy

Every MSP operates differently. Instead of building rigid integrations with fixed workflows, we provide:
- **Flexible data views** that balance simple summaries with deep integration-specific richness
- **Automation building blocks** that let admins create custom workflows
- **Integration templates** that provide one-click configuration for common scenarios

## Three-Layer Architecture

The platform consists of three complementary layers:

### Layer 1: Data Display (READ) - Passive Monitoring
**Purpose:** View and understand your data across all integrations

**UI Location:** Main navigation (Sites, Endpoints, Identities, etc.)

### Layer 2: Workflows/Automation (REACT) - Event-Driven Automation
**Purpose:** Automatically respond to events with custom logic

**UI Location:** Settings → Workflows (or "Automations")

### Layer 3: Integration Actions (WRITE) - Proactive Configuration
**Purpose:** Deploy templates and perform bulk operations on integrations

**UI Location:** Integration detail pages → Actions tab

---

## Layer 1: Data Display (READ)

### The Core UX Challenge

Users need two modes:
1. **Summary Mode**: "Show me all endpoints across all systems" (narrow, unified)
2. **Deep Dive Mode**: "Show me everything M365 knows about security" (rich, integration-specific)

### Navigation Pattern

```
Sidebar:
├── Dashboard (site overview)
├── 📊 Summary Views
│   ├── Endpoints (unified across Datto, Sophos, ConnectSecure)
│   ├── Identities (grouped by Identity Provider)
│   └── Security (aggregated security posture)
├── 🔌 Integrations
│   ├── Datto RMM
│   │   └── Endpoints → (just endpoints, lightweight)
│   ├── Sophos EDR
│   │   └── Endpoints → (endpoints + tamper passwords)
│   ├── ConnectSecure
│   │   └── Endpoints
│   ├── Microsoft 365
│   │   ├── Identities
│   │   ├── Groups
│   │   ├── Security Posture ← rich!
│   │   ├── Conditional Access
│   │   ├── Licenses
│   │   └── Privileged Access
│   └── HaloPSA
│       └── Tickets
```

**Key Insight:** Integration sections vary in depth based on complexity
- Simple integrations (Datto): 1 page with table + integration-specific fields
- Complex integrations (M365): Multi-page experience with analytics

### Progressive Disclosure Pattern

#### Summary View Example: `/sites/[slug]/endpoints`

```
┌─────────────────────────────────────────────────────────────┐
│ Endpoints                                    [Filter ▼] [⚙]  │
├─────────────────────────────────────────────────────────────┤
│ Name        Status  OS        IP         Sources     Actions│
├─────────────────────────────────────────────────────────────┤
│ WS-001      🟢      Win 11    10.0.1.5   🔷🔶🔸      [...]   │ ← Click opens drawer
│ WS-002      🔴      Win 10    10.0.1.8   🔷🔶         [...]   │
│ SRV-DC01    🟢      Server    10.0.1.10  🔷🔸         [...]   │
└─────────────────────────────────────────────────────────────┘
```

When you click a row, a drawer slides in from the right:

```
┌──────────────────────────────┐
│ WS-001          [🔷🔶🔸]     │
│                              │
│ ┌─ Overview ────────────────┐│ ← Normalized data
│ │ Hostname: WS-001          ││
│ │ IP: 10.0.1.5              ││
│ │ MAC: AA:BB:CC:DD:EE:FF    ││
│ │ OS: Windows 11 Pro        ││
│ └───────────────────────────┘│
│                              │
│ Sources:                     │
│ ┌─ Datto RMM ───────────────┐│ ← Integration-specific
│ │ • Open in Datto →         ││    (collapsible)
│ │ • Agent Version: 2.5.3    ││
│ │ • Last Checkin: 2m ago    ││
│ └───────────────────────────┘│
│ ┌─ Sophos EDR ──────────────┐│
│ │ • Open in Sophos →        ││
│ │ • Tamper Password: [Copy] ││
│ │ • Threats: 0 detected     ││
│ └───────────────────────────┘│
│ ┌─ ConnectSecure ───────────┐│
│ │ • Vulnerabilities: 3      ││
│ │ • Last Scan: 1 day ago    ││
│ └───────────────────────────┘│
└──────────────────────────────┘
```

#### Integration-Specific View: `/sites/[slug]/integrations/sophos-edr`

```
┌─────────────────────────────────────────────────────────────┐
│ Sophos EDR                                [Sync] [Settings]  │
├─────────────────────────────────────────────────────────────┤
│ Name        Status  Tamper Password    Threats   Actions    │
├─────────────────────────────────────────────────────────────┤
│ WS-001      🟢      •••••• [Copy]      0         [Console→] │
│ WS-002      🔴      •••••• [Copy]      0         [Console→] │
│ SRV-DC01    🟢      •••••• [Copy]      0         [Console→] │
└─────────────────────────────────────────────────────────────┘
```

**Key:** Integration-specific views show MORE columns directly, less clicking needed for specialized workflows. Clicking a row shows ONLY that integration's data (from `raw_data`).

#### Rich Integration: M365

`/sites/[slug]/integrations/microsoft365`:

```
┌─────────────────────────────────────────────────────────────┐
│ Microsoft 365                                                │
├─────────────────────────────────────────────────────────────┤
│ Tab: Overview | Identities | Security | Groups | Licenses   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ [Overview Tab]                                               │
│                                                              │
│ ┌─ Quick Stats ───────┬─ Security Health ─────┬─ Licenses ─┐│
│ │ 45 Users            │ 🔴 MFA: 12/45 (27%)   │ E3: 40     ││
│ │ 8 Guests            │ 🟡 CA Policies: 2     │ E5: 5      ││
│ │ 12 Groups           │ 🟢 Inactive: 0        │            ││
│ └─────────────────────┴────────────────────────┴────────────┘│
│                                                              │
│ [Quick Actions]                                              │
│ → View users without MFA                                     │
│ → Review privileged access                                   │
│ → Check inactive accounts                                    │
└──────────────────────────────────────────────────────────────┘
```

`/sites/[slug]/integrations/microsoft365/security`:

```
┌─────────────────────────────────────────────────────────────┐
│ Microsoft 365 > Security                                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ [MFA Status]                                                 │
│ ┌─ Enforcement Method ──────────────────────────────────────┐│
│ │ Per-User MFA: 8 users                                     ││
│ │ Conditional Access: 12 users                              ││
│ │ Security Defaults: Enabled                                ││
│ │ None: 25 users ⚠️                                         ││
│ └───────────────────────────────────────────────────────────┘│
│                                                              │
│ [Users Without MFA] [Export]                                 │
│ Name              Email              Last Login    Risk      │
│ John Doe          john@...           2 days ago    Low      │
│ Jane Smith        jane@...           45 days ago   High ⚠️  │
│                                                              │
│ [Conditional Access Policies]                                │
│ • Require MFA for Admins ✓                                   │
│ • Block legacy authentication ✓                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Component Architecture

```typescript
// For summary views
<EntityTable
  entityType="endpoints"
  mode="unified"  // Shows normalized_data across integrations
  sources={['datto-rmm', 'sophos-edr', 'connectsecure']}
  onRowClick={openUnifiedDrawer}
/>

// For integration-specific views
<EntityTable
  entityType="endpoints"
  mode="integration-specific"  // Shows raw_data + integration columns
  integrationId="sophos-edr"
  customColumns={[
    { key: 'tamper_password', render: TamperPasswordCell },
    { key: 'console_link', render: LinkCell }
  ]}
  onRowClick={openIntegrationDrawer}
/>

// For complex integrations
<IntegrationLayout integrationId="microsoft365">
  <CustomTabs>
    <Tab name="Overview">
      <M365Overview data={...} />
    </Tab>
    <Tab name="Security">
      <M365Security data={...} />
    </Tab>
  </CustomTabs>
</IntegrationLayout>
```

### Integration Config Schema

```typescript
export interface IntegrationConfig {
  // Existing fields...
  overview: { description: string; features: string[] };
  setup: { steps: string[]; requirements?: string[] };
  troubleshooting?: { title: string; solution: string }[];

  // New fields for controlling richness:
  displayMode: 'simple' | 'rich';  // Controls sidebar depth

  entityViews?: {
    [entityType: string]: {
      columns: ColumnDef[];  // Integration-specific columns
      drawer: Component;     // Custom drawer content
    }
  };

  richViews?: {  // For complex integrations only
    name: string;
    path: string;
    component: Component;
    icon?: Component;
  }[];
}
```

**Example Configs:**

```typescript
export const integrationConfigs = {
  'sophos-edr': {
    displayMode: 'simple',
    entityViews: {
      endpoints: {
        columns: [
          { key: 'tamper_password', label: 'Tamper Password', render: SecretCell },
          { key: 'console_link', label: 'Console', render: LinkCell }
        ],
        drawer: SophosEndpointDrawer
      }
    }
  },

  'microsoft365': {
    displayMode: 'rich',
    richViews: [
      { name: 'Overview', path: 'overview', component: M365Overview },
      { name: 'Identities', path: 'identities', component: M365Identities },
      { name: 'Security', path: 'security', component: M365Security },
      { name: 'Conditional Access', path: 'conditional-access', component: M365CA }
    ]
  }
}
```

### Data Access Strategy

```typescript
// Unified view uses normalized_data
const unifiedEndpoints = await orm.getRows('entities', {
  filters: [
    ['entity_type', 'eq', 'endpoints'],
    ['site_id', 'eq', siteId]
  ],
  select: 'id, integration_id, normalized_data'
});

// Integration-specific view uses raw_data + normalized_data
const sophosEndpoints = await orm.getRows('entities', {
  filters: [
    ['entity_type', 'eq', 'endpoints'],
    ['integration_id', 'eq', 'sophos-edr'],
    ['site_id', 'eq', siteId]
  ],
  select: 'id, normalized_data, raw_data'  // Gets everything
});
```

---

## Layer 2: Workflows/Automation (REACT)

### The Vision: Node-Based Composable Workflows

Instead of hardcoded automation, provide building blocks that admins can combine to create custom workflows.

### Three Node Types

Based on functional programming concepts:

```typescript
type NodeType = 'pure' | 'passthrough' | 'closure';

interface Node {
  id: string;
  type: NodeType;
  integration_id?: string;  // null for system nodes

  // Schema
  inputs: NodeInput[];      // empty for pure nodes
  outputs: NodeOutput[];    // empty for closure nodes

  // Execution
  handler: (inputs: any) => Promise<any>;

  // UI
  label: string;
  category: string;
  icon: string;
  configUI?: Component;     // Custom config panel
}
```

**Node Types Explained:**

1. **Pure Nodes** - No inputs, has outputs
   - Triggers: Webhooks, schedules, integration events
   - Example: `[Datto Site Created]`, `[Sophos Threat Detected]`

2. **Passthrough Nodes** - Has inputs and outputs
   - Transforms: Filter, map, enrich, conditional logic
   - Example: `[Filter: Type = "customer"]`, `[Check Severity]`

3. **Closure Nodes** - Has inputs, no outputs
   - Actions: Send emails, create tickets, update records
   - Example: `[Send Email]`, `[Create HaloPSA Ticket]`

### Real-World Workflow Examples

#### Scenario 1: New Site Onboarding

```
[Datto Site Created] (pure)
  └─→ [Filter: Type = "customer"] (passthrough)
      ├─→ [Create Site in MSPByte] (passthrough)
      │   ├─→ [Send Welcome Email] (closure)
      │   ├─→ [Create HaloPSA Ticket] (closure)
      │   └─→ [Notify Slack Channel] (closure)
      └─→ [Log Event] (closure)
```

#### Scenario 2: Security Alerting

```
[Sophos Threat Detected] (pure)
  └─→ [Enrich with Endpoint Info] (passthrough)
      └─→ [Check Severity] (passthrough)
          ├─→ [If Critical] (passthrough)
          │   ├─→ [Create HaloPSA Ticket] (closure)
          │   ├─→ [PagerDuty Alert] (closure)
          │   └─→ [Email Security Team] (closure)
          └─→ [If Low] (passthrough)
              └─→ [Dashboard Notification] (closure)
```

#### Scenario 3: Endpoint Correlation

```
[Endpoint Synced] (pure)
  └─→ [Find Matching Endpoints] (passthrough)
      └─→ [Check Match Confidence] (passthrough)
          ├─→ [If >90%] (passthrough)
          │   └─→ [Auto-Link to Unified Entity] (closure)
          └─→ [If 50-90%] (passthrough)
              └─→ [Create Review Task] (closure)
```

### Database Schema

```sql
-- Core workflow definition
workflows
  - id (uuid)
  - tenant_id (uuid)
  - name (text)
  - description (text)
  - is_active (boolean)
  - is_template (boolean)  -- system-provided templates
  - created_by (uuid)
  - category (text)  -- "onboarding", "alerting", "automation", "views"
  - created_at (timestamp)
  - updated_at (timestamp)

-- Individual nodes in a workflow
workflow_nodes
  - id (uuid)
  - workflow_id (uuid, FK)
  - node_type (text)  -- references node registry
  - config (jsonb)    -- node-specific configuration
  - position_x (int)  -- for visual editor
  - position_y (int)

-- Connections between nodes
workflow_edges
  - id (uuid)
  - workflow_id (uuid, FK)
  - source_node_id (uuid, FK)
  - target_node_id (uuid, FK)
  - source_output (text)   -- which output port
  - target_input (text)    -- which input port
  - conditions (jsonb)     -- optional edge conditions

-- Execution history
workflow_executions
  - id (uuid)
  - workflow_id (uuid, FK)
  - trigger_event (jsonb)
  - status (enum: pending, running, success, failed)
  - started_at (timestamp)
  - completed_at (timestamp)
  - execution_log (jsonb)  -- node-by-node results
  - error_message (text)
```

### Node Registry System

```typescript
// System provides base nodes
const systemNodes: NodeDefinition[] = [
  // Triggers (Pure)
  {
    id: 'trigger.webhook',
    type: 'pure',
    category: 'triggers',
    label: 'Webhook Trigger',
    outputs: [{ name: 'payload', schema: z.any() }],
    handler: async () => { /* Listen to webhooks */ }
  },
  {
    id: 'trigger.schedule',
    type: 'pure',
    category: 'triggers',
    label: 'Schedule',
    outputs: [{ name: 'timestamp', schema: z.string() }],
    configUI: ScheduleConfig,
    handler: async () => { /* Cron-based execution */ }
  },

  // Transforms (Passthrough)
  {
    id: 'transform.filter',
    type: 'passthrough',
    category: 'transforms',
    label: 'Filter',
    inputs: [{ name: 'items', schema: z.array(z.any()) }],
    outputs: [{ name: 'filtered', schema: z.array(z.any()) }],
    configUI: FilterConfig,
    handler: async ({ items, config }) => {
      return items.filter(item => /* apply filter logic */);
    }
  },

  // Actions (Closure)
  {
    id: 'action.email',
    type: 'closure',
    category: 'actions',
    label: 'Send Email',
    inputs: [
      { name: 'to', schema: z.string().email() },
      { name: 'subject', schema: z.string() },
      { name: 'body', schema: z.string() }
    ],
    configUI: EmailConfig,
    handler: async ({ to, subject, body }) => {
      await sendEmail({ to, subject, body });
    }
  },
];

// Integrations register their nodes
class DattoIntegration {
  registerNodes(): NodeDefinition[] {
    return [
      {
        id: 'datto.site_created',
        type: 'pure',
        category: 'datto-triggers',
        label: 'Datto Site Created',
        outputs: [{
          name: 'site',
          schema: z.object({
            id: z.string(),
            name: z.string(),
            type: z.enum(['customer', 'prospect'])
          })
        }],
        handler: async () => {
          // Listen to Datto webhooks
        }
      },
      {
        id: 'datto.get_device',
        type: 'passthrough',
        category: 'datto-actions',
        label: 'Get Datto Device',
        inputs: [{ name: 'device_id', schema: z.string() }],
        outputs: [{
          name: 'device',
          schema: z.object({
            id: z.string(),
            hostname: z.string(),
            status: z.string()
          })
        }],
        handler: async ({ device_id }) => {
          return await dattoAPI.getDevice(device_id);
        }
      }
    ];
  }
}
```

### Workflow Builder UI

React Flow / Figma-style canvas:

```
┌────────────────────────────────────────────────────────────┐
│ Workflow: New Customer Onboarding            [Save] [Test] │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  📦 Node Library          ┌──────────────────────────┐    │
│  ├─ Triggers              │     Canvas Area          │    │
│  │  ├─ Datto              │                          │    │
│  │  │  └─ Site Created    │   ┌─────────────────┐   │    │
│  │  ├─ Sophos             │   │ Datto Site      │   │    │
│  │  └─ Schedule           │   │ Created         │   │    │
│  ├─ Transforms            │   └────────┬────────┘   │    │
│  │  ├─ Filter             │            │            │    │
│  │  ├─ Map                │            ▼            │    │
│  │  └─ Enrich             │   ┌─────────────────┐   │    │
│  └─ Actions               │   │ Create MSPByte  │   │    │
│     ├─ Email              │   │ Site            │   │    │
│     ├─ Slack              │   └────────┬────────┘   │    │
│     └─ Create Ticket      │            │            │    │
│                           │            ▼            │    │
│  [Click/drag to add]      │   ┌─────────────────┐   │    │
│                           │   │ Send Welcome    │   │    │
│                           │   │ Email           │   │    │
│                           │   └─────────────────┘   │    │
│                           └──────────────────────────┘    │
│                                                            │
│  Selected Node: Create MSPByte Site                       │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Config:                                              │ │
│  │ Site Name: {{ site.name }}                           │ │
│  │ PSA Integration: HaloPSA                             │ │
│  │ Map to PSA ID: {{ site.external_id }}                │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### Template Marketplace

```typescript
const workflowTemplates: WorkflowTemplate[] = [
  {
    id: 'new-customer-onboarding',
    name: 'New Customer Onboarding',
    description: 'Automatically create sites and send welcome emails when new customers are added',
    category: 'onboarding',
    requiredIntegrations: ['halopsa', 'datto-rmm'],
    nodes: [...],
    edges: [...],
    popularity: 245,
    author: 'MSPByte Team',
    tags: ['automation', 'onboarding', 'customer-experience']
  },
  {
    id: 'security-incident-response',
    name: 'Security Incident Response',
    description: 'Auto-create tickets and alert on-call staff for critical security threats',
    category: 'security',
    requiredIntegrations: ['sophos-edr', 'halopsa', 'pagerduty'],
    nodes: [...],
    edges: [...],
    popularity: 189,
    author: 'MSPByte Team',
    tags: ['security', 'alerting', 'incident-response']
  },
  {
    id: 'endpoint-correlation',
    name: 'Automatic Endpoint Correlation',
    description: 'Automatically link endpoints across RMM, EDR, and security tools',
    category: 'data-management',
    requiredIntegrations: ['datto-rmm', 'sophos-edr', 'connectsecure'],
    nodes: [...],
    edges: [...],
    popularity: 156,
    author: 'MSPByte Team',
    tags: ['correlation', 'automation', 'data-quality']
  }
];
```

---

## Layer 3: Integration Actions (WRITE)

### Purpose

Provide one-click templates and bulk operations for direct integration management. This is proactive configuration, not reactive automation.

### Integration Page Structure

Every integration gets an "Actions" tab:

`/integrations/microsoft365`:

```
┌──────────────────────────────────────────────────────────┐
│ Microsoft 365                    [Sync] [Settings]       │
├──────────────────────────────────────────────────────────┤
│ Tabs: Overview | Configuration | Actions | Workflows     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ [Actions Tab]                                            │
│                                                          │
│ Quick Actions:                                           │
│ ┌─ Security Templates ──────────────────────────────┐   │
│ │ • SMB Security Baseline                           │   │
│ │   - Enable Security Defaults                      │   │
│ │   - Require MFA for Admins                        │   │
│ │   - Block Legacy Auth                             │   │
│ │                                                    │   │
│ │ • Healthcare Compliance (HIPAA)                   │   │
│ │   - Enhanced security policies                    │   │
│ │   - Audit logging                                 │   │
│ │   - Data loss prevention                          │   │
│ │                                                    │   │
│ │ • Finance Security (SOC2)                         │   │
│ │   - Strict access controls                        │   │
│ │   - Advanced threat protection                    │   │
│ │                                                    │   │
│ │ [Apply to Sites ▼]                                │   │
│ └───────────────────────────────────────────────────┘   │
│                                                          │
│ ┌─ Bulk Operations ─────────────────────────────────┐   │
│ │ • Enable MFA for all users                        │   │
│ │ • Block Legacy Authentication globally            │   │
│ │ • Export License Report (all sites)               │   │
│ │ • Review Guest Access permissions                 │   │
│ └───────────────────────────────────────────────────┘   │
│                                                          │
│ ┌─ Custom Actions ──────────────────────────────────┐   │
│ │ • Create Conditional Access Policy                │   │
│ │ • Assign Licenses in Bulk                         │   │
│ │ • Review Inactive Users (90+ days)                │   │
│ │ • Audit Privileged Access                         │   │
│ └───────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### Template System

```typescript
interface IntegrationTemplate {
  id: string;
  integration_id: string;
  name: string;
  description: string;
  category: string;

  // What this template does
  actions: TemplateAction[];

  // Configuration
  configSchema: z.ZodSchema;
  defaultConfig: any;

  // Requirements
  requiredPermissions: string[];
  prerequisites?: string[];

  // Execution
  handler: (siteId: string, config: any) => Promise<TemplateResult>;
}

interface TemplateAction {
  type: 'create' | 'update' | 'delete' | 'configure';
  resource: string;  // What's being modified
  description: string;
}

interface TemplateResult {
  success: boolean;
  actionsCompleted: number;
  actionsFailed: number;
  details: {
    action: string;
    status: 'success' | 'failed';
    message: string;
  }[];
}
```

**Example: M365 Security Baseline Template**

```typescript
const m365SecurityBaseline: IntegrationTemplate = {
  id: 'm365-smb-security-baseline',
  integration_id: 'microsoft365',
  name: 'SMB Security Baseline',
  description: 'Apply recommended security settings for small-medium businesses',
  category: 'security',

  actions: [
    {
      type: 'configure',
      resource: 'Security Defaults',
      description: 'Enable Security Defaults for baseline MFA protection'
    },
    {
      type: 'create',
      resource: 'Conditional Access Policy',
      description: 'Require MFA for administrators'
    },
    {
      type: 'create',
      resource: 'Conditional Access Policy',
      description: 'Block legacy authentication protocols'
    }
  ],

  configSchema: z.object({
    enableSecurityDefaults: z.boolean().default(true),
    adminMFAPolicy: z.boolean().default(true),
    blockLegacyAuth: z.boolean().default(true)
  }),

  requiredPermissions: [
    'Policy.ReadWrite.ConditionalAccess',
    'Policy.ReadWrite.SecurityDefaults'
  ],

  handler: async (siteId: string, config: any) => {
    const results: TemplateResult = {
      success: true,
      actionsCompleted: 0,
      actionsFailed: 0,
      details: []
    };

    try {
      // Get M365 credentials for this site
      const credentials = await getM365Credentials(siteId);

      // Action 1: Enable Security Defaults
      if (config.enableSecurityDefaults) {
        await m365API.enableSecurityDefaults(credentials);
        results.actionsCompleted++;
        results.details.push({
          action: 'Enable Security Defaults',
          status: 'success',
          message: 'Security Defaults enabled successfully'
        });
      }

      // Action 2: Create Admin MFA Policy
      if (config.adminMFAPolicy) {
        const policy = await m365API.createConditionalAccessPolicy(credentials, {
          displayName: 'Require MFA for Admins',
          state: 'enabled',
          conditions: {
            users: {
              includeRoles: ['Global Administrator', 'Security Administrator']
            }
          },
          grantControls: {
            builtInControls: ['mfa']
          }
        });

        results.actionsCompleted++;
        results.details.push({
          action: 'Create Admin MFA Policy',
          status: 'success',
          message: `Policy created: ${policy.id}`
        });
      }

      // Action 3: Block Legacy Auth
      if (config.blockLegacyAuth) {
        const policy = await m365API.createConditionalAccessPolicy(credentials, {
          displayName: 'Block Legacy Authentication',
          state: 'enabled',
          conditions: {
            users: { includeUsers: ['All'] },
            clientAppTypes: ['exchangeActiveSync', 'other']
          },
          grantControls: {
            builtInControls: ['block']
          }
        });

        results.actionsCompleted++;
        results.details.push({
          action: 'Block Legacy Auth',
          status: 'success',
          message: `Policy created: ${policy.id}`
        });
      }

      // Emit event for workflows to catch
      await events.publish('m365.template_applied', {
        siteId,
        templateId: 'm365-smb-security-baseline',
        policies: results.details
      });

    } catch (error) {
      results.success = false;
      results.actionsFailed++;
      results.details.push({
        action: 'Template Application',
        status: 'failed',
        message: error.message
      });
    }

    return results;
  }
};
```

### Workflows Tab (on Integration Pages)

Show workflows that use this integration:

```
┌──────────────────────────────────────────────────────────┐
│ [Workflows Tab]                                          │
│                                                          │
│ Active Workflows for Microsoft 365:                      │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ New Site Security Setup               [Edit] [Logs] │ │
│ │ Trigger: Site linked to M365                        │ │
│ │ Actions: Apply security template, notify team       │ │
│ │ Last run: 2 days ago (Success)                      │ │
│ │ Executions: 12 total, 11 success, 1 failed          │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ MFA Reminder Campaign                 [Edit] [Logs] │ │
│ │ Trigger: Weekly schedule (Mondays 9am)              │ │
│ │ Actions: Email users without MFA                    │ │
│ │ Last run: 3 days ago (Success)                      │ │
│ │ Executions: 52 total, 52 success                    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ [+ Create Workflow from Template]                        │
│ [+ Create Custom Workflow]                               │
└──────────────────────────────────────────────────────────┘
```

---

## How The Three Layers Work Together

### Example: New M365 Customer Setup

**User Journey:**

1. **Layer 3: Apply Template** (one-time action)
   ```
   User navigates to: /integrations/microsoft365
   Clicks: "Actions" tab
   Selects: "Apply SMB Security Baseline"
   Chooses site: "Acme Corp"
   Clicks: [Apply Template]
   ```

2. **Layer 2: Workflow Triggered** (automation kicks in)
   ```
   Event: "m365.template_applied" is published

   Workflow: "M365 Security Onboarding" activates:
     [M365 Template Applied] (trigger)
       └─→ [Send Notification]
           ├─→ [Email IT Team]
           │   Subject: "M365 security configured for Acme Corp"
           │   Body: Lists all policies created
           └─→ [Slack #security Channel]
               Message: "✅ M365 baseline applied to Acme Corp"

       └─→ [Create HaloPSA Ticket]
           Title: "Document M365 security config for Acme Corp"
           Description: Includes policy details
           Assigned to: Documentation team
   ```

3. **Layer 1: View Results** (see what happened)
   ```
   User navigates to: /sites/acme-corp/integrations/microsoft365

   Security tab shows:
     ✓ Security Defaults: Enabled (applied 5 min ago)
     ✓ CA Policies: 2 active
       - Require MFA for Admins
       - Block Legacy Authentication
     ⚠ MFA Coverage: 12/45 users (27%)

   [View Users Without MFA →]
   ```

### Data Flow Between Layers

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  User Action (Layer 3)                                  │
│  "Apply M365 Security Template"                         │
│                                                         │
└───────────────┬─────────────────────────────────────────┘
                │
                │ 1. Execute template
                │ 2. Call M365 API
                │ 3. Create policies
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Event Published                                        │
│  { type: "m365.template_applied", ... }                 │
│                                                         │
└───────────────┬─────────────────────────────────────────┘
                │
                │ Workflows listening for this event
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Workflow Execution (Layer 2)                           │
│  - Send emails                                          │
│  - Post to Slack                                        │
│  - Create tickets                                       │
│                                                         │
└───────────────┬─────────────────────────────────────────┘
                │
                │ Background sync
                │ (existing pipeline)
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Data Sync (Layer 1)                                    │
│  - Fetch updated M365 data                              │
│  - Store in entities table                              │
│  - Update views                                         │
│                                                         │
└───────────────┬─────────────────────────────────────────┘
                │
                │ User navigates to view
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  UI Display (Layer 1)                                   │
│  Shows updated security posture                         │
│  Shows applied policies                                 │
│  Shows MFA coverage                                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### When To Use Each Layer

**Layer 1 (Data Display):**
- ✅ "What endpoints do we have?"
- ✅ "Show me M365 security status"
- ✅ "Which users don't have MFA?"
- ✅ "Compare Datto vs Sophos data"

**Layer 2 (Workflows):**
- ✅ "Alert me when a threat is detected"
- ✅ "Create ticket when new site is added"
- ✅ "Send weekly MFA reminders"
- ✅ "Auto-correlate endpoints across tools"

**Layer 3 (Integration Actions):**
- ✅ "Apply security template to new customer"
- ✅ "Enable MFA for all users now"
- ✅ "Deploy Sophos policy to all endpoints"
- ✅ "Export license report"

---

## Implementation Roadmap

### Phase 1: Core Value (Now - 3 months)

**Focus:** Get basic value to users quickly

**Layer 1 (Data Display):**
- ✅ Unified endpoint view across integrations
- ✅ Integration-specific views (Datto, Sophos, etc.)
- ✅ Entity detail drawers with progressive disclosure
- ✅ Basic M365 rich views (overview, identities, security)

**Layer 3 (Integration Actions):**
- ✅ M365 security templates (SMB baseline)
- ✅ Sophos policy templates
- ✅ Basic bulk operations (email, export)
- ✅ Integration actions UI (Actions tab)

**Skip for now:**
- ❌ Workflows (too complex for MVP)
- ❌ Custom views
- ❌ Template marketplace

**Deliverables:**
- Users can view data across integrations
- Users can apply pre-built templates
- Immediate value without complex configuration

### Phase 2: Automation Foundation (3-6 months)

**Focus:** Build workflow engine and basic automation

**Layer 2 (Workflows):**
- ✅ Node registry system
- ✅ Workflow execution engine
- ✅ 5-10 system nodes (triggers, basic actions)
- ✅ 3-5 integration nodes per integration
- ✅ Simple workflow builder UI (list-based, not visual)
- ✅ Workflow execution logs

**Skip for now:**
- ❌ Visual workflow builder
- ❌ Complex transformations
- ❌ Conditional branching

**Deliverables:**
- Users can create simple trigger → action workflows
- Pre-built workflow templates available
- Execution history and debugging

### Phase 3: Rich Workflows (6-9 months)

**Focus:** Advanced workflow capabilities

**Layer 2 (Workflows):**
- ✅ Visual workflow builder (React Flow)
- ✅ Passthrough nodes (filter, map, enrich)
- ✅ Conditional logic
- ✅ Error handling & retry logic
- ✅ Workflow versioning
- ✅ Testing/debugging tools

**Layer 3 (Integration Actions):**
- ✅ More integration templates
- ✅ Custom template builder
- ✅ Template sharing between tenants

**Deliverables:**
- Power users can build complex workflows
- Visual workflow editor
- Template marketplace (internal)

### Phase 4: Advanced Features (9-12 months)

**Focus:** Community and customization

**Layer 2 (Workflows):**
- ✅ Community template sharing
- ✅ Custom node creation (for power users)
- ✅ Workflow analytics (popularity, success rates)
- ✅ Advanced debugging (step-through, breakpoints)

**Layer 1 (Data Display):**
- ✅ Custom data view builder
- ✅ Custom dashboard builder
- ✅ Saved view templates

**Deliverables:**
- Marketplace of community workflows
- Custom nodes for unique use cases
- Fully customizable data views

### Phase 5+: Scale & Optimize (12+ months)

**Focus:** Performance, AI, and ecosystem

- ✅ AI-suggested workflows
- ✅ Performance optimization for large datasets
- ✅ Public API for third-party nodes
- ✅ Mobile app support
- ✅ Advanced analytics and reporting

---

## Technical Considerations

### Execution Model

**Recommendation: Queue-based serverless**

```typescript
// Workflow execution flow:
1. Event occurs (trigger)
   └─→ Publish to event queue (NATS/Redis)

2. Workflow executor picks up event
   └─→ Load workflow definition
   └─→ Execute nodes in order
   └─→ Each node is isolated function

3. Node execution
   └─→ Validate inputs
   └─→ Execute handler (with timeout)
   └─→ Pass outputs to next node
   └─→ Log results

4. Completion
   └─→ Store execution log
   └─→ Emit completion event
```

**Benefits:**
- Scalable (add more workers)
- Fault-tolerant (retry failed nodes)
- Observable (full execution logs)
- Fast (async execution)

### Permission Model

**Recommendation: Layered permissions**

```typescript
// User permissions
interface Permissions {
  // Layer 1: View data
  canViewData: boolean;
  canViewIntegrations: string[];  // specific integrations

  // Layer 2: Create workflows
  canCreateWorkflows: boolean;
  canEditWorkflows: boolean;
  canCreateCustomNodes: boolean;  // power users only

  // Layer 3: Execute actions
  canExecuteActions: boolean;
  canApplyTemplates: boolean;
  canCreateTemplates: boolean;    // admins only
}
```

**Role examples:**
- **Viewer:** Can only view data (Layer 1)
- **Technician:** Can view + execute pre-built actions (Layer 1 + 3)
- **Administrator:** Can create workflows, apply templates (all layers)
- **Super Admin:** Can create custom nodes, templates (all + custom)

### Scope & Complexity

**Keep it DAG (Directed Acyclic Graph) only:**
- ✅ Linear flows
- ✅ Branching (if/else)
- ✅ Parallel execution
- ❌ No loops (prevents infinite execution)
- ❌ No recursion

**If loops needed later:**
- Add "ForEach" node that internally handles iteration
- Set maximum iteration limit
- Require explicit loop configuration

### Pricing Impact

**Recommendation: Tiered feature access**

- **Starter Plan:**
  - Layer 1 (data views) ✓
  - Layer 3 (pre-built templates) ✓
  - Layer 2 (max 5 workflows)

- **Professional Plan:**
  - Everything in Starter
  - Layer 2 (unlimited workflows)
  - Custom templates

- **Enterprise Plan:**
  - Everything in Professional
  - Custom nodes
  - Priority support
  - Workflow marketplace access

### Database Considerations

**Entity Correlation:**

For unified views showing data across integrations, implement correlation table:

```sql
unified_entities
  - id (uuid, PK)
  - entity_type (text) -- "endpoints", "identities", etc.
  - correlation_domain (text) -- "physical_infrastructure", "identity_provider"
  - primary_entity_id (uuid, FK to entities)
  - site_id (uuid, FK)
  - tenant_id (uuid, FK)
  - display_name (text)
  - matching_confidence (float) -- 0.0-1.0 for auto-matched
  - manually_verified (boolean)
  - metadata (jsonb)

unified_entity_members
  - unified_entity_id (uuid, FK)
  - entity_id (uuid, FK to entities)
  - integration_id (uuid, FK)
  - data_source_id (uuid, FK)
  - is_primary (boolean) -- which integration's data to show by default
  - last_seen_at (timestamp)
```

**Correlation Domains:**
- `physical_infrastructure` - Endpoints correlate across RMM/EDR
- `identity_provider` - Identities stay within their IdP
- `none` - No correlation (integration-specific data)

---

## Success Metrics

### Layer 1 (Data Display)
- Time to find information (target: <30 seconds)
- % of users using unified vs integration-specific views
- Most viewed integrations
- Most used filters

### Layer 2 (Workflows)
- Number of active workflows per tenant
- Workflow execution success rate (target: >95%)
- Most popular workflow templates
- Average time saved per workflow (calculate based on manual steps)

### Layer 3 (Integration Actions)
- Template application rate
- Template success rate (target: >98%)
- Time to configure new customer (target: <10 minutes with templates)
- Most used templates

---

## Conclusion

This three-layer architecture provides:

1. **Flexibility** - MSPs can customize to their exact workflow
2. **Simplicity** - Start simple (Layer 1), add complexity as needed
3. **Scalability** - Each layer can grow independently
4. **Differentiator** - "Build your MSP platform" vs "adapt to ours"

The key is **incremental delivery**:
- Ship Layer 1 + basic Layer 3 first (immediate value)
- Add Layer 2 when users ask for automation
- Expand capabilities based on user feedback

This isn't feature creep - **this is your competitive advantage.**
