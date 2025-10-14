import Debug from "@workspace/shared/lib/Debug.js";

export abstract class BaseWorker {
  protected entityType: string;

  constructor(entityType: string) {
    this.entityType = entityType;
  }

  async start(): Promise<void> {
    const topic = `${this.entityType}.linked`;
    Debug.log({
      module: "BaseWorker",
      context: this.constructor.name,
      message: `Started, listening to ${topic}`,
    });
  }
}
