export type AutoTaskResponse<T> = {
  items: T[];
  pageDetails: AutoTaskPageDetails;
};

export type AutoTaskResponseSingle<T> = {
  item: T;
};

export type AutoTaskPageDetails = {
  count: number;
  requestCount: number;
  prevPageUrl: string;
  nextPageUrl: string;
};

export type AutoTaskUserDefinedField = {
  name: string;
  value: string;
};

export type AutoTaskDataSourceConfig = {
  server: string;
  clientId: string;
  trackerId: string;
  clientSecret: string;
};

export type AutoTaskSearch<T> = {
  filter: {
    op:
      | "eq"
      | "noteq"
      | "gt"
      | "gte"
      | "lt"
      | "lte"
      | "beginsWith"
      | "endsWith"
      | "contains"
      | "exist"
      | "notExist"
      | "in"
      | "notIn";
    field: keyof T;
    value: unknown;
  }[];
};
