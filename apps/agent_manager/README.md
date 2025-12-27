# Agent Manager

A simplified, dev-only dashboard for managing MSP Agent without authentication.

## Features

- ✅ **Dashboard** - Overview with stats for agents, sites, and tickets
- ✅ **Agents Table** - Full DataTable with filtering, sorting, and search
- ✅ **Sites Table** - View all managed sites
- ✅ **Tickets Table** - View all submitted tickets
- ✅ **HaloPSA Integration** - Manual site linking/unlinking/creation

## Setup Instructions

### 1. Install Dependencies

From the monorepo root:

```bash
bun install
```

### 2. Configure Environment Variables

Copy the example environment file and fill in the values:

```bash
cd apps/agent_manager
cp .env.example .env.local
```

Edit `.env.local` and add:

```env
# Use the same Convex URL as the main frontend app
NEXT_PUBLIC_CONVEX_URL=https://your-convex-deployment.convex.cloud

# Secret for bypassing authentication (ask admin for this value)
NEXT_PUBLIC_CONVEX_SECRET=your_secret_here

# Encryption key for HaloPSA credentials (required for sync functionality)
ENCRYPTION_KEY=your_encryption_key_here
```

### 3. Run the Development Server

```bash
# From the monorepo root
cd apps/agent_manager
bun run dev
```

The app will be available at `http://localhost:3001`

## Architecture

### Key Differences from Main Frontend

- **No Authentication**: Uses `*_s` helper variants with secret to bypass auth
- **Simplified State**: Only tracks current site, no mode/integration switching
- **Static Navigation**: No mode-based routing
- **Port 3001**: Runs on different port to avoid conflicts

### Technology Stack

- **Framework**: Next.js 16 with App Router
- **Database**: Convex (real-time)
- **UI**: shadcn/ui components
- **Styling**: Tailwind CSS v4
- **State**: Zustand (localStorage)
- **Tables**: Custom DataTable with TanStack Table

## Usage

### Site Selection

The app auto-selects the first available site on load. You can manually switch sites using the dropdown in the top navigation bar.

### Managing Agents

Navigate to **Agents** to view all monitored endpoints for the selected site. Use the DataTable features to:
- Filter by status (online/offline/idle)
- Filter by platform (Windows/Linux/macOS)
- Search by hostname or IP address
- Sort by any column

### Managing Sites

Navigate to **Sites** to view all managed sites across all clients. Each site displays:
- Name and slug
- Status (active/inactive/archived)
- PSA Company ID (if linked to HaloPSA)
- Last updated timestamp

### HaloPSA Integration

Navigate to **HaloPSA** to manage site linking:

1. **Sync Companies**: Click "Sync from HaloPSA" button to fetch the latest companies from HaloPSA
   - Creates new entity records for new companies
   - Updates existing companies with latest data
   - Marks removed companies as deleted
   - Shows sync results (created/updated/deleted counts)
2. **View Companies**: All synced HaloPSA companies are listed on the left
3. **Search/Filter**: Use the search bar or filter dropdown to find companies
4. **Select Company**: Click a company card to view details
5. **Link to Existing Site**: Select a site from the dropdown and click "Link to Site"
6. **Create New Site**: Click "Create Site from Company" to create and link a new site
7. **Unlink**: Click "Unlink from Site" to remove the HaloPSA association

## Important Notes

⚠️ **Security Warning**: This app has NO authentication. Only run on:
- Localhost
- Behind a VPN
- Internal network only

⚠️ **Dev Only**: This is a development tool, not intended for production use

⚠️ **Shared Database**: Uses the same Convex database as the main frontend app

## Troubleshooting

### Build Errors

If you see errors like "Module not found: Can't resolve '../agents/mutate_s.js'":
- Ensure your `.env.local` is configured correctly
- Make sure the Convex backend is running
- Verify the secret is valid

### Site Selector Not Working

- Check that sites exist in the database
- Verify the Convex URL is correct
- Check browser console for errors

### HaloPSA Page Empty

- Ensure HaloPSA integration is configured as a data source
- Check that the HaloPSA data source is set as primary
- Click "Sync from HaloPSA" button to fetch companies
- Verify ENCRYPTION_KEY is set in .env.local
- Check browser console for sync errors
