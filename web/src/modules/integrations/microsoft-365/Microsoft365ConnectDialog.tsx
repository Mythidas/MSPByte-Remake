import { SearchBar } from "@/components/SearchBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getRows } from "@/lib/supabase/orm";
import { Tables } from "@workspace/shared/types/database";
import { Plus, RefreshCw, ExternalLink, Search } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";

type Site = Tables<"sites">;

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
].join(" ");

export default function Microsoft365ConnectDialog({
  onSuccess: _,
}: {
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [connectionName, setConnectionName] = useState("");
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [step, setStep] = useState<"name" | "sites" | "confirm">("name");
  const [availableSites, setAvailableSites] = useState<Site[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (open && step === "sites") {
      loadAvailableSites();
    }
  }, [open, step]);

  const filteredSites = useMemo(() => {
    return availableSites.filter((site) =>
      site.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [availableSites, searchTerm]);

  const authURL = useMemo(() => {
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID!,
      redirect_uri: `${process.env.NEXT_PUBLIC_ORIGIN}/api/v1.0/callbacks/microsoft-365/consent`,
      state: JSON.stringify({
        action: "initial_consent", // TODO: Detect if reconsent
        tenant_id: availableSites[0]?.tenant_id,
        connection_name: connectionName,
        selected_sites: selectedSites.join(" "),
        timestamp: Date.now(),
      }),
    });

    return `https://login.microsoftonline.com/common/adminconsent?${params.toString()}`;
  }, [availableSites, connectionName, selectedSites]);

  const loadAvailableSites = async () => {
    setLoadingSites(true);
    try {
      const sitesResult = await getRows("sites");
      if (sitesResult.data) {
        setAvailableSites(sitesResult.data.rows);
      }
    } catch (error) {
      console.error("Error loading sites:", error);
    } finally {
      setLoadingSites(false);
    }
  };

  const handleNext = () => {
    if (step === "name" && connectionName.trim()) {
      setStep("sites");
    } else if (step === "sites" && selectedSites.length > 0) {
      setStep("confirm");
    }
  };

  const handleBack = () => {
    if (step === "sites") {
      setStep("name");
    } else if (step === "confirm") {
      setStep("sites");
    }
  };

  const resetDialog = () => {
    setConnectionName("");
    setSelectedSites([]);
    setStep("name");
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen);
        if (!newOpen) resetDialog();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Create Connection
        </Button>
      </DialogTrigger>
      <DialogContent className="flex flex-col h-3/5 max-w-2xl overflow-hidden justify-between">
        <DialogHeader className="shrink">
          <DialogTitle>Create Microsoft 365 Connection</DialogTitle>
          <DialogDescription>
            {step === "name" &&
              "Enter a name for your Microsoft 365 connection"}
            {step === "sites" &&
              "Select the sites you want to map to this connection"}
            {step === "confirm" &&
              "Review your connection settings before proceeding"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col h-4/5 w-full">
          {step === "name" && (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="connection-name"
                  className="block text-sm font-medium mb-2"
                >
                  Connection Name
                </label>
                <Input
                  id="connection-name"
                  placeholder="e.g., Contoso Tenant"
                  value={connectionName}
                  onChange={(e) => setConnectionName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This name will help you identify this Microsoft 365 tenant
                  connection
                </p>
              </div>
            </div>
          )}

          {step === "sites" && (
            <div className="flex flex-col size-full gap-2">
              <SearchBar
                onSearch={setSearchTerm}
                placeholder="Search sites"
                lead={<Search className="w-4" />}
              />
              <div className="flex flex-col size-full gap-4 overflow-hidden">
                {loadingSites ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    Loading sites...
                  </div>
                ) : (
                  <ScrollArea>
                    <div className="grid size-full gap-2">
                      {filteredSites.map((site) => (
                        <div
                          key={site.id}
                          className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted cursor-pointer"
                          onClick={() => {
                            setSelectedSites((prev) =>
                              prev.includes(site.id)
                                ? prev.filter((id) => id !== site.id)
                                : [...prev, site.id]
                            );
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedSites.includes(site.id)}
                            onChange={() => {}} // Handled by parent onClick
                            className="rounded"
                          />
                          <div className="flex-1">
                            <div className="font-medium">{site.name}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                {!loadingSites && availableSites.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No sites available. Please ensure sites are synced from your
                    PSA.
                  </div>
                )}
              </div>
            </div>
          )}

          {step === "confirm" && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Connection Name</h4>
                <p className="text-sm text-muted-foreground">
                  {connectionName}
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">
                  Selected Sites ({selectedSites.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedSites.map((siteId) => {
                    const site = availableSites.find((s) => s.id === siteId);
                    return (
                      <Badge key={siteId} variant="outline" className="text-xs">
                        {site?.name || siteId}
                      </Badge>
                    );
                  })}
                </div>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Next Steps</h4>
                <ol className="text-sm text-blue-800 space-y-1">
                  <li>1. You&apos;ll be redirected to Microsoft to sign in</li>
                  <li>
                    2. Grant permissions to access your Microsoft 365 tenant
                  </li>
                  <li>3. Return here to complete the connection setup</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between">
          <div>
            {step !== "name" && (
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={resetDialog}>
              Cancel
            </Button>
            {step === "confirm" ? (
              <Button asChild>
                <Link href={authURL}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Connect to Microsoft
                </Link>
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={
                  (step === "name" && !connectionName.trim()) ||
                  (step === "sites" && selectedSites.length === 0)
                }
              >
                Next {step === "sites" && `(${selectedSites.length})`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
