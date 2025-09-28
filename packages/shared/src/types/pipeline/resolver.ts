import { PipelineEventPayload } from "@workspace/shared/types/events/index";
import {
  PipelineStage,
  EntityType,
  IntegrationType,
} from "@workspace/shared/types/pipeline/core";
import {
  FlowResolver,
  CustomFlows,
  StandardFlows,
} from "@workspace/shared/types/pipeline/flows";

// Flow resolution implementation
export const flowResolver: FlowResolver = {
  getNextStage: (
    currentStage: PipelineStage,
    entityType: EntityType,
    integrationType: IntegrationType,
    metadata?: any
  ): PipelineStage | null => {
    // First check for custom flows that apply to this integration/entity combination
    const customFlow = CustomFlows.find(
      (flow) =>
        flow.integration === integrationType &&
        flow.entity === entityType &&
        (!flow.conditions || evaluateConditions(flow.conditions, metadata))
    );

    if (customFlow?.overrides[currentStage] !== undefined) {
      return customFlow.overrides[currentStage] || null;
    }

    // Fall back to standard flow
    const standardFlow = StandardFlows[entityType];
    return standardFlow?.[currentStage] || null;
  },

  isValidTransition: (
    fromStage: PipelineStage,
    toStage: PipelineStage,
    entityType: EntityType,
    integrationType: IntegrationType
  ): boolean => {
    const nextStage = flowResolver.getNextStage(
      fromStage,
      entityType,
      integrationType
    );
    return nextStage === toStage;
  },

  getAvailableTransitions: (
    currentStage: PipelineStage,
    entityType: EntityType,
    integrationType: IntegrationType
  ): PipelineStage[] => {
    const nextStage = flowResolver.getNextStage(
      currentStage,
      entityType,
      integrationType
    );

    // Also include potential error states and manual overrides
    const transitions = nextStage ? [nextStage] : [];

    // Always allow transition to failed state
    if (currentStage !== "failed") {
      transitions.push("failed");
    }

    // Allow manual override to resolved state in certain cases
    if (currentStage === "fetched" && !transitions.includes("resolved")) {
      transitions.push("resolved");
    }

    return transitions;
  },
};

// Helper function to evaluate custom flow conditions
function evaluateConditions(
  conditions: NonNullable<(typeof CustomFlows)[0]["conditions"]>,
  metadata?: any
): boolean {
  if (
    conditions.dataSourceType &&
    metadata?.dataSourceType !== conditions.dataSourceType
  ) {
    return false;
  }

  if (
    conditions.hasSpecialConfig !== undefined &&
    metadata?.hasSpecialConfig !== conditions.hasSpecialConfig
  ) {
    return false;
  }

  if (
    conditions.customField &&
    !metadata?.customFields?.[conditions.customField]
  ) {
    return false;
  }

  return true;
}

// Type guards for event payloads
export function isSyncEvent(
  event: PipelineEventPayload
): event is PipelineEventPayload & { stage: "sync" } {
  return event.stage === "sync";
}

export function isFetchedEvent(
  event: PipelineEventPayload
): event is PipelineEventPayload & { stage: "fetched" } {
  return event.stage === "fetched";
}

export function isProcessedEvent(
  event: PipelineEventPayload
): event is PipelineEventPayload & { stage: "processed" } {
  return event.stage === "processed";
}

export function isResolvedEvent(
  event: PipelineEventPayload
): event is PipelineEventPayload & { stage: "resolved" } {
  return event.stage === "resolved";
}

export function isLinkedEvent(
  event: PipelineEventPayload
): event is PipelineEventPayload & { stage: "linked" } {
  return event.stage === "linked";
}

export function isCompletedEvent(
  event: PipelineEventPayload
): event is PipelineEventPayload & { stage: "completed" } {
  return event.stage === "completed";
}

export function isFailedEvent(
  event: PipelineEventPayload
): event is PipelineEventPayload & { stage: "failed" } {
  return event.stage === "failed";
}

// Event name validation and construction utilities
export function buildEventName<S extends PipelineStage, E extends EntityType>(
  stage: S,
  entityType: E
): `${S}.${E}` {
  return `${stage}.${entityType}`;
}

export function parseEventName(
  eventName: string
): { stage: PipelineStage; entityType: EntityType } | null {
  const parts = eventName.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [stage, entityType] = parts;

  // Validate stage and entityType are valid
  const validStages: PipelineStage[] = [
    "sync",
    "fetched",
    "processed",
    "resolved",
    "linked",
    "completed",
    "failed",
  ];
  const validEntityTypes: EntityType[] = [
    "companies",
    "endpoints",
    "contacts",
    "tickets",
    "assets",
    "users",
    "licenses",
    "license_assignments",
    "billing_records",
    "identities",
  ];

  if (
    !validStages.includes(stage as PipelineStage) ||
    !validEntityTypes.includes(entityType as EntityType)
  ) {
    return null;
  }

  return {
    stage: stage as PipelineStage,
    entityType: entityType as EntityType,
  };
}

// Utility to validate event flow
export function validateEventFlow(
  fromEvent: string,
  toEvent: string,
  integrationType: IntegrationType
): { isValid: boolean; reason?: string } {
  const fromParsed = parseEventName(fromEvent);
  const toParsed = parseEventName(toEvent);

  if (!fromParsed || !toParsed) {
    return { isValid: false, reason: "Invalid event name format" };
  }

  if (fromParsed.entityType !== toParsed.entityType) {
    return { isValid: false, reason: "Entity type mismatch between events" };
  }

  const isValid = flowResolver.isValidTransition(
    fromParsed.stage,
    toParsed.stage,
    fromParsed.entityType,
    integrationType
  );

  if (!isValid) {
    return {
      isValid: false,
      reason: `Invalid transition from ${fromParsed.stage} to ${toParsed.stage} for ${fromParsed.entityType} in ${integrationType}`,
    };
  }

  return { isValid: true };
}
