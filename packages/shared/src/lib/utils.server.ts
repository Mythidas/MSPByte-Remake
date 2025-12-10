"use server";

import { randomUUID } from "node:crypto";

export function generateUUID(sentinel?: boolean): string {
  if (sentinel) return "00000000-0000-0000-0000-000000000000";
  return randomUUID();
}
