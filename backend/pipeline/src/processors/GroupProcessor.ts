import {
  BaseProcessor,
  ProcessedEntityData,
} from "@workspace/pipeline/processors/BaseProcessor";
import {
  IntegrationType,
  DataFetchPayload,
} from "@workspace/shared/types/pipeline";

export class GroupProcessor extends BaseProcessor {
  constructor() {
    super("groups");
  }

  protected normalizeData(
    integrationType: IntegrationType,
    data: DataFetchPayload[]
  ): ProcessedEntityData<any>[] {
    throw new Error("Method not implemented.");
  }
}
