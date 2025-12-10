import {
    BaseProcessor,
    PolicyData,
} from "./BaseProcessor.js";
import Logger from "../lib/logger.js";
import { MSGraphConditionalAccessPolicy } from "@workspace/shared/types/integrations/microsoft-365/policies.js";
import {
    IntegrationType,
    DataFetchPayload,
} from "@workspace/shared/types/pipeline/index.js";

export class PolicyProcessor extends BaseProcessor {
    constructor() {
        super("policies");
    }

    protected normalizeData(
        integrationType: IntegrationType,
        data: DataFetchPayload[]
    ): PolicyData[] {
        switch (integrationType) {
            case "microsoft-365":
                return this.fromMicrosoft365(data);
            default: {
                Logger.log({
                    module: "PolicyProcessor",
                    context: "normalizeData",
                    message: `No normalizer for this data: ${integrationType}`,
                    level: "error",
                });
                return [];
            }
        }
    }

    private fromMicrosoft365(data: DataFetchPayload[]) {
        return data.map((row) => {
            if (row.externalID === 'security-defaults') {
                const isEnabled = row.rawData as boolean;
                return {
                    externalID: row.externalID,
                    raw: row.rawData,
                    hash: row.dataHash,
                    normalized: {
                        externalId: row.externalID,

                        name: 'Security Defaults',
                        description: 'Azure AD Security Defaults provide baseline security policies',
                        status: isEnabled ? 'enabled' : 'disabled',
                        createdAt: 0
                    }
                } as PolicyData
            }

            const { rawData, dataHash } = row as {
                rawData: MSGraphConditionalAccessPolicy;
                dataHash: string;
            };

            // Create a description from the policy conditions
            const description = this.createPolicyDescription(rawData);

            // Map the state to normalized status
            const status = rawData.state === 'enabled'
                ? 'enabled'
                : rawData.state === 'enabledForReportingButNotEnforced'
                    ? 'report-only'
                    : 'disabled';

            return {
                externalID: String(rawData.id),
                raw: rawData,
                hash: dataHash,
                normalized: {
                    externalId: rawData.id,

                    name: rawData.displayName,
                    description,
                    status,
                    createdAt: parseInt(rawData.createdDateTime)
                },
            } as PolicyData;
        });
    }

    private createPolicyDescription(policy: MSGraphConditionalAccessPolicy): string {
        const parts: string[] = [];

        // Add user targeting info
        if (policy.conditions?.users) {
            const { includeUsers, includeGroups } = policy.conditions.users;
            if (includeUsers?.includes('All')) {
                parts.push('Applies to all users');
            } else if (includeUsers?.length || includeGroups?.length) {
                parts.push(`Targets ${includeUsers?.length || 0} users and ${includeGroups?.length || 0} groups`);
            }
        }

        // Add grant controls info
        if (policy.grantControls?.builtInControls) {
            const controls = policy.grantControls.builtInControls;
            if (controls.includes('mfa')) {
                parts.push('Requires MFA');
            }
            if (controls.includes('compliantDevice')) {
                parts.push('Requires compliant device');
            }
        }

        return parts.length > 0 ? parts.join(', ') : 'Conditional access policy';
    }
}
