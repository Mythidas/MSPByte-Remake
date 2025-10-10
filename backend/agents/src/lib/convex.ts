/**
 * Secure HTTP client for calling Convex internal functions via HTTP actions
 * This replaces the ConvexHttpClient for server-to-server communication
 */

// Type definitions for Agent data
export interface Agent {
  _id: string;
  _creationTime: number;
  tenantId: string;
  siteId: string;
  guid: string;
  hostname: string;
  platform: string;
  version: string;
  ipAddress?: string;
  macAddress?: string;
  extAddress?: string;
  registeredAt?: number;
  lastCheckinAt?: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

const CONVEX_URL = process.env.CONVEX_URL;
const CONVEX_API_KEY = process.env.CONVEX_API_KEY;

if (!CONVEX_URL) {
  throw new Error(
    "CONVEX_URL environment variable is not set. " +
      "Please add it to your .env file."
  );
}

if (!CONVEX_API_KEY) {
  throw new Error(
    "CONVEX_API_KEY environment variable is not set. " +
      "Please add it to your .env file."
  );
}

// Extract the deployment name from the Convex URL
// CONVEX_URL format: https://[deployment].convex.cloud
const deploymentMatch = CONVEX_URL.match(
  /https:\/\/([^.]+)\.convex\.(cloud|site)/
);
if (!deploymentMatch) {
  throw new Error(`Invalid CONVEX_URL format: ${CONVEX_URL}`);
}

const CONVEX_SITE_URL = `https://${deploymentMatch[1]}.convex.site`;

/**
 * Call a Convex HTTP action with authentication
 */
async function callConvexHttpAction<T>(
  endpoint: string,
  body: any
): Promise<T> {
  const response = await fetch(`${CONVEX_SITE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Convex-Secret": CONVEX_API_KEY || "",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(
      `Convex HTTP action failed (${response.status}): ${errorData.error || "Unknown error"}`
    );
  }

  return response.json();
}

/**
 * Agent API functions
 */
export const convexAgents = {
  /**
   * Get an agent by ID
   */
  async get(id: string): Promise<Agent | null> {
    return callConvexHttpAction<Agent | null>("/api/agents/get", { id });
  },

  /**
   * Update an agent
   */
  async update(data: {
    id: string;
    siteId?: string;
    guid?: string;
    hostname?: string;
    platform?: string;
    version?: string;
    ipAddress?: string;
    macAddress?: string;
    extAddress?: string;
    lastCheckinAt?: number;
    deletedAt?: number;
  }): Promise<{ success: boolean }> {
    return callConvexHttpAction("/api/agents/update", data);
  },

  /**
   * Create an API log entry
   */
  async createApiLog(data: {
    tenantId: string;
    siteId: string;
    agentId: string;
    endpoint: string;
    method: string;
    statusCode: number;
    externalId?: string;
    psaSiteId?: string;
    rmmDeviceId?: string;
    reqMetadata: any;
    resMetadata: any;
    timeElapsedMs?: number;
    errorMessage?: string;
  }): Promise<{ success: boolean }> {
    return callConvexHttpAction("/api/agents/log", data);
  },
};

// Export for backward compatibility (to be removed after migration)
export const convex = convexAgents;
