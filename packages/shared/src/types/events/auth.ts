import { Tables } from "@workspace/shared/types/database/import.js";

export type AuthEvents = {
  "auth.login": Tables<"users_with_role">;
  "auth.logout": null;
};
