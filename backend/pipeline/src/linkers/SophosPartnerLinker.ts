import { BaseLinker } from "@workspace/pipeline/linkers/BaseLinker.js";
import { natsClient } from "@workspace/pipeline/lib/nats.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import type { Doc, Id } from "@workspace/database/convex/_generated/dataModel.js";
import { client } from "@workspace/shared/lib/convex.js";
import Debug from "@workspace/shared/lib/Debug.js";
import {
    ProcessedEventPayload,
    LinkedEventPayload,
    buildEventName,
} from "@workspace/shared/types/pipeline/index.js";

export class SophosPartnerLinker extends BaseLinker {
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
        // Subscribe to processed events for firewalls and licenses
        await natsClient.subscribe(
            buildEventName("processed", "firewalls"),
            this.handleFirewallLicenseLinking.bind(this)
        );
        await natsClient.subscribe(
            buildEventName("processed", "licenses"),
            this.handleFirewallLicenseLinking.bind(this)
        );

        Debug.log({
            module: "SophosPartnerLinker",
            context: "start",
            message: "Linker started and subscribed to processed events for firewalls and licenses",
        });
    }

    /**
     * Handle linking for firewalls and licenses - link firewalls to their licenses via serial number
     */
    private async handleFirewallLicenseLinking(event: ProcessedEventPayload): Promise<void> {
        const { eventID, tenantID, integrationID, integrationType, dataSourceID, entityType } = event;

        if (integrationType !== "sophos-partner") return;

        Debug.log({
            module: "SophosPartnerLinker",
            context: "handleFirewallLicenseLinking",
            message: `Linking firewalls and licenses for event ${eventID}`,
        });

        try {
            // Get all firewalls for this data source (excluding soft-deleted)
            const allFirewalls = await client.query(api.helpers.orm.list_s, {
                tableName: "entities",
                secret: process.env.CONVEX_API_KEY!,
                index: {
                    name: "by_data_source",
                    params: {
                        dataSourceId: dataSourceID as Id<"data_sources">,
                    },
                },
                filters: {
                    entityType: "firewalls"
                },
                tenantId: tenantID as Id<"tenants">,
            }) as Doc<"entities">[];
            const firewalls = this.filterActiveEntities(allFirewalls);

            // Get all licenses for this data source (excluding soft-deleted)
            const allLicenses = await client.query(api.helpers.orm.list_s, {
                tableName: "entities",
                secret: process.env.CONVEX_API_KEY!,
                index: {
                    name: "by_data_source",
                    params: {
                        dataSourceId: dataSourceID as Id<"data_sources">,
                    },
                },
                filters: {
                    entityType: "licenses"
                },
                tenantId: tenantID as Id<"tenants">,
            }) as Doc<"entities">[];
            const licenses = this.filterActiveEntities(allLicenses);

            // Create a map of serial numbers to firewalls for efficient lookup
            const firewallsBySerial = new Map<string, Doc<"entities">>();
            for (const firewall of firewalls) {
                const serial = firewall.normalizedData?.serial;
                if (serial) {
                    firewallsBySerial.set(serial, firewall);
                }
            }

            // For each license, find the matching firewall and create relationship
            for (const license of licenses) {
                const serialNumber = license.normalizedData?.serialNumber;
                if (!serialNumber) continue;

                const firewall = firewallsBySerial.get(serialNumber);
                if (!firewall) {
                    Debug.log({
                        module: "SophosPartnerLinker",
                        context: "handleFirewallLicenseLinking",
                        message: `No firewall found for license with serial ${serialNumber}`,
                    });
                    continue;
                }

                // Check if relationship already exists
                const existingRelationships = await client.query(api.helpers.orm.list_s, {
                    tableName: "entity_relationships",
                    secret: process.env.CONVEX_API_KEY!,
                    index: {
                        name: "by_parent",
                        params: {
                            parentEntityId: firewall._id,
                        },
                    },
                } as any);

                const relationshipExists = existingRelationships.some(
                    (rel: any) => rel.childEntityId === license._id && rel.relationshipType === "has_license"
                );

                if (!relationshipExists) {
                    // Create relationship: firewall (parent) -> license (child)
                    await client.mutation(api.helpers.orm.insert_s, {
                        tableName: "entity_relationships",
                        secret: process.env.CONVEX_API_KEY!,
                        tenantId: tenantID as Id<"tenants">,
                        data: [{
                            tenantId: tenantID as Id<"tenants">,
                            parentEntityId: firewall._id,
                            dataSourceId: dataSourceID,
                            childEntityId: license._id,
                            relationshipType: "has_license",
                            metadata: {
                                serialNumber,
                            },
                            updatedAt: Date.now(),
                        }],
                    } as any);

                    Debug.log({
                        module: "SophosPartnerLinker",
                        context: "handleFirewallLicenseLinking",
                        message: `Created has_license relationship: firewall ${firewall._id} -> license ${license._id}`,
                    });
                }
            }

            // Publish linked event
            await this.publishLinkedEvent(event);
        } catch (error) {
            Debug.error({
                module: "SophosPartnerLinker",
                context: "handleFirewallLicenseLinking",
                message: `Failed to link firewalls and licenses: ${error}`,
            });
        }
    }

    /**
     * Publish a linked event after relationships are created
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
            changedEntityIds: processedEvent.changedEntityIds,
            syncMetadata: processedEvent.syncMetadata,
        };

        const topic = buildEventName("linked", processedEvent.entityType);
        await natsClient.publish(topic, linkedEvent);

        Debug.log({
            module: "SophosPartnerLinker",
            context: "publishLinkedEvent",
            message: `Published linked event for ${processedEvent.entityType} to ${topic} (${processedEvent.changedEntityIds?.length || 0} changed entities)`,
        });
    }
}
