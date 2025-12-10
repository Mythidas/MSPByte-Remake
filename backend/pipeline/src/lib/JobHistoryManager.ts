import { ConvexHttpClient } from "convex/browser";
import { api } from "@workspace/database/convex/_generated/api.js";
import { Logger } from "./logger.js";
import type { Id } from "@workspace/database/convex/_generated/dataModel";
import type { IntegrationId } from "@workspace/shared/types/integrations";

/**
 * Job metrics structure matching job_history.metrics schema
 */
export interface JobMetrics {
    // Stage durations (milliseconds)
    adapter_ms?: number;
    processor_ms?: number;
    linker_ms?: number;
    analyzer_ms?: number;

    // Convex function call counts
    convex_queries?: number;
    convex_mutations?: number;
    convex_actions?: number;

    // External API calls
    api_calls?: number;

    // Entity changes
    entities_created?: number;
    entities_updated?: number;
    entities_deleted?: number;
    entities_unchanged?: number;

    // Error details (if failed)
    error_message?: string;
    error_stack?: string;
    retry_count?: number;
}

/**
 * JobHistoryManager - Manages job_history record lifecycle
 *
 * Responsibilities:
 * 1. Create job_history records when pipeline completes
 * 2. Track complete pipeline metrics (aggregated from all stages)
 * 3. Support both successful and failed job tracking
 *
 * Usage:
 * - Called at the END of the analyzer stage (final stage)
 * - Receives aggregated metrics from all previous stages
 * - Creates a single record per complete pipeline run
 */
export class JobHistoryManager {
    private convex: ConvexHttpClient;
    private secret: string;

    constructor(convexUrl: string) {
        this.convex = new ConvexHttpClient(convexUrl);

        // Validate CONVEX_API_KEY is set
        this.secret = process.env.CONVEX_API_KEY || "";
        if (!this.secret) {
            throw new Error("CONVEX_API_KEY environment variable is required for JobHistoryManager");
        }
    }

    /**
     * Create a job_history record for a completed or failed pipeline run
     */
    async createJobHistory(params: {
        tenantId: Id<"tenants">;
        integrationId: IntegrationId;
        dataSourceId: Id<"data_sources">;
        action: string; // e.g., "sync.identities", "sync.groups"
        status: "completed" | "failed";
        startedAt: number;
        completedAt: number;
        metrics: JobMetrics;
    }): Promise<Id<"job_history">> {
        const { tenantId, integrationId, dataSourceId, action, status, startedAt, completedAt, metrics } =
            params;

        const duration_ms = completedAt - startedAt;

        Logger.log({
            module: "JobHistoryManager",
            context: "createJobHistory",
            message: `Creating job_history record for ${action} (${status}, ${duration_ms}ms)`,
            level: "info",
        });

        // Create job_history record
        const jobHistoryId = (await this.convex.mutation(api.helpers.orm.insert_s, {
            tableName: "job_history",
            tenantId,
            data: [
                {
                    tenantId,
                    integrationId,
                    dataSourceId,
                    action,
                    status,
                    startedAt,
                    completedAt,
                    duration_ms,
                    metrics,
                    updatedAt: Date.now(),
                },
            ],
            secret: this.secret,
        })) as Id<"job_history">[];

        Logger.log({
            module: "JobHistoryManager",
            context: "createJobHistory",
            message: `Created job_history record: ${jobHistoryId[0]}`,
            level: "trace",
        });

        return jobHistoryId[0];
    }

    /**
     * Get job history summary for a datasource
     * Useful for analyzing performance over time
     */
    async getJobHistorySummary(
        tenantId: Id<"tenants">,
        dataSourceId: Id<"data_sources">,
        limit: number = 100
    ): Promise<{
        total: number;
        completed: number;
        failed: number;
        avgDuration: number;
        recentJobs: any[];
    }> {
        const jobs = (await this.convex.query(api.helpers.orm.list_s, {
            tableName: "job_history",
            tenantId,
            secret: this.secret,
            filters: {
                dataSourceId,
            },
        })) as any[];

        // Sort by completedAt descending
        jobs.sort((a, b) => b.completedAt - a.completedAt);

        const completed = jobs.filter((j) => j.status === "completed");
        const failed = jobs.filter((j) => j.status === "failed");

        const avgDuration =
            completed.length > 0
                ? completed.reduce((sum, j) => sum + j.duration_ms, 0) / completed.length
                : 0;

        return {
            total: jobs.length,
            completed: completed.length,
            failed: failed.length,
            avgDuration: Math.round(avgDuration),
            recentJobs: jobs.slice(0, limit),
        };
    }

    /**
     * Analyze bottlenecks for a specific action type
     * Returns average stage durations to identify slow stages
     */
    async analyzeBottlenecks(
        tenantId: Id<"tenants">,
        action: string
    ): Promise<{
        totalJobs: number;
        avgStageDurations: {
            adapter_ms: number;
            processor_ms: number;
            linker_ms: number;
            analyzer_ms: number;
        };
        avgConvexCalls: {
            queries: number;
            mutations: number;
        };
        avgApiCalls: number;
    }> {
        const jobs = (await this.convex.query(api.helpers.orm.list_s, {
            tableName: "job_history",
            tenantId,
            secret: this.secret,
            filters: {
                action,
                status: "completed",
            },
        })) as any[];

        if (jobs.length === 0) {
            return {
                totalJobs: 0,
                avgStageDurations: {
                    adapter_ms: 0,
                    processor_ms: 0,
                    linker_ms: 0,
                    analyzer_ms: 0,
                },
                avgConvexCalls: {
                    queries: 0,
                    mutations: 0,
                },
                avgApiCalls: 0,
            };
        }

        const sum = jobs.reduce(
            (acc, job) => {
                const m = job.metrics || {};
                return {
                    adapter_ms: acc.adapter_ms + (m.adapter_ms || 0),
                    processor_ms: acc.processor_ms + (m.processor_ms || 0),
                    linker_ms: acc.linker_ms + (m.linker_ms || 0),
                    analyzer_ms: acc.analyzer_ms + (m.analyzer_ms || 0),
                    queries: acc.queries + (m.convex_queries || 0),
                    mutations: acc.mutations + (m.convex_mutations || 0),
                    apiCalls: acc.apiCalls + (m.api_calls || 0),
                };
            },
            {
                adapter_ms: 0,
                processor_ms: 0,
                linker_ms: 0,
                analyzer_ms: 0,
                queries: 0,
                mutations: 0,
                apiCalls: 0,
            }
        );

        const count = jobs.length;

        return {
            totalJobs: count,
            avgStageDurations: {
                adapter_ms: Math.round(sum.adapter_ms / count),
                processor_ms: Math.round(sum.processor_ms / count),
                linker_ms: Math.round(sum.linker_ms / count),
                analyzer_ms: Math.round(sum.analyzer_ms / count),
            },
            avgConvexCalls: {
                queries: Math.round(sum.queries / count),
                mutations: Math.round(sum.mutations / count),
            },
            avgApiCalls: Math.round(sum.apiCalls / count),
        };
    }
}
