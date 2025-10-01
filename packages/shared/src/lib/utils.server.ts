"use server";

import { randomUUID } from "node:crypto";

export async function generateUUID(sentinel?: boolean): Promise<string> {
  if (sentinel) return "00000000-0000-0000-0000-000000000000";
  return randomUUID();
}
