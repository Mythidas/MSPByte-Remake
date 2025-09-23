"use client";

import { useState, useEffect, useMemo } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  Plus,
  Trash2,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { Tables } from "@workspace/shared/types/database";
import { Microsoft365DataSourceConfig } from "@workspace/shared/types/database/data-sources";
import { insertRows, deleteRows, updateRow } from "@/lib/supabase/orm";
import { SearchBar } from "@/components/SearchBar";
import Link from "next/link";
import Display from "@/components/Display";
import { SubmitButton } from "@/components/SubmitButton";

const connectionSchema = z.object({
  name: z.string().min(1, "Connection name cannot be empty"),
});

type Site = Tables<"sites">;
type DataSource = Tables<"data_sources"> & {
  config: Microsoft365DataSourceConfig;
};

type Props = {
  connection: DataSource;
  mappedSites: Site[];
  allSites: Site[];
  onUpdate: () => void;
  trigger?: React.ReactNode;
};

export default function Microsoft365ConnectEditDialog({
  connection,
  mappedSites,
  allSites,
  onUpdate,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  const [connectionName, setConnectionName] = useState("");
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [domainMappings, setDomainMappings] = useState<
    { domain: string; site_id: string }[]
  >([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const config = connection.config as Microsoft365DataSourceConfig;
  const needsReconsent = config.permission_version !== 1;
  const availableDomains = config.available_domains || [];
  const unmappedSites = allSites.filter(
    (site) => !selectedSites.includes(site.id)
  );

  useEffect(() => {
    if (open) {
      setConnectionName(config.name || "");
      setSelectedSites(mappedSites.map((site) => site.id));
      setDomainMappings(config.domain_mappings || []);
      setValidationErrors([]);
    }
  }, [open, config, mappedSites]);

  const authURL = useMemo(() => {
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID!,
      redirect_uri: `${process.env.NEXT_PUBLIC_ORIGIN}/api/v1.0/callbacks/microsoft-365/consent`,
      state: JSON.stringify({
        action: "reconsent",
        connection_id: connection.id,
        timestamp: Date.now(),
      }),
    });

    return `https://login.microsoftonline.com/common/adminconsent?${params.toString()}`;
  }, [connection.id]);

  const validateForm = () => {
    const errors: string[] = [];

    try {
      connectionSchema.parse({ name: connectionName });
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(...error.issues.map((e: any) => e.message));
      }
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setIsUpdating(true);

      // Update connection config
      const updatedConfig: Microsoft365DataSourceConfig = {
        ...config,
        name: connectionName,
        domain_mappings: domainMappings,
      };

      await updateRow("data_sources", {
        id: connection.id,
        row: { config: updatedConfig },
      });

      // Remove all existing site mappings
      await deleteRows("data_source_to_site" as any, {
        filters: [["data_source_id", "eq", connection.id]],
      });

      // Add new site mappings
      if (selectedSites.length > 0) {
        await insertRows("data_source_to_site" as any, {
          rows: selectedSites.map((siteId) => ({
            data_source_id: connection.id,
            site_id: siteId,
          })),
        });
      }

      onUpdate();
      setOpen(false);
    } catch (error) {
      console.error("Error updating connection:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddDomainMapping = (domain: string, siteId: string) => {
    setDomainMappings((prev) => [
      ...prev.filter((mapping) => mapping.domain !== domain),
      { domain, site_id: siteId },
    ]);
  };

  const handleRemoveDomainMapping = (domain: string) => {
    setDomainMappings((prev) =>
      prev.filter((mapping) => mapping.domain !== domain)
    );
  };

  const handleAddSite = (siteId: string) => {
    setSelectedSites((prev) => [...prev, siteId]);
  };

  const handleRemoveSite = (siteId: string) => {
    setSelectedSites((prev) => prev.filter((id) => id !== siteId));
    // Also remove any domain mappings for this site
    setDomainMappings((prev) =>
      prev.filter((mapping) => mapping.site_id !== siteId)
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Microsoft 365 Connection</DialogTitle>
          <DialogDescription>
            Manage connection settings, sites, and domain mappings
          </DialogDescription>
        </DialogHeader>

        {needsReconsent && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                This connection requires reconsent due to updated permissions.
              </span>
              <Button size="sm" asChild variant="outline">
                <Link href={authURL}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Reconsent
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {validationErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              <ul className="list-disc list-inside">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex-1 overflow-hidden flex flex-col gap-6">
          {/* Connection Name */}
          <div className="space-y-2">
            <Label htmlFor="connection-name">Connection Name</Label>
            <Input
              id="connection-name"
              value={connectionName}
              onChange={(e) => setConnectionName(e.target.value)}
              placeholder="Enter connection name"
            />
          </div>

          <div className="flex gap-4 flex-1 overflow-hidden">
            {/* Sites Management */}
            <div className="flex flex-col flex-1 gap-4">
              <h4 className="font-medium">Sites ({selectedSites.length})</h4>
              <SearchBar onSearch={setSearchTerm} placeholder="Search sites" />

              <div className="flex flex-col flex-1 overflow-hidden gap-4">
                {/* Selected Sites */}
                <div className="flex flex-col size-full gap-2 overflow-hidden">
                  <Label className="text-sm font-medium">Mapped Sites</Label>
                  <ScrollArea>
                    {selectedSites.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-2">
                        No sites mapped
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {selectedSites.map((siteId) => {
                          const site = allSites.find((s) => s.id === siteId);
                          if (
                            site &&
                            !site.name
                              .toLowerCase()
                              .includes(searchTerm.toLowerCase())
                          )
                            return;

                          return (
                            <div
                              key={siteId}
                              className="flex items-center justify-between p-2 border rounded"
                            >
                              <span className="text-sm">
                                {site?.name || siteId}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveSite(siteId)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </div>

                {/* Available Sites */}
                <div className="flex flex-col size-full gap-2 overflow-hidden">
                  <Label className="text-sm font-medium">Available Sites</Label>
                  <ScrollArea>
                    {unmappedSites.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-2">
                        All sites are mapped
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {unmappedSites
                          .filter((site) =>
                            site.name
                              .toLowerCase()
                              .includes(searchTerm.toLowerCase())
                          )
                          .map((site, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-2 border rounded"
                            >
                              <span className="text-sm">{site.name}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAddSite(site.id)}
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </div>

            {/* Domain Mappings */}
            <div className="flex flex-col flex-1 gap-4">
              <h4 className="font-medium">Domain Mappings</h4>

              <div className="flex flex-col size-full overflow-hidden">
                <ScrollArea className="max-h-full overflow-hidden">
                  <div className="grid gap-2 size-full">
                    {availableDomains.map((domain) => {
                      const mapping = domainMappings.find(
                        (m) => m.domain === domain.name
                      );

                      return (
                        <Display key={domain.name} className="justify-between">
                          <div>{domain.name}</div>
                          <Select
                            defaultValue={mapping?.site_id || "-"}
                            onValueChange={(value) =>
                              value !== "-"
                                ? handleAddDomainMapping(domain.name, value)
                                : handleRemoveDomainMapping(domain.name)
                            }
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Select site" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="-">None</SelectItem>
                              {mappedSites.map((site) => (
                                <SelectItem key={site.id} value={site.id}>
                                  {site.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Display>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            Tenant: {config.tenant_name} ({config.tenant_id})
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton onClick={handleSave} pending={isUpdating}>
              Save Changes
            </SubmitButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
