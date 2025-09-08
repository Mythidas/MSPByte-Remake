import APIClient from "@workspace/shared/lib/APIClient";
import Encryption from "@workspace/shared/lib/Encryption";
import { APIResponse } from "@workspace/shared/types/api";
import { SophosPartnerConfig } from "@workspace/shared/types/source/sophos-partner/index.js";

export default class SophosPartnerConnector {
  constructor(private config: SophosPartnerConfig) {}

  async checkHealth(): Promise<boolean> {
    return true;
  }
}
