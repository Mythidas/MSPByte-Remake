"use client";

import { useState, useEffect, useCallback } from "react";
import { Tables } from "@workspace/shared/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trash2,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { getRows, deleteRows } from "@/lib/supabase/orm";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Microsoft365DataSourceConfig } from "@/lib/types/data-sources";
import { ScrollArea } from "@/components/ui/scroll-area";
import Microsoft365ConnectDialog from "@/modules/integrations/microsoft-365/Microsoft365ConnectDialog";
import Microsoft365ConnectEditDialog from "@/modules/integrations/microsoft-365/Microsoft365ConnectEditDialog";
import Display from "@/components/Display";

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "connected":
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Connected
        </Badge>
      );
    case "error":
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" />
          Error
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="secondary">
          <RefreshCw className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getErrorMessage(error: string): string {
  switch (error) {
    case "token_exchange_failed":
      return "Failed to exchange authorization code for access token. Please try again.";
    case "tenant_info_failed":
      return "Failed to retrieve tenant information from Microsoft. Please check your permissions.";
    case "database_error":
      return "Failed to save connection to database. Please contact support.";
    case "integration_not_found":
      return "Microsoft 365 integration is not properly configured. Please contact support.";
    case "internal_error":
      return "An unexpected error occurred. Please try again later.";
    default:
      return `Connection failed: ${error}`;
  }
}

type Props = {
  integration: Tables<"integrations">;
};

type DataSource = Tables<"data_sources"> & {
  config: Microsoft365DataSourceConfig;
};

type Site = Tables<"sites">;

export default function Microsoft365ConnectStep({ integration }: Props) {
  const [connections, setConnections] = useState<DataSource[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [dataSourcesToSites, setDataSourcesToSites] = useState<
    Tables<"data_source_to_site">[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState("connections");
  const [showUnmappedOnly, setShowUnmappedOnly] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load M365 data sources
      const connectionsResult = await getRows("data_sources", {
        filters: [["integration_id", "eq", integration.id]],
      });

      // Load all sites
      const sitesResult = await getRows("sites");

      // Load data source to site mappings
      const mappingsResult = await getRows("data_source_to_site");

      if (connectionsResult.data) {
        setConnections(connectionsResult.data.rows as DataSource[]);
      }

      if (sitesResult.data) {
        setSites(sitesResult.data.rows);
      }

      if (mappingsResult.data) {
        setDataSourcesToSites(mappingsResult.data.rows);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, [integration.id]);

  useEffect(() => {
    loadData();

    // Check URL search params for success/error messages
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get("success");
    const error = urlParams.get("error");

    if (success) {
      setSuccessMessage("Microsoft 365 connection created successfully!");
      // Clear URL params
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (error) {
      setErrorMessage(getErrorMessage(error));
      // Clear URL params
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [integration.id, loadData]);

  const getSitesForConnection = (connectionId: string) => {
    const site_ids = dataSourcesToSites
      .filter((mapping) => mapping.data_source_id === connectionId)
      .map((mapping) => mapping.site_id);
    return sites.filter((site) => site_ids.includes(site.id));
  };

  const getConnectionForSite = (siteId: string) => {
    const mapping = dataSourcesToSites.find(
      (mapping) => mapping.site_id === siteId
    );
    return connections.find((c) => c.id === mapping?.data_source_id);
  };

  const filteredConnections = connections.filter(
    (connection) =>
      connection.external_id
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      connection.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSites = sites.filter((site) => {
    const matchesSearch =
      site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      site.slug.toLowerCase().includes(searchTerm.toLowerCase());

    const isMapped = getConnectionForSite(site.id) !== undefined;

    if (showUnmappedOnly) {
      return matchesSearch && !isMapped;
    }

    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        Loading connections...
      </div>
    );
  }

  return (
    <div className="flex flex-col size-full gap-4">
      {/* Success/Error Messages */}
      {successMessage && (
        <Alert className="flex gap-4 items-center">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <AlertTitle>{successMessage}</AlertTitle>
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Microsoft 365 Connections</h2>
          <p className="text-muted-foreground">
            Manage your Microsoft 365 tenant connections and site mappings
          </p>
        </div>
        <Microsoft365ConnectDialog onSuccess={loadData} />
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search connections and sites..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        {selectedTab === "sites" && (
          <Button
            variant={showUnmappedOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowUnmappedOnly(!showUnmappedOnly)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Unmapped Only
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="connections">
            Connections ({connections.length})
          </TabsTrigger>
          <TabsTrigger value="sites">Sites ({sites.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="space-y-4">
          {filteredConnections.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="text-muted-foreground text-center">
                  <h3 className="text-lg font-medium mb-2">
                    No connections found
                  </h3>
                  <p className="mb-4">
                    Create your first Microsoft 365 connection to get started
                  </p>
                  <Microsoft365ConnectDialog onSuccess={loadData} />
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredConnections.map((connection) => (
                <ConnectionCard
                  key={connection.id}
                  connection={connection}
                  sites={getSitesForConnection(connection.id)}
                  onUpdate={loadData}
                  allSites={sites}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sites" className="flex-1 overflow-hidden">
          <ScrollArea className="max-h-[80%] overflow-auto">
            {filteredSites.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="text-muted-foreground text-center">
                    <h3 className="text-lg font-medium mb-2">No sites found</h3>
                    <p>
                      {showUnmappedOnly
                        ? "All sites are currently mapped to connections"
                        : "No sites match your search criteria"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid size-full gap-2">
                {filteredSites.map((site) => (
                  <SiteCard
                    key={site.id}
                    site={site}
                    connection={getConnectionForSite(site.id)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ConnectionCard({
  connection,
  sites,
  onUpdate,
  allSites,
}: {
  connection: DataSource;
  sites: Site[];
  onUpdate: () => void;
  allSites: Site[];
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteConnection = async () => {
    try {
      setIsDeleting(true);

      // First remove all site mappings
      await deleteRows("data_source_to_site" as any, {
        filters: [["data_source_id", "eq", connection.id]],
      });

      // Then delete the connection
      await deleteRows("data_sources", {
        filters: [["id", "eq", connection.id]],
      });

      onUpdate();
    } catch (error) {
      console.error("Error deleting connection:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const connectionConfig = connection.config as Microsoft365DataSourceConfig;
  const needsReconsent = connectionConfig.permission_version !== 1;

  return (
    <Display>
      <div className="flex w-full items-center justify-between">
        <div className="flex flex-col justify-start">
          <span className="text-lg text-start">
            {(connection.config as Microsoft365DataSourceConfig).name ||
              "Unnamed Connection"}
          </span>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={connection.status} />
            {needsReconsent && (
              <Badge variant="destructive" className="text-xs">
                <RefreshCw className="w-3 h-3 mr-1" />
                Reconsent Required
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">
              {sites.length} sites mapped
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Microsoft365ConnectEditDialog
            connection={connection as any}
            mappedSites={sites}
            allSites={allSites}
            onUpdate={onUpdate}
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={isDeleting}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Connection</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this connection? This will
                  also remove all site mappings. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteConnection}>
                  {isDeleting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                      Deleting...
                    </>
                  ) : (
                    "Delete"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </Display>
  );
}

function SiteCard({
  site,
  connection,
}: {
  site: Site;
  connection?: DataSource;
}) {
  return (
    <div className="flex items-center justify-between border shadow p-2">
      <div>{site.name}</div>
      {connection ? (
        <Badge variant="default" className="text-xs bg-blue-100 text-blue-800">
          Mapped to {(connection.config as Microsoft365DataSourceConfig).name}
        </Badge>
      ) : (
        <Badge variant="secondary" className="text-xs">
          Unmapped
        </Badge>
      )}
    </div>
  );
}
