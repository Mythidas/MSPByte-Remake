import { EntityTypes } from "@workspace/shared/types/database/entity";

export type DataFetchedEvent = {
  eventID: string;
  tenantID: string;
  integrationID: string;
  dataSourceID: string;
  entityType: EntityTypes;

  data: DataFetchPayload[];

  total: number;
  createdAt: string;
};

export type DataFetchPayload = {
  externalID: string;
  siteID?: string;

  dataHash: string;
  rawData: any;
};

export type DataProcessedEvent = {
  eventID: string;
};
