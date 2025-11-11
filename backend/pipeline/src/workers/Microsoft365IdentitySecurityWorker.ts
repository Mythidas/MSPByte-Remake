import { BaseWorkerV2 } from "./base-v2.js";
import { Node, NodeContext } from "../nodes/types.js";
import { FetchEntitiesNode } from "../nodes/core/FetchEntitiesNode.js";
import { UpdateAdminTagsNode } from "../nodes/integrations/microsoft365/UpdateAdminTagsNode.js";
import { EvaluateMFAEnforcementNode } from "../nodes/integrations/microsoft365/EvaluateMFAEnforcementNode.js";
import { ProcessMFAPartialEnforcedNode } from "../nodes/integrations/microsoft365/ProcessMFAPartialEnforcedNode.js";
import { BatchUpdateEntitiesNode } from "../nodes/core/BatchUpdateEntitiesNode.js";
import { CalculateIdentityStateNode } from "../nodes/core/CalculateIdentityStateNode.js";

/**
 * Microsoft 365 Identity Security Worker
 *
 * Combined worker that handles both admin tag management and MFA partial enforcement monitoring.
 * This ensures admin tags are applied BEFORE MFA evaluation, preventing false positives
 * where admins are flagged as having partial MFA coverage.
 *
 * Workflow:
 * 1. Fetch identities (incremental or full)
 * 2. Update Admin tags based on role assignments
 * 3. Evaluate MFA enforcement status (can now see Admin tags)
 * 4. Process MFA partial enforced alerts and update MFA tags
 * 5. Batch update all tags (Admin + MFA)
 * 6. Calculate and update identity states
 * 7. Batch update states
 * 8. Flush all batched operations
 *
 * This replaces:
 * - Microsoft365AdminTagWorker
 * - Microsoft365MFAPartialEnforcedWorker
 */
export class Microsoft365IdentitySecurityWorker extends BaseWorkerV2 {
    constructor() {
        // Depend on identities, policies, and roles
        super(["identities", "policies", "roles"]);

        // Require full context: Changes to any of these affect all identities
        this.requiresFullContext = true;
    }

    protected buildWorkflow(context: NodeContext): Node<any, any>[] {
        // Only process Microsoft 365 integrations
        if (context.integrationType !== "microsoft-365") {
            return [];
        }

        return [
            // Step 1: Fetch all identities for this data source
            new FetchEntitiesNode("identities", true),

            // Step 2: Update Admin tags based on role assignments
            // This MUST happen before MFA evaluation so that the Admin tag is available
            new UpdateAdminTagsNode(),

            // Step 3: Evaluate MFA enforcement for all identities
            // This will now correctly identify admins via the Admin tag
            new EvaluateMFAEnforcementNode(),

            // Step 4: Process MFA partial enforced (alerts + tags)
            // This uses the isAdmin flag from the MFA evaluation
            new ProcessMFAPartialEnforcedNode(context.dataSourceID),

            // Step 5: Batch update all tags (Admin + MFA tags)
            new BatchUpdateEntitiesNode("Update identity tags"),

            // Step 6: Calculate identity states (admin status affects alert severity)
            new CalculateIdentityStateNode(),

            // Step 7: Batch update states
            new BatchUpdateEntitiesNode("Update identity states"),

            // Note: Batch flush happens automatically in BaseWorkerV2
        ];
    }
}
