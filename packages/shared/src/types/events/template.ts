export type DataEventTemplate = {
  job_id: string;
  tenant_id: string;
  integration_id: string;
  dataType: "companies";
  data: {
    external_id: string;
    data_hash: string;
    raw_data: any;
  }[];
  total: number;
  created_at: string;
};
