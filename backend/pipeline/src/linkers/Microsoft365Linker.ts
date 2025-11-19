import { BaseLinker } from "@workspace/pipeline/linkers/BaseLinker.js";
import { natsClient } from "@workspace/pipeline/helpers/nats.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import type { Doc, Id } from "@workspace/database/convex/_generated/dataModel.js";
import { client } from "@workspace/shared/lib/convex.js";
import Debug from "@workspace/shared/lib/Debug.js";
import Microsoft365Connector from "@workspace/shared/lib/connectors/Microsoft365Connector.js";
import { Microsoft365DataSourceConfig } from "@workspace/shared/types/integrations/microsoft-365/index.js";
import {
    ProcessedEventPayload,
    LinkedEventPayload,
    buildEventName,
} from "@workspace/shared/types/pipeline/index.js";

export class Microsoft365Linker extends BaseLinker {
    constructor() {
        super();
    }

    /**
     * Helper method to filter out soft-deleted entities
     */
    private filterActiveEntities<T extends Doc<"entities">>(entities: T[]): T[] {
        return entities.filter((entity) => !entity.deletedAt);
    }

    async start(): Promise<void> {
        // Subscribe to processed events for entities that need linking
        await natsClient.subscribe(
            buildEventName("processed", "groups"),
            this.handleGroupLinking.bind(this)
        );
        await natsClient.subscribe(
            buildEventName("processed", "roles"),
            this.handleRoleLinking.bind(this)
        );
        await natsClient.subscribe(
            buildEventName("processed", "policies"),
            this.handlePolicyLinking.bind(this)
        );
        await natsClient.subscribe(
            buildEventName("processed", "identities"),
            this.handleIdentityLicenseLinking.bind(this)
        );
        await natsClient.subscribe(
            buildEventName("processed", "licenses"),
            this.handleLicenses.bind(this)
        );

        Debug.log({
            module: "Microsoft365Linker",
            context: "start",
            message: "Linker started and subscribed to processed events",
        });
    }

    /**
     * Handle linking for groups - fetch group members and create relationships
     */
    private async handleGroupLinking(event: ProcessedEventPayload): Promise<void> {
        const { eventID, tenantID, integrationID, integrationType, dataSourceID, entityType } = event;

        if (integrationType !== "microsoft-365") return;

        Debug.log({
            module: "Microsoft365Linker",
            context: "handleGroupLinking",
            message: `Linking groups for event ${eventID}`,
        });

        try {
            // Get the data source to access connector
            const dataSource = await client.query(api.helpers.orm.get_s, {
                tableName: "data_sources",
                id: dataSourceID as Id<"data_sources">,
                secret: process.env.CONVEX_API_KEY!
            }) as Doc<"data_sources">;

            if (!dataSource) {
                throw new Error(`Data source ${dataSourceID} not found`);
            }

            const config = dataSource.config as Microsoft365DataSourceConfig;
            const connector = new Microsoft365Connector(config);

            // Get all group entities for this data source (excluding soft-deleted)
            const allGroups = await client.query(api.helpers.orm.list_s, {
                tableName: "entities",
                secret: process.env.CONVEX_API_KEY!,
                index: {
                    name: "by_data_source",
                    params: {
                        dataSourceId: dataSourceID as Id<"data_sources">,
                        tenantId: tenantID as Id<"tenants">,
                    },
                },
                filters: {
                    entityType: "groups"
                }
            }) as Doc<"entities">[];
            const groups = this.filterActiveEntities(allGroups);

            // For each group, fetch members and create relationships
            for (const group of groups) {
                const { data: members, error } = await connector.getGroupMembers(
                    group.externalId
                );

                if (error) {
                    Debug.error({
                        module: "Microsoft365Linker",
                        context: "handleGroupLinking",
                        message: `Failed to fetch members for group ${group.externalId}: ${error.message}`,
                    });
                    continue;
                }

                // Find identity entities matching the members
                for (const member of members) {
                    const identity = await client.query(api.helpers.orm.get_s, {
                        tableName: "entities",
                        secret: process.env.CONVEX_API_KEY!,
                        index: {
                            name: "by_external_id",
                            params: {
                                externalId: member.id,
                            },
                        },
                        tenantId: tenantID as Id<"tenants">,
                    }) as Doc<"entities">;

                    // Skip soft-deleted identities
                    if (identity && identity.entityType === "identities" && !identity.deletedAt) {
                        // Check if relationship already exists
                        const existingRelationships = await client.query(api.helpers.orm.list_s, {
                            tableName: "entity_relationships",
                            secret: process.env.CONVEX_API_KEY!,
                            index: {
                                name: "by_parent",
                                params: {
                                    parentEntityId: group._id,
                                },
                            },
                        } as any);

                        const relationshipExists = existingRelationships.some(
                            (rel: any) => rel.childEntityId === identity._id && rel.relationshipType === "member_of"
                        );

                        if (!relationshipExists) {
                            // Create relationship: identity (child) -> group (parent)
                            await client.mutation(api.helpers.orm.insert_s, {
                                tableName: "entity_relationships",
                                secret: process.env.CONVEX_API_KEY!,
                                tenantId: tenantID as Id<"tenants">,
                                data: [{
                                    tenantId: tenantID as Id<"tenants">,
                                    parentEntityId: group._id,
                                    dataSourceId: dataSourceID,
                                    childEntityId: identity._id,
                                    relationshipType: "member_of",
                                    metadata: {},
                                    updatedAt: Date.now(),
                                }],
                            } as any);
                        }
                    }
                }
            }

            // Publish linked event
            await this.publishLinkedEvent(event);
        } catch (error) {
            Debug.error({
                module: "Microsoft365Linker",
                context: "handleGroupLinking",
                message: `Failed to link groups: ${error}`,
            });
        }
    }

    /**
     * Handle linking for roles - fetch role members and create relationships
     */
    private async handleRoleLinking(event: ProcessedEventPayload): Promise<void> {
        const { eventID, tenantID, integrationID, integrationType, dataSourceID, entityType } = event;

        if (integrationType !== "microsoft-365") return;

        Debug.log({
            module: "Microsoft365Linker",
            context: "handleRoleLinking",
            message: `Linking roles for event ${eventID}`,
        });

        try {
            const dataSource = await client.query(api.helpers.orm.get_s, {
                tableName: "data_sources",
                id: dataSourceID as Id<"data_sources">,
                secret: process.env.CONVEX_API_KEY!
            }) as Doc<"data_sources">;

            if (!dataSource) {
                throw new Error(`Data source ${dataSourceID} not found`);
            }

            const config = dataSource.config as Microsoft365DataSourceConfig;
            const connector = new Microsoft365Connector(config);

            // Get all role entities for this data source (excluding soft-deleted)
            const allRoles = await client.query(api.helpers.orm.list_s, {
                tableName: "entities",
                secret: process.env.CONVEX_API_KEY!,
                index: {
                    name: "by_data_source",
                    params: {
                        dataSourceId: dataSourceID as Id<"data_sources">,
                        tenantId: tenantID as Id<"tenants">,
                    },
                },
                filters: {
                    entityType: "roles"
                }
            }) as Doc<"entities">[];
            const roles = this.filterActiveEntities(allRoles);

            // For each role, fetch members and create relationships
            for (const role of roles) {
                const { data: members, error } = await connector.getRoleMembers(role.externalId);

                if (error) {
                    Debug.error({
                        module: "Microsoft365Linker",
                        context: "handleRoleLinking",
                        message: `Failed to fetch members for role ${role.externalId}: ${error.message}`,
                    });
                    continue;
                }

                // Find identity entities matching the members and add Admin tag
                for (const member of members) {
                    const identity = await client.query(api.helpers.orm.get_s, {
                        tableName: "entities",
                        secret: process.env.CONVEX_API_KEY!,
                        index: {
                            name: "by_external_id",
                            params: {
                                externalId: member.id,
                            },
                        },
                        tenantId: tenantID as Id<"tenants">,
                    }) as Doc<"entities"> | null;

                    // Skip soft-deleted identities
                    if (identity && identity.entityType === "identities" && !identity.deletedAt) {
                        // Check if relationship already exists
                        const existingRelationships = await client.query(api.helpers.orm.list_s, {
                            tableName: "entity_relationships",
                            secret: process.env.CONVEX_API_KEY!,
                            index: {
                                name: "by_parent",
                                params: {
                                    parentEntityId: role._id,
                                },
                            },
                        });

                        const relationshipExists = existingRelationships.some(
                            (rel: any) => rel.childEntityId === identity._id && rel.relationshipType === "assigned_role"
                        );

                        if (!relationshipExists) {
                            // Create relationship: identity (child) -> role (parent)
                            await client.mutation(api.helpers.orm.insert_s, {
                                tableName: "entity_relationships",
                                secret: process.env.CONVEX_API_KEY!,
                                tenantId: tenantID as Id<"tenants">,
                                data: [{
                                    tenantId: tenantID as Id<"tenants">,
                                    dataSourceId: dataSourceID,
                                    parentEntityId: role._id,
                                    childEntityId: identity._id,
                                    relationshipType: "assigned_role",
                                    metadata: {},
                                    updatedAt: Date.now(),
                                }],
                            });
                        }
                    }
                }
            }

            // Compute Admin tags after role relationships are established
            await this.computeAdminTags(tenantID as Id<"tenants">, dataSourceID);

            await this.publishLinkedEvent(event);
        } catch (error) {
            Debug.error({
                module: "Microsoft365Linker",
                context: "handleRoleLinking",
                message: `Failed to link roles: ${error}`,
            });
        }
    }

    /**
     * Compute and update Admin tags for all identities based on role assignments
     */
    private async computeAdminTags(tenantID: Id<"tenants">, dataSourceID: string): Promise<void> {
        Debug.log({
            module: "Microsoft365Linker",
            context: "computeAdminTags",
            message: "Computing Admin tags for all identities",
        });

        try {
            // Get all role entities
            const allRoles = await client.query(api.helpers.orm.list_s, {
                tableName: "entities",
                secret: process.env.CONVEX_API_KEY!,
                index: {
                    name: "by_data_source",
                    params: {
                        dataSourceId: dataSourceID as Id<"data_sources">,
                        tenantId: tenantID,
                    },
                },
                filters: {
                    entityType: "roles"
                }
            }) as Doc<"entities">[];

            // Filter admin roles by name (any role with "Administrator" in the name)
            const adminRoles = allRoles.filter(role => {
                const roleName = role.normalizedData.name || "";
                return roleName.toLowerCase().includes("administrator");
            });

            const adminRoleIds = new Set(adminRoles.map(r => r._id));

            Debug.log({
                module: "Microsoft365Linker",
                context: "computeAdminTags",
                message: `Found ${adminRoles.length} admin roles out of ${allRoles.length} total roles`,
            });

            // Get all identities for this data source
            const allIdentities = await client.query(api.helpers.orm.list_s, {
                tableName: "entities",
                secret: process.env.CONVEX_API_KEY!,
                index: {
                    name: "by_data_source",
                    params: {
                        dataSourceId: dataSourceID as Id<"data_sources">,
                        tenantId: tenantID,
                    },
                },
                filters: {
                    entityType: "identities"
                }
            }) as Doc<"entities">[];

            const identities = this.filterActiveEntities(allIdentities);

            // Get all identities assigned to admin roles
            // Loop through each admin role and fetch its members
            const identityHasAdminRole = new Map<Id<"entities">, boolean>();

            for (const adminRole of adminRoles) {
                const roleAssignments = await client.query(api.helpers.orm.list_s, {
                    tableName: "entity_relationships",
                    secret: process.env.CONVEX_API_KEY!,
                    index: {
                        name: "by_parent",
                        params: {
                            parentEntityId: adminRole._id,
                        },
                    },
                    filters: {
                        relationshipType: "assigned_role"
                    }
                }) as Doc<"entity_relationships">[];

                // Mark all identities assigned to this admin role
                for (const assignment of roleAssignments) {
                    identityHasAdminRole.set(assignment.childEntityId, true);
                }
            }

            // Prepare tag updates
            const tagUpdates: Array<{ id: Id<"entities">; updates: any }> = [];
            let adminsAdded = 0;
            let adminsRemoved = 0;

            for (const identity of identities) {
                const currentTags = [...(identity.normalizedData.tags || [])];
                const hasAdminTag = currentTags.includes("Admin");
                const hasAdminRole = identityHasAdminRole.get(identity._id) || false;

                if (hasAdminRole && !hasAdminTag) {
                    // Add Admin tag
                    currentTags.push("Admin");
                    tagUpdates.push({
                        id: identity._id,
                        updates: {
                            normalizedData: {
                                ...identity.normalizedData,
                                tags: currentTags,
                            },
                            updatedAt: Date.now(),
                        },
                    });
                    adminsAdded++;
                } else if (!hasAdminRole && hasAdminTag) {
                    // Remove Admin tag
                    const idx = currentTags.indexOf("Admin");
                    if (idx > -1) currentTags.splice(idx, 1);
                    tagUpdates.push({
                        id: identity._id,
                        updates: {
                            normalizedData: {
                                ...identity.normalizedData,
                                tags: currentTags,
                            },
                            updatedAt: Date.now(),
                        },
                    });
                    adminsRemoved++;
                }
            }

            // Batch update tags
            if (tagUpdates.length > 0) {
                await client.mutation(api.helpers.orm.update_s, {
                    tableName: "entities",
                    secret: process.env.CONVEX_API_KEY!,
                    data: tagUpdates,
                });

                Debug.log({
                    module: "Microsoft365Linker",
                    context: "computeAdminTags",
                    message: `Admin tag updates: +${adminsAdded}/-${adminsRemoved} (${tagUpdates.length} total updates)`,
                });
            } else {
                Debug.log({
                    module: "Microsoft365Linker",
                    context: "computeAdminTags",
                    message: "No Admin tag updates needed",
                });
            }
        } catch (error) {
            Debug.error({
                module: "Microsoft365Linker",
                context: "computeAdminTags",
                message: `Failed to compute Admin tags: ${error}`,
            });
        }
    }

    /**
     * Handle linking for policies - parse policy conditions and create relationships
     */
    private async handlePolicyLinking(event: ProcessedEventPayload): Promise<void> {
        const { eventID, tenantID, integrationID, integrationType, dataSourceID, entityType } = event;

        if (integrationType !== "microsoft-365") return;

        Debug.log({
            module: "Microsoft365Linker",
            context: "handlePolicyLinking",
            message: `Linking policies for event ${eventID}`,
        });

        try {
            // Get all policy entities for this data source (excluding soft-deleted)
            const allPolicies = await client.query(api.helpers.orm.list_s, {
                tableName: "entities",
                secret: process.env.CONVEX_API_KEY!,
                index: {
                    name: "by_data_source",
                    params: {
                        dataSourceId: dataSourceID as Id<"data_sources">,
                        tenantId: tenantID as Id<"tenants">,
                    },
                },
                filters: {
                    entityType: "policies"
                }
            }) as Doc<"entities">[];
            const policies = this.filterActiveEntities(allPolicies);

            for (const policy of policies) {
                // Skip security-defaults special entity
                if (policy.externalId === "security-defaults") continue;

                const rawData = policy.rawData;
                const conditions = rawData.conditions;

                if (!conditions || !conditions.users) continue;

                const { includeUsers, includeGroups } = conditions.users;

                // Link to identities
                if (includeUsers) {
                    for (const userId of includeUsers) {
                        // Handle special "All" keyword
                        if (userId === "All") {
                            // Create a special metadata-only relationship or skip
                            continue;
                        }

                        const identity = await client.query(api.helpers.orm.get_s, {
                            tableName: "entities",
                            secret: process.env.CONVEX_API_KEY!,
                            index: {
                                name: "by_external_id",
                                params: {
                                    externalId: userId,
                                },
                            },
                            tenantId: tenantID as Id<"tenants">,
                        }) as Doc<"entities"> | null;

                        // Skip soft-deleted identities
                        if (identity && identity.entityType === "identities" && !identity.deletedAt) {
                            // Check if relationship already exists
                            const existingRelationships = await client.query(api.helpers.orm.list_s, {
                                tableName: "entity_relationships",
                                secret: process.env.CONVEX_API_KEY!,
                                index: {
                                    name: "by_parent",
                                    params: {
                                        parentEntityId: policy._id,
                                    },
                                },
                            });

                            const relationshipExists = existingRelationships.some(
                                (rel: any) => rel.childEntityId === identity._id && rel.relationshipType === "applies_to"
                            );

                            if (!relationshipExists) {
                                await client.mutation(api.helpers.orm.insert_s, {
                                    tableName: "entity_relationships",
                                    secret: process.env.CONVEX_API_KEY!,
                                    tenantId: tenantID as Id<"tenants">,
                                    data: [{
                                        tenantId: tenantID as Id<"tenants">,
                                        dataSourceId: dataSourceID,
                                        parentEntityId: policy._id,
                                        childEntityId: identity._id,
                                        relationshipType: "applies_to",
                                        metadata: { policyType: "conditional_access" },
                                        updatedAt: Date.now(),
                                    }],
                                });
                            }
                        }
                    }
                }

                // Link to groups
                if (includeGroups) {
                    for (const groupId of includeGroups) {
                        const group = await client.query(api.helpers.orm.get_s, {
                            tableName: "entities",
                            secret: process.env.CONVEX_API_KEY!,
                            index: {
                                name: "by_external_id",
                                params: {
                                    externalId: groupId,
                                },
                            },
                            tenantId: tenantID as Id<"tenants">,
                        }) as Doc<"entities"> | null;

                        // Skip soft-deleted groups
                        if (group && group.entityType === "groups" && !group.deletedAt) {
                            // Check if relationship already exists
                            const existingRelationships = await client.query(api.helpers.orm.list_s, {
                                tableName: "entity_relationships",
                                secret: process.env.CONVEX_API_KEY!,
                                index: {
                                    name: "by_parent",
                                    params: {
                                        parentEntityId: policy._id,
                                    },
                                },
                            });

                            const relationshipExists = existingRelationships.some(
                                (rel: any) => rel.childEntityId === group._id && rel.relationshipType === "applies_to"
                            );

                            if (!relationshipExists) {
                                await client.mutation(api.helpers.orm.insert_s, {
                                    tableName: "entity_relationships",
                                    secret: process.env.CONVEX_API_KEY!,
                                    tenantId: tenantID as Id<"tenants">,
                                    data: [{
                                        tenantId: tenantID as Id<"tenants">,
                                        dataSourceId: dataSourceID,
                                        parentEntityId: policy._id,
                                        childEntityId: group._id,
                                        relationshipType: "applies_to",
                                        metadata: { policyType: "conditional_access" },
                                        updatedAt: Date.now(),
                                    }],
                                });
                            }
                        }
                    }
                }
            }

            await this.publishLinkedEvent(event);
        } catch (error) {
            Debug.error({
                module: "Microsoft365Linker",
                context: "handlePolicyLinking",
                message: `Failed to link policies: ${error}`,
            });
        }
    }

    /**
     * Handle linking for identities - link to licenses based on assignedLicenses
     */
    private async handleIdentityLicenseLinking(event: ProcessedEventPayload): Promise<void> {
        const { eventID, tenantID, integrationID, integrationType, dataSourceID, entityType } = event;

        if (integrationType !== "microsoft-365") return;

        Debug.log({
            module: "Microsoft365Linker",
            context: "handleIdentityLicenseLinking",
            message: `Linking identity licenses for event ${eventID}`,
        });

        try {
            // Get all identity entities for this data source (excluding soft-deleted)
            const allIdentities = await client.query(api.helpers.orm.list_s, {
                tableName: "entities",
                secret: process.env.CONVEX_API_KEY!,
                index: {
                    name: "by_data_source",
                    params: {
                        dataSourceId: dataSourceID as Id<"data_sources">,
                        tenantId: tenantID as Id<"tenants">,
                    },
                },
                filters: {
                    entityType: "identities"
                }
            }) as Doc<"entities">[];
            const identities = this.filterActiveEntities(allIdentities);

            for (const identity of identities) {
                const licenses = identity.normalizedData.licenses || [];

                // Link to license entities
                for (const licenseSkuId of licenses) {
                    const license = await client.query(api.helpers.orm.get_s, {
                        tableName: "entities",
                        secret: process.env.CONVEX_API_KEY!,
                        index: {
                            name: "by_external_id",
                            params: {
                                externalId: licenseSkuId,
                            },
                        },
                        tenantId: tenantID as Id<"tenants">,
                    }) as Doc<"entities"> | null;

                    // Skip soft-deleted licenses
                    if (license && license.entityType === "licenses" && !license.deletedAt) {
                        // Check if relationship already exists
                        const existingRelationships = await client.query(api.helpers.orm.list_s, {
                            tableName: "entity_relationships",
                            secret: process.env.CONVEX_API_KEY!,
                            index: {
                                name: "by_parent",
                                params: {
                                    parentEntityId: license._id,
                                },
                            },
                        });

                        const relationshipExists = existingRelationships.some(
                            (rel: any) => rel.childEntityId === identity._id && rel.relationshipType === "has_license"
                        );

                        if (!relationshipExists) {
                            await client.mutation(api.helpers.orm.insert_s, {
                                tableName: "entity_relationships",
                                secret: process.env.CONVEX_API_KEY!,
                                tenantId: tenantID as Id<"tenants">,
                                data: [{
                                    tenantId: tenantID as Id<"tenants">,
                                    dataSourceId: dataSourceID,
                                    parentEntityId: license._id,
                                    childEntityId: identity._id,
                                    relationshipType: "has_license",
                                    metadata: {},
                                    updatedAt: Date.now(),
                                }],
                            });
                        }
                    }
                }
            }

            await this.publishLinkedEvent(event);
        } catch (error) {
            Debug.error({
                module: "Microsoft365Linker",
                context: "handleIdentityLicenseLinking",
                message: `Failed to link identity licenses: ${error}`,
            });
        }
    }

    /**
     * Handle licenses - pass through without linking since licenses don't have relationships
     */
    private async handleLicenses(processedEvent: ProcessedEventPayload): Promise<void> {
        Debug.log({
            module: "Microsoft365Linker",
            context: "handleLicenses",
            message: `Processing licenses for event ${processedEvent.eventID}`,
        });

        try {
            // Licenses don't require any relationship linking
            // Simply pass through to linked stage so workers can analyze them
            await this.publishLinkedEvent(processedEvent);
        } catch (error) {
            Debug.error({
                module: "Microsoft365Linker",
                context: "handleLicenses",
                message: `Failed to process licenses: ${error}`,
            });
        }
    }

    /**
     * Publish a linked event to move to the next pipeline stage
     */
    private async publishLinkedEvent(processedEvent: ProcessedEventPayload): Promise<void> {
        const linkedEvent: LinkedEventPayload = {
            eventID: processedEvent.eventID,
            tenantID: processedEvent.tenantID,
            integrationID: processedEvent.integrationID,
            integrationType: processedEvent.integrationType,
            dataSourceID: processedEvent.dataSourceID,
            entityType: processedEvent.entityType,
            stage: "linked",
            createdAt: Date.now(),
            relationshipsCreated: [],
            relationshipsUpdated: [],
            changedEntityIds: processedEvent.changedEntityIds, // Forward changedEntityIds from processed event
            syncMetadata: processedEvent.syncMetadata, // Forward syncMetadata for pagination tracking
        };

        const topic = buildEventName("linked", processedEvent.entityType);
        await natsClient.publish(topic, linkedEvent);

        Debug.log({
            module: "Microsoft365Linker",
            context: "publishLinkedEvent",
            message: `Published linked event for ${processedEvent.entityType} to ${topic} (${processedEvent.changedEntityIds?.length || 0} changed entities)`,
        });
    }
}
