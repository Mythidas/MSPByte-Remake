import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tables } from "@workspace/shared/types/database";
import { AlertCircle, CheckCircle, Link2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

const REQUIRED_PERMISSIONS = [
  "AuditLog.Read.All",
  "Directory.Read.All",
  "LicenseAssignment.Read.All",
  "MailboxSettings.Read",
  "Organization.Read.All",
  "Policy.Read.All",
  "Reports.Read.All",
  "User-PasswordProfile.ReadWrite.All",
  "User.ManageIdentities.All",
  "User.Read.All",
  "User.RevokeSessions.All",
  "UserAuthenticationMethod.ReadWrite.All",
];

export default function Microsoft365ConnectDialog({
  site,
  dataSource,
  integration,
}: {
  site: Tables<"sites_view">;
  dataSource?: Tables<"data_sources">;
  integration: Tables<"integrations">;
}) {
  const isReConsent = useMemo(() => {
    if (dataSource) {
      const dataConfig = dataSource.config as { consent_version: number };
      const integrationConfig = integration.config_schema as {
        consent_version: number;
      };
      return dataConfig < integrationConfig;
    }

    return false;
  }, [integration, dataSource]);

  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_ORIGIN}/api/v1.0/callbacks/microsoft-365/consent`,
    state: JSON.stringify({
      action: dataSource ? "reconsent" : "initial_consent",
      siteId: site.id,
      integrationId: integration.id,
      tenantId: site.tenant_id,
      timestamp: Date.now(),
    }),
  });

  // Use the admin consent endpoint for application permissions
  const authUrl = `https://login.microsoftonline.com/common/adminconsent?${params.toString()}`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant={isReConsent ? "outline" : dataSource ? "default" : "ghost"}
          className={isReConsent ? "border-orange-300 text-orange-700" : ""}
        >
          {dataSource ? (
            isReConsent ? (
              <>
                <AlertCircle className="w-4 h-4 mr-1" />
                Update Permissions
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-1" />
                Connected
              </>
            )
          ) : (
            <>
              <Link2 className="w-4 h-4 mr-1" />
              Connect
            </>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="!max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {isReConsent
              ? "Update Permissions"
              : "Connect Microsoft 365 Tenant"}
          </DialogTitle>
          <DialogDescription>
            {isReConsent
              ? `New permissions are required for enhanced functionality for ${site.name}`
              : `Connect ${site.name} to a Microsoft 365 tenant by granting admin consent`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isReConsent && (
            <div className="p-4 rounded-lg border border-orange-200">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                <h4 className="font-medium text-orange-900">
                  Permission Update Required
                </h4>
              </div>
              <p className="text-sm text-orange-700">
                This site needs updated permissions to access new Microsoft 365
                features. You'll need to re-consent to continue using this
                integration.
              </p>
            </div>
          )}

          <div className="p-4 rounded-lg border">
            <h4 className="font-medium mb-3">Required Permissions</h4>
            <ScrollArea className="max-h-40 overflow-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                {REQUIRED_PERMISSIONS.map((permission) => (
                  <div key={permission} className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs font-mono">
                      {permission}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <p className="text-xs mt-3">
              These permissions allow MSPByte to manage users, read audit logs,
              and generate security reports for this specific site.
            </p>
          </div>

          <div className="p-4 rounded-lg">
            <h4 className="font-medium mb-2">What happens next?</h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• You'll be redirected to Microsoft's consent page</li>
              <li>
                • Sign in with a tenant admin account for the target Microsoft
                365 tenant
              </li>
              <li>• Review and grant the requested permissions</li>
              <li>• You'll be redirected back to MSPByte once complete</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button asChild>
            <Link href={authUrl}>
              <ExternalLink className="w-4 h-4" />
              <span>
                {isReConsent ? "Update Permissions" : "Connect to Microsoft"}
              </span>
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
