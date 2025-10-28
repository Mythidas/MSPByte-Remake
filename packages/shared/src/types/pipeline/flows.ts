import {
    EntityType,
    PipelineStage,
    IntegrationType,
} from "@workspace/shared/types/pipeline/core.js";

// Standard flow definition - defines the normal progression through pipeline stages
export type StandardFlow<E extends EntityType> = {
    [K in PipelineStage]?: PipelineStage | null; // null means terminal stage
};

// Standard flows for most entities follow this pattern
const defaultEntityFlow: StandardFlow<EntityType> = {
    sync: "fetched",
    fetched: "processed",
    processed: "linked",
    linked: "completed",
    completed: null,
    failed: null,
};

// Define standard flows for each entity type
export const StandardFlows: Record<EntityType, StandardFlow<EntityType>> = {
    companies: defaultEntityFlow,
    endpoints: defaultEntityFlow,
    identities: defaultEntityFlow,
    groups: defaultEntityFlow,
    firewalls: defaultEntityFlow,
    roles: defaultEntityFlow,
    policies: defaultEntityFlow

    // Special case: license_assignments might not always need entity storage
    // licenseAssignments: {
    //   sync: "fetched",
    //   fetched: "processed", // Can go to processed for storage
    //   processed: "linked",
    //   resolved: "linked", // Or can be resolved directly to linking
    //   linked: "completed",
    //   completed: null,
    //   failed: null,
    // },
};

// Custom flows allow integrations to override standard behavior
export type CustomFlow = {
    integration: IntegrationType;
    entity: EntityType;
    overrides: Partial<StandardFlow<EntityType>>;
    conditions?: {
        // Conditions under which this custom flow applies
        dataSourceType?: string;
        hasSpecialConfig?: boolean;
        customField?: string;
    };
};

// Custom flow definitions for specific integration behaviors
export const CustomFlows: CustomFlow[] = [
    // {
    //   integration: "microsoft-365",
    //   entity: "licenseAssignments",
    //   overrides: {
    //     // Microsoft365 license assignments skip entity storage and go directly to relationship creation
    //     sync: "fetched",
    //     fetched: "resolved", // Skip processed stage
    //     resolved: "linked",
    //     linked: "completed",
    //   },
    // },
];

// Flow resolution utilities
export type FlowResolver = {
    getNextStage: (
        currentStage: PipelineStage,
        entityType: EntityType,
        integrationType: IntegrationType,
        metadata?: any
    ) => PipelineStage | null;

    isValidTransition: (
        fromStage: PipelineStage,
        toStage: PipelineStage,
        entityType: EntityType,
        integrationType: IntegrationType
    ) => boolean;

    getAvailableTransitions: (
        currentStage: PipelineStage,
        entityType: EntityType,
        integrationType: IntegrationType
    ) => PipelineStage[];
};

// Type for valid stage combinations based on flows
export type ValidEventTransition<
    E extends EntityType = EntityType,
    I extends IntegrationType = IntegrationType,
    CurrentStage extends PipelineStage = PipelineStage,
> = {
    from: `${CurrentStage}.${E}`;
    to: PipelineStage extends infer NextStage
    ? NextStage extends PipelineStage
    ? `${NextStage}.${E}`
    : never
    : never;
    integration: I;
};
