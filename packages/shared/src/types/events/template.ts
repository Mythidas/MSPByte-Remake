export type DataEventTemplate<T> = {
  job_id: string;
  tenant_id: string;
  integration_id: string;
  site_id?: string;
  dataType: T;
  data: {
    external_id: string;
    data_hash: string;
    raw_data: any;
  }[];
  total: number;
  created_at: string;
};
