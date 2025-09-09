import { DataEventTemplate } from "@workspace/shared/types/events/template.js";

export type CompanyEvents = {
  "*.companies.fetched": DataEventTemplate<"companies">;
};
