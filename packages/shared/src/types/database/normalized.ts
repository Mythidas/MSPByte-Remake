export type Company = {
  external_id: string;
  name: string;
  address: string;
  type: "customer" | "prospect";
  created_at: string;
};
