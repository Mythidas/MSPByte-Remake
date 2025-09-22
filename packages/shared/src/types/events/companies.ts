import { DataEventTemplate } from "@workspace/shared/types/events/template";

export type CompanyEvents = {
  "*.companies.fetched": DataEventTemplate<"companies">;
};
