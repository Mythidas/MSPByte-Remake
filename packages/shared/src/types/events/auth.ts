import { Tables } from "@workspace/shared/types/database";

export type AuthEvents = {
  "auth.login": Tables<"users_view">;
  "auth.logout": null;
};
