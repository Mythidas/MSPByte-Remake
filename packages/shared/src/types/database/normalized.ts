export type Company = {
  external_id: string;
  external_parent_id?: string;

  name: string;
  type: "customer" | "prospect";
  address: string;

  created_at: string;
};

export type Endpoint = {
  external_id: string;
};
