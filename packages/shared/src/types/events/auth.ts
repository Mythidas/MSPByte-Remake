import { Tables } from "@workspace/shared/types/database/index.js";

export type AuthEvents = {
  "auth.login": Tables<"users_view">;
  "auth.logout": null;
};
