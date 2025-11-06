import Debug from "@workspace/shared/lib/Debug.js";
import { natsClient } from "@workspace/pipeline/helpers/nats.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import type { Doc } from "@workspace/database/convex/_generated/dataModel.js";
import { generateUUID } from "@workspace/shared/lib/utils.server.js";
import { SyncEventPayload } from "@workspace/shared/types/pipeline/index.js";
import { client } from "@workspace/shared/lib/convex.js";

export class Scheduler {
    private pollInterval: number = 60000; // 60 seconds (reduced from 10s to save function calls)
    private isRunning: boolean = false;

    constructor() { }

    async start(): Promise<void> {
        if (this.isRunning) return;

        this.isRunning = true;
        Debug.log({
            module: "Scheduler",
            context: "start",
            message: "Scheduler started",
        });

        // Poll for jobs every interval
        setInterval(async () => {
            await this.pollJobs();
        }, this.pollInterval);
    }

    async stop(): Promise<void> {
        this.isRunning = false;
        Debug.log({
            module: "Scheduler",
            context: "stop",
            message: "Scheduler stopped",
        });
    }

    /**
     * Bootstrap function that runs once at startup
     * Ensures all active data sources have their initial jobs scheduled
     */
    private async bootstrap(): Promise<void> {
        try {
            Debug.log({
                module: "Scheduler",
                context: "bootstrap",
                message: "Starting bootstrap: scanning for active data sources",
            });

            // Query all data sources across all tenants
            const allDataSources = (await client.query(api.helpers.orm.list_s, {
                tableName: "data_sources",
                secret: process.env.CONVEX_API_KEY!,
                includeSoftDeleted: false,
            })) as Doc<"data_sources">[];

            // Filter for active data sources
            const activeDataSources = allDataSources.filter(
                (ds) => ds.status === "active" && !ds.deletedAt
            );

            if (activeDataSources.length === 0) {
                Debug.log({
                    module: "Scheduler",
                    context: "bootstrap",
                    message: "No active data sources found",
                });
                return;
            }

            Debug.log({
                module: "Scheduler",
                context: "bootstrap",
                message: `Found ${activeDataSources.length} active data sources`,
            });

            let jobsScheduled = 0;
            let dataSourcesProcessed = 0;
            const tenantIds = new Set<string>();

            // Process each data source
            for (const dataSource of activeDataSources) {
                try {
                    // Fetch integration config
                    const integration = (await client.query(api.helpers.orm.get_s, {
                        tableName: "integrations",
                        id: dataSource.integrationId,
                        secret: process.env.CONVEX_API_KEY!,
                    })) as any;

                    if (!integration) {
                        Debug.log({
                            module: "Scheduler",
                            context: "bootstrap",
                            message: `Integration not found for data source ${dataSource._id}`,
                        });
                        continue;
                    }

                    tenantIds.add(dataSource.tenantId);
                    const currentTime = Date.now();
                    const metadata = (dataSource.metadata as Record<string, any>) || {};

                    // Schedule jobs for each global type
                    for (const type of integration.supportedTypes) {
                        if (!type.isGlobal) continue;

                        const action = `sync.${type.type}`;
                        const priority = type.priority ?? 5;
                        const rateMinutes = type.rateMinutes ?? 60;
                        const rateMs = rateMinutes * 60 * 1000;

                        // Check last sync time from metadata
                        const lastSyncAt = metadata[action] || 0;
                        const nextAllowedTime = lastSyncAt + rateMs;
                        const scheduledAt =
                            currentTime >= nextAllowedTime ? currentTime : nextAllowedTime;

                        // Check if a pending job already exists
                        const existingJobs = (await client.query(api.helpers.orm.list_s, {
                            tableName: "scheduled_jobs",
                            secret: process.env.CONVEX_API_KEY!,
                            index: {
                                name: "by_data_source_status",
                                params: {
                                    dataSourceId: dataSource._id,
                                    status: "pending",
                                },
                            },
                        })) as Doc<"scheduled_jobs">[];

                        const existingPendingJob = existingJobs.find((j) => j.action === action);

                        if (existingPendingJob) {
                            continue; // Skip if job already exists
                        }

                        // Create the job
                        await client.mutation(api.helpers.orm.insert_s, {
                            tableName: "scheduled_jobs",
                            secret: process.env.CONVEX_API_KEY!,
                            tenantId: dataSource.tenantId,
                            data: [
                                {
                                    integrationId: dataSource.integrationId,
                                    integrationSlug: integration.slug,
                                    dataSourceId: dataSource._id,
                                    action,
                                    payload: {},
                                    priority,
                                    status: "pending",
                                    attempts: 0,
                                    attemptsMax: 3,
                                    scheduledAt,
                                    createdBy: "bootstrap",
                                    updatedAt: currentTime,
                                },
                            ],
                        });

                        jobsScheduled++;
                    }

                    dataSourcesProcessed++;
                } catch (error) {
                    Debug.error({
                        module: "Scheduler",
                        context: "bootstrap",
                        message: `Error processing data source ${dataSource._id}: ${error}`,
                    });
                }
            }

            Debug.log({
                module: "Scheduler",
                context: "bootstrap",
                message: `Bootstrap completed: ${jobsScheduled} jobs scheduled for ${dataSourcesProcessed} data sources across ${tenantIds.size} tenants`,
            });
        } catch (error) {
            Debug.error({
                module: "Scheduler",
                context: "bootstrap",
                message: `Bootstrap failed: ${error}`,
            });
        }
    }

    private async pollJobs(): Promise<void> {
        try {
            // Query for pending jobs (will be sorted by priority in-memory)
            const jobs = (await client.query(api.helpers.orm.list_s, {
                tableName: "scheduled_jobs",
                secret: process.env.CONVEX_API_KEY!,
                index: {
                    name: "by_status",
                    params: { status: "pending" },
                },
            })) as Doc<"scheduled_jobs">[];

            if (!jobs || jobs.length === 0) {
                return;
            }

            // Filter for due jobs under retry limit
            const dueJobs = jobs.filter((job) => {
                const isDue = job.scheduledAt <= Date.now();
                const underRetryLimit = (job.attempts || 0) < (job.attemptsMax || 3);
                return isDue && underRetryLimit;
            });

            if (dueJobs.length === 0) {
                return;
            }

            // Sort by priority (DESC) then scheduledAt (ASC)
            // Higher priority numbers run first, ties broken by earliest scheduled time
            dueJobs.sort((a, b) => {
                const priorityA = a.priority || 5;
                const priorityB = b.priority || 5;
                if (priorityA !== priorityB) {
                    return priorityB - priorityA; // Higher priority first
                }
                return a.scheduledAt - b.scheduledAt; // Earlier scheduled first
            });

            // Get running jobs to check concurrency limits
            const runningJobs = (await client.query(api.helpers.orm.list_s, {
                tableName: "scheduled_jobs",
                secret: process.env.CONVEX_API_KEY!,
                index: {
                    name: "by_status",
                    params: { status: "running" },
                },
            })) as Doc<"scheduled_jobs">[];

            // Count running jobs per tenant
            const runningJobsByTenant = new Map<string, number>();
            for (const job of runningJobs) {
                const count = runningJobsByTenant.get(job.tenantId) || 0;
                runningJobsByTenant.set(job.tenantId, count + 1);
            }

            // Get tenant limits
            const tenantLimits = new Map<string, number>();
            const uniqueTenantIds = [...new Set(dueJobs.map(j => j.tenantId))];
            for (const tenantId of uniqueTenantIds) {
                const tenant = await client.query(api.tenants.query.get_s, {
                    id: tenantId,
                    secret: process.env.CONVEX_API_KEY!,
                });
                tenantLimits.set(tenantId, (tenant as any)?.concurrentJobLimit || 5);
            }

            Debug.log({
                module: "Scheduler",
                context: "pollJobs",
                message: `Polling for Jobs: ${dueJobs.length} due jobs, ${runningJobs.length} running`,
            });

            // Process jobs respecting per-tenant concurrency limits
            let processedCount = 0;
            for (const job of dueJobs) {
                const runningCount = runningJobsByTenant.get(job.tenantId) || 0;
                const limit = tenantLimits.get(job.tenantId) || 5;

                if (runningCount >= limit) {
                    Debug.log({
                        module: "Scheduler",
                        context: "pollJobs",
                        message: `Tenant ${job.tenantId} at limit (${runningCount}/${limit}), skipping job ${job._id}`,
                    });
                    continue;
                }

                await this.processJob(job);

                // Update running count for this tenant
                runningJobsByTenant.set(job.tenantId, runningCount + 1);
                processedCount++;
            }

            if (processedCount > 0) {
                Debug.log({
                    module: "Scheduler",
                    context: "pollJobs",
                    message: `Processed ${processedCount} jobs`,
                });
            }
        } catch (error) {
            Debug.error({
                module: "Scheduler",
                context: "pollJobs",
                message: `Error polling jobs: ${error}`,
            });
        }
    }

    private async processJob(job: Doc<"scheduled_jobs">): Promise<void> {
        try {
            Debug.log({
                module: "Scheduler",
                context: "processJob",
                message: `Processing job ${job._id} for action ${job.action}`,
            });

            await client.mutation(api.helpers.orm.update_s, {
                tableName: "scheduled_jobs",
                data: [
                    {
                        id: job._id,
                        updates: {
                            status: "running",
                            startedAt: Date.now(),
                        },
                    },
                ],
                secret: process.env.CONVEX_API_KEY!,
            });

            // Action format: "sync.identities"
            const actionParts = job.action.split(".");
            if (actionParts.length === 2 && actionParts[0] === "sync") {
                const topic = `${job.integrationSlug}.${job.action}`;
                await natsClient.publish(topic, {
                    job,
                    eventID: generateUUID(),
                    tenantID: job.tenantId,
                    integrationID: job.integrationId,
                    dataSourceID: job.dataSourceId,

                    integrationType: job.integrationSlug as any,
                    entityType: actionParts[1],
                    stage: "sync",
                    createdAt: new Date().getTime(),
                } as SyncEventPayload);

                Debug.log({
                    module: "Scheduler",
                    context: "processJob",
                    message: `Job ${job._id} published to ${topic}`,
                });
            } else {
                throw new Error(`Invalid action format: ${job.action}`);
            }
        } catch (error) {
            Debug.error({
                module: "Scheduler",
                context: "processJob",
                message: `Failed to process job ${job._id}`,
            });

            await Scheduler.failJob(job, error as string);
        }
    }

    public static async failJob(job: Doc<"scheduled_jobs">, error: string) {
        const attempts = job.attempts || 0;
        const attemptsMax = job.attemptsMax || 3;
        const invalid = attempts >= attemptsMax;

        await client.mutation(api.helpers.orm.update_s, {
            tableName: "scheduled_jobs",
            data: [
                {
                    id: job._id,
                    updates: {
                        status: invalid ? "failed" : "failed",
                        error,
                        attempts: attempts + 1,
                        nextRetryAt: Date.now() + 60000,
                    },
                },
            ],
            secret: process.env.CONVEX_API_KEY!,
        });
    }

    public static async completeJob(
        job: Doc<"scheduled_jobs">,
        dataSource?: Doc<"data_sources">,
        action?: string
    ) {
        const completionTime = Date.now();

        await client.mutation(api.helpers.orm.update_s, {
            tableName: "scheduled_jobs",
            data: [
                {
                    id: job._id,
                    updates: {
                        status: "completed",
                    },
                },
            ],
            secret: process.env.CONVEX_API_KEY!,
        });

        if (dataSource && action) {
            // Update data source metadata with last sync time
            await client.mutation(api.helpers.orm.update_s, {
                tableName: "data_sources",
                data: [
                    {
                        id: dataSource._id,
                        updates: {
                            metadata: {
                                ...(dataSource.metadata as any),
                                [action]: completionTime,
                            },
                        },
                    },
                ],
                secret: process.env.CONVEX_API_KEY!,
            });

            // Automatically schedule the next iteration based on rate limit
            await Scheduler.scheduleNextIteration(job, dataSource, action, completionTime);
        }
    }

    /**
     * Schedules the next iteration of a job based on rate limiting configuration
     * Only called after a job (or final batch) completes successfully
     */
    private static async scheduleNextIteration(
        job: Doc<"scheduled_jobs">,
        dataSource: Doc<"data_sources">,
        action: string,
        lastSyncTime: number
    ) {
        try {
            // Get integration to fetch rate and priority config
            const integration = (await client.query(api.helpers.orm.get_s, {
                tableName: "integrations",
                id: job.integrationId,
                secret: process.env.CONVEX_API_KEY!,
            })) as any;

            if (!integration) {
                Debug.error({
                    module: "Scheduler",
                    context: "scheduleNextIteration",
                    message: `Integration not found: ${job.integrationId}`,
                });
                return;
            }

            // Extract entity type from action (e.g., "sync.identities" -> "identities")
            const entityType = action.replace("sync.", "");

            // Find the matching supportedType configuration
            const typeConfig = integration.supportedTypes.find(
                (t: any) => t.type === entityType
            );

            if (!typeConfig) {
                Debug.error({
                    module: "Scheduler",
                    context: "scheduleNextIteration",
                    message: `Type config not found for ${entityType}`,
                });
                return;
            }

            const priority = typeConfig.priority ?? 5;
            const rateMinutes = typeConfig.rateMinutes ?? 60;
            const rateMs = rateMinutes * 60 * 1000;

            // Calculate next scheduled time based on rate limit
            const nextScheduledAt = lastSyncTime + rateMs;

            // Check if a pending job already exists for this action
            const existingJobs = (await client.query(api.helpers.orm.list_s, {
                tableName: "scheduled_jobs",
                secret: process.env.CONVEX_API_KEY!,
                index: {
                    name: "by_data_source_status",
                    params: {
                        dataSourceId: dataSource._id,
                        status: "pending",
                    },
                },
            })) as Doc<"scheduled_jobs">[];

            const existingPendingJob = existingJobs.find((j) => j.action === action);

            if (existingPendingJob) {
                Debug.log({
                    module: "Scheduler",
                    context: "scheduleNextIteration",
                    message: `Skipping ${action}: pending job already exists`,
                });
                return;
            }

            // Create the next scheduled job
            await client.mutation(api.helpers.orm.insert_s, {
                tableName: "scheduled_jobs",
                secret: process.env.CONVEX_API_KEY!,
                tenantId: job.tenantId,
                data: [
                    {
                        integrationId: job.integrationId,
                        integrationSlug: job.integrationSlug,
                        dataSourceId: dataSource._id,
                        action,
                        payload: {},
                        priority,
                        status: "pending",
                        attempts: 0,
                        attemptsMax: job.attemptsMax || 3,
                        scheduledAt: nextScheduledAt,
                        createdBy: "auto-schedule",
                        updatedAt: Date.now(),
                    },
                ],
            });

            const nextRunIn = Math.round((nextScheduledAt - Date.now()) / 60000);
            Debug.log({
                module: "Scheduler",
                context: "scheduleNextIteration",
                message: `Scheduled next ${action} in ${nextRunIn} minutes (priority: ${priority})`,
            });
        } catch (error) {
            Debug.error({
                module: "Scheduler",
                context: "scheduleNextIteration",
                message: `Failed to schedule next iteration: ${error}`,
            });
        }
    }

    public static async scheduleNextBatch(
        currentJob: Doc<"scheduled_jobs">,
        cursor: string,
        syncId: string,
        batchNumber: number,
        totalProcessed: number
    ) {
        // Boost priority for pagination batches to complete in-progress syncs faster
        const basePriority = currentJob.priority || 5;
        const boostedPriority = basePriority + 10;

        await client.mutation(api.helpers.orm.insert_s, {
            tableName: "scheduled_jobs",
            secret: process.env.CONVEX_API_KEY!,
            tenantId: currentJob.tenantId,
            data: [
                {
                    integrationId: currentJob.integrationId,
                    integrationSlug: currentJob.integrationSlug,
                    dataSourceId: currentJob.dataSourceId,
                    action: currentJob.action,
                    priority: boostedPriority, // Boost priority for continuation batches
                    status: "pending",
                    attempts: 0,
                    attemptsMax: currentJob.attemptsMax,
                    scheduledAt: Date.now(), // Execute immediately
                    createdBy: "pagination",
                    updatedAt: Date.now(),
                    payload: {
                        cursor,
                        syncId,
                        batchNumber,
                        totalProcessed,
                        startedAt: (currentJob.payload as any)?.startedAt || Date.now(),
                    },
                },
            ],
        });

        Debug.log({
            module: "Scheduler",
            context: "scheduleNextBatch",
            message: `Scheduled batch ${batchNumber} with priority ${boostedPriority} (boosted from ${basePriority}) for job ${currentJob._id} (syncId: ${syncId})`,
        });
    }
}
