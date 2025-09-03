import { SupabaseClient } from "@supabase/supabase-js";
import CompanyNormalizer from "@workspace/services/normalizers/companies-normalizer.js";
import { IProcessor } from "@workspace/services/processors/processor.js";
import { createClient } from "@workspace/shared/lib/db/client.js";
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

export default class CompanyProcessor implements IProcessor {
  private nats: NatsConnection | undefined;
  private jc = JSONCodec();
  private subscriptions: Map<string, Subscription> = new Map();
  private supabase: SupabaseClient<Database>;

  constructor() {
    this.supabase = createClient() as unknown as SupabaseClient<Database>;
  }

  async start(): Promise<void> {
    this.nats = await connect({ servers: process.env.NATS_URL });

    this.subscriptions.set(
      "*.companies.fetched",
      this.nats.subscribe("*.companies.fetched", {
        callback: this.processCompaniesEvent.bind(this),
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

  private async processCompaniesEvent(err: NatsError | null, msg: Msg) {
    if (err) {
      console.log(err);
      return;
    }

    try {
      const eventData = this.jc.decode(
        msg.data
      ) as EventPayload<"*.companies.fetched">;

      Debug.log({
        module: "Services",
        context: "CompaniesProcessor",
        message: `Processing companies from ${eventData.integration_id}`,
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
          module: "CompanyProcessor",
          context: "processCompaniesEvent",
          message: String(err),
        });
        return;
      }

      const changedCompanies = eventData.data.filter((company) => {
        const existing = existingData.data.rows.find(
          (e) => e.external_id === company.external_id
        );
        return existing?.data_hash !== company.data_hash;
      });

      if (changedCompanies.length === 0) {
        Debug.log({
          module: "CompanyProcessor",
          context: "processCompaniesEvent",
          message: "No company changes detected",
        });
        return;
      }

      await this.processCompanies(
        eventData.tenant_id,
        eventData.integration_id,
        changedCompanies
      );

      this.nats?.publish(
        "companies.processed",
        this.jc.encode({
          processedCount: changedCompanies.length,
          skippedCount: eventData.total - changedCompanies.length,
          processed_at: new Date().toISOString(),
        })
      );
    } catch (err) {
      Debug.error({
        module: "CompanyProcessor",
        context: "processCompaniesEvent",
        message: String(err),
        code: "PRCS_GENERIC_ERROR",
      });
      return;
    }
  }

  private async processCompanies(
    tenantId: string,
    integrationId: string,
    companies: {
      external_id: string;
      data_hash: string;
      raw_data: any;
    }[]
  ) {
    const normalized = CompanyNormalizer.normalize(
      integrationId,
      companies.map((c) => c.raw_data)
    );
    const records = companies.map((company) => {
      const normalized_data = normalized.find(
        (c) => c.external_id === company.external_id
      );

      return {
        tenant_id: tenantId,
        integration_id: integrationId,
        external_id: company.external_id,
        entity_type: "company",
        data_hash: company.data_hash,
        normalized_data: normalized_data,
        raw_data: company.raw_data,
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
        module: "CompanyProcessor",
        context: "processCompanies",
        message: `Failed to upsert entities: ${error.message}`,
        code: "PRCS_DB_ERROR",
      });
    }

    for (const company of data) {
      this.nats?.publish(
        "entity.company.processed",
        this.jc.encode({
          entity_id: company.id,
          entity_type: "company",
          external_id: company.external_id,
          tenant_id: tenantId,
          integration_id: integrationId,
          action: "upsert",
        })
      );
    }

    Debug.log({
      module: "CompanyProcessor",
      context: "processCompanies",
      message: "Companies processed successfully",
    });
  }
}
