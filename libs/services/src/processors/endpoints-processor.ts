import { SupabaseClient } from "@supabase/supabase-js";
import CompanyNormalizer from "@workspace/services/normalizers/companies-normalizer.js";
import EndpointNormalizer from "@workspace/services/normalizers/endpoints-normalizer.js";
import { IProcessor } from "@workspace/services/processors/processor.js";
import { createPrivelagedClient } from "@workspace/shared/lib/db/client.js";
import { getRows } from "@workspace/shared/lib/db/orm.js";
import Debug from "@workspace/shared/lib/Debug.js";
import { Database } from "@workspace/shared/types/database/import.js";
import { TablesInsert } from "@workspace/shared/types/database/index.js";
import { EventPayload } from "@workspace/shared/types/events/index.js";
import {
  NatsConnection,
  JSONCodec,
  Subscription,
  connect,
  Msg,
  NatsError,
} from "nats";

export default class EndpointProcessor implements IProcessor {
  private nats: NatsConnection | undefined;
  private jc = JSONCodec();
  private subscriptions: Map<string, Subscription> = new Map();
  private supabase: SupabaseClient<Database>;

  constructor() {
    this.supabase =
      createPrivelagedClient() as unknown as SupabaseClient<Database>;
  }

  async start(): Promise<void> {
    this.nats = await connect({ servers: process.env.NATS_URL });

    this.subscriptions.set(
      "*.endpoints.fetched",
      this.nats.subscribe("*.endpoints.fetched", {
        callback: this.processEndpointsEvent.bind(this),
      })
    );
  }

  async stop(): Promise<void> {
    for (const [k, v] of this.subscriptions.entries()) {
      v.unsubscribe();
    }
  }

  async connected(): Promise<boolean> {
    return true;
  }

  private async processEndpointsEvent(err: NatsError | null, msg: Msg) {
    if (err) {
      console.log(err);
      return;
    }

    try {
      const eventData = this.jc.decode(
        msg.data
      ) as EventPayload<"*.endpoints.fetched">;

      Debug.log({
        module: "Services",
        context: "EndpointProcessor",
        message: `Processing endpoints from ${eventData.integration_id}`,
      });

      const existingData = await getRows("entities", {
        filters: [
          ["integration_id", "eq", eventData.integration_id],
          ["entity_type", "eq", eventData.dataType],
          ["tenant_id", "eq", eventData.tenant_id],
        ],
        selects: ["external_id", "data_hash"],
      });
      if (existingData.error) {
        Debug.log({
          module: "EndpointProcessor",
          context: "processEndpointsEvent",
          message: String(err),
        });
        return;
      }

      const changedEndpoints = eventData.data.filter((company) => {
        const existing = existingData.data.rows.find(
          (e) => e.external_id === company.external_id
        );
        return existing?.data_hash !== company.data_hash;
      });

      if (changedEndpoints.length === 0) {
        Debug.log({
          module: "EndpointProcessor",
          context: "processEndpointsEvent",
          message: "No endpoint changes detected",
        });
        return;
      }

      await this.processEndpoints(
        eventData.tenant_id,
        eventData.integration_id,
        changedEndpoints,
        eventData.site_id
      );

      this.nats?.publish(
        "endpoints.processed",
        this.jc.encode({
          processedCount: changedEndpoints.length,
          skippedCount: eventData.total - changedEndpoints.length,
          processed_at: new Date().toISOString(),
        })
      );
    } catch (err) {
      Debug.error({
        module: "EndpointProcessor",
        context: "processEndpointsEvent",
        message: String(err),
        code: "PRCS_GENERIC_ERROR",
      });
      return;
    }
  }

  private async processEndpoints(
    tenantId: string,
    integrationId: string,
    endpoints: {
      external_id: string;
      data_hash: string;
      raw_data: any;
    }[],
    siteId?: string
  ) {
    const normalized = EndpointNormalizer.normalize(
      integrationId,
      endpoints.map((c) => c.raw_data)
    );
    const records = endpoints.map((endpoint) => {
      const normalized_data = normalized.find(
        (c) => c.external_id === endpoint.external_id
      );

      return {
        tenant_id: tenantId,
        integration_id: integrationId,
        external_id: endpoint.external_id,
        site_id: siteId,
        entity_type: "endpoint",
        data_hash: endpoint.data_hash,
        normalized_data: normalized_data,
        raw_data: endpoint.raw_data,
      } as TablesInsert<"entities">;
    });

    const { data, error } = await this.supabase
      .from("entities")
      .upsert(records, {
        onConflict: "tenant_id,entity_type,integration_id,external_id",
      })
      .select("id,external_id");

    if (error) {
      return Debug.error({
        module: "EndpointProcessor",
        context: "processEndpoints",
        message: `Failed to upsert entities: ${error.message}`,
        code: "PRCS_DB_ERROR",
      });
    }

    for (const company of data) {
      this.nats?.publish(
        "entity.endpoints.processed",
        this.jc.encode({
          entity_id: company.id,
          entity_type: "endpoint",
          external_id: company.external_id,
          tenant_id: tenantId,
          integration_id: integrationId,
          action: "upsert",
        })
      );
    }

    Debug.log({
      module: "EndpointProcessor",
      context: "processEndpoints",
      message: "Endpoints processed successfully",
    });
  }
}
