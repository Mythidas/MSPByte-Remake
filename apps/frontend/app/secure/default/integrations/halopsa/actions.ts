"use server";

import Encryption from "@workspace/shared/lib/Encryption";
import type { HaloPSAConfig } from "@workspace/shared/types/integrations/halopsa";
import { client } from "@workspace/shared/lib/convex";
import { api } from "@/lib/api";
import { INTEGRATIONS } from "@workspace/shared/types/integrations/config";

export async function testConnection(config: HaloPSAConfig) {
  try {
    const secret = config.clientSecret.includes(":")
      ? await Encryption.decrypt(
          config.clientSecret,
          process.env.ENCRYPTION_KEY!,
        )
      : config.clientSecret;

    const response = await fetch(`${config.url}/auth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.clientId,
        client_secret: secret || "",
        scope: "all",
      }),
    });

    if (!response.ok) {
      return { data: false, error: response.text };
    } else {
      return { data: true };
    }
  } catch (error: unknown) {
    return { data: false, error: error };
  }
}

export async function encryptSensitiveConfig(config: HaloPSAConfig) {
  try {
    const processed: Record<string, string> = {
      clientId: config.clientId,
      url: config.url,
      clientSecret: await Encryption.encrypt(
        config.clientSecret,
        process.env.NEXT_ENCRYPTION_KEY!,
      ),
    };

    return { data: processed, error: null };
  } catch (error: unknown) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to encrypt configuration",
    };
  }
}
