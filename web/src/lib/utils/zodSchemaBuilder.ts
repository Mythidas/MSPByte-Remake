import { z } from "zod";

export default function zodSchemaBuilder(
  config: Record<string, { label: string; sensitive?: boolean }>
) {
  const shape: Record<string, z.ZodString> = {};

  for (const key of Object.keys(config)) {
    shape[key] = z.string().min(1);
  }

  return z.object(shape);
}
