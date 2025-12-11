"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, Doc } from "@/lib/api";
import { useQuery, useMutation } from "convex/react";
import { SetupWizard, WizardStep } from "@/components/integrations/SetupWizard";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import Loader from "@workspace/ui/components/Loader";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { Eye, EyeOff, CheckCircle, XCircle, Calendar } from "lucide-react";
import { toast } from "sonner";
import {
  testConnection as testConnectionAction,
  encryptSensitiveConfig,
} from "../actions";
import { Spinner } from "@workspace/ui/components/Spinner";

type DattoRMMConfig = {
  url: string;
  apiKey: string;
  apiSecretKey: string;
  siteVariableName?: string;
};

export default function DattoRMMSetup() {
  const router = useRouter();
  const dataSource = useQuery(api.helpers.orm.get, {
    tableName: "data_sources",
    index: {
      name: "by_integration_primary",
      params: {
        integrationId: "datto-rmm",
        isPrimary: true,
      },
    },
  }) as Doc<"data_sources"> | undefined;

  // Connection Details State
  const [config, setConfig] = useState<DattoRMMConfig>({
    url: "",
    apiKey: "",
    apiSecretKey: "",
    siteVariableName: "MSPSiteCode",
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecretKey, setShowApiSecretKey] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [connectionError, setConnectionError] = useState<string>("");
  const [credentialExpiration, setCredentialExpiration] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);

  const createOrUpdateDataSource = useMutation(
    api.datasources.mutate.createOrUpdate,
  );

  const existingDataSource = dataSource;
  const isEditing = !!existingDataSource;

  // Load existing config if editing
  if (isEditing && existingDataSource.config && config.url === "") {
    setConfig(existingDataSource.config);
    if (existingDataSource.credentialExpirationAt) {
      setCredentialExpiration(
        new Date(existingDataSource?.credentialExpirationAt || 0)
          .toISOString()
          .split("T")[0],
      );
    }
  }

  const testConnection = async (): Promise<boolean> => {
    if (!config.url || !config.apiKey || !config.apiSecretKey) {
      setConnectionError("URL, API Key, and API Secret Key are required");
      return false;
    }

    setConnectionStatus("testing");
    setConnectionError("");

    try {
      const result = await testConnectionAction(config);

      if (result.data) {
        setConnectionStatus("success");
        toast.success("Connection successful!");
        return true;
      } else {
        setConnectionStatus("error");
        setConnectionError("Connection failed");
        toast.error("Connection failed: " + result.error);
        return false;
      }
    } catch (error: unknown) {
      setConnectionStatus("error");
      setConnectionError("Connection failed");
      toast.error(("Connection failed: " + error) as string);
      return false;
    }
  };

  const handleComplete = async () => {
    setIsCreating(true);

    try {
      const expirationDate = credentialExpiration
        ? new Date(credentialExpiration).getTime()
        : undefined;

      // Encrypt sensitive fields via server action
      const encryptResult = await encryptSensitiveConfig(config);

      if (encryptResult.error || !encryptResult.data) {
        throw new Error(encryptResult.error || "Encryption failed");
      }

      // Call mutation with encrypted config (client-side, has auth)
      await createOrUpdateDataSource({
        integrationId: "datto-rmm",
        config: encryptResult.data,
        credentialExpirationAt: expirationDate,
      });

      toast.success(
        isEditing
          ? "Configuration updated!"
          : "Integration configured successfully!",
      );
      router.push("/secure/default/integrations/datto-rmm");
    } catch (error: any) {
      toast.error(
        "Failed to save configuration: " + (error.message || "Unknown error"),
      );
      setIsCreating(false);
    }
  };

  const steps: WizardStep[] = [
    {
      id: "connection",
      title: "Connection",
      description: "Enter your Datto RMM connection details",
      isNextDisabled: connectionStatus !== "success",
      disabledTooltip:
        connectionStatus !== "success"
          ? "Please test the connection before proceeding"
          : undefined,
      actionButtons: (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={testConnection}
                disabled={
                  connectionStatus === "testing" ||
                  !config.url ||
                  !config.apiKey ||
                  !config.apiSecretKey
                }
                className="gap-2"
              >
                {connectionStatus === "testing" && <Spinner size={16} />}
                {connectionStatus === "success" && (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                )}
                {connectionStatus === "testing"
                  ? "Testing..."
                  : "Test Connection"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Verify credentials work with Datto RMM</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
      component: (
        <div className="flex flex-col gap-6">
          {/* API URL */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="url">Datto RMM API URL</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://pinotage-api.centrastage.net"
              value={config.url}
              onChange={(e) => setConfig({ ...config, url: e.target.value })}
              className="bg-input border-border"
            />
            <p className="text-xs text-muted-foreground">
              Your Datto RMM API base URL
            </p>
          </div>

          {/* API Key */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="apiKey">API Key</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? "text" : "password"}
                placeholder="your-api-key"
                value={config.apiKey}
                onChange={(e) =>
                  setConfig({ ...config, apiKey: e.target.value })
                }
                className="bg-input border-border pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* API Secret Key */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="apiSecretKey">API Secret Key</Label>
            <div className="relative">
              <Input
                id="apiSecretKey"
                type={showApiSecretKey ? "text" : "password"}
                placeholder="your-api-secret-key"
                value={config.apiSecretKey}
                onChange={(e) =>
                  setConfig({ ...config, apiSecretKey: e.target.value })
                }
                className="bg-input border-border pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowApiSecretKey(!showApiSecretKey)}
              >
                {showApiSecretKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Site Variable Name */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="siteVariableName">
              Site Variable Name (Optional)
            </Label>
            <Input
              id="siteVariableName"
              type="text"
              placeholder="MSPSiteCode"
              value={config.siteVariableName}
              onChange={(e) =>
                setConfig({ ...config, siteVariableName: e.target.value })
              }
              className="bg-input border-border"
            />
            <p className="text-xs text-muted-foreground">
              The variable name to push MSPByte site IDs to (default:
              MSPSiteCode)
            </p>
          </div>

          {/* Credential Expiration */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="expiration">Credential Expiration (Optional)</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="expiration"
                type="date"
                value={credentialExpiration}
                onChange={(e) => setCredentialExpiration(e.target.value)}
                className="bg-input border-border pl-10"
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Set when credentials will expire to receive renewal reminders
            </p>
          </div>

          {/* Connection Status Display */}
          {(connectionStatus === "success" || connectionStatus === "error") && (
            <div className="p-4 bg-card/30 border rounded">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Connection Status</span>
                {connectionStatus === "success" && (
                  <Badge className="bg-green-500/50 gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Connected
                  </Badge>
                )}
                {connectionStatus === "error" && (
                  <Badge className="bg-red-500/50 gap-1">
                    <XCircle className="w-3 h-3" />
                    Failed
                  </Badge>
                )}
              </div>
              {connectionError && (
                <p className="text-xs text-red-400 mt-2">{connectionError}</p>
              )}
            </div>
          )}
        </div>
      ),
      validate: async () => {
        // Validation happens via disabledTooltip - Next button is disabled until connection is tested
        return connectionStatus === "success";
      },
    },
    {
      id: "review",
      title: "Review",
      description: "Review your configuration before completing setup",
      component: (
        <div className="flex flex-col gap-6">
          {/* Connection Summary */}
          <div className="bg-card/30 border rounded p-4 flex flex-col gap-3">
            <h3 className="font-semibold">Connection Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">URL:</span>
                <p className="font-medium">{config.url}</p>
              </div>
              <div>
                <span className="text-muted-foreground">
                  Site Variable Name:
                </span>
                <p className="font-medium">
                  {config.siteVariableName || "MSPSiteCode"}
                </p>
              </div>
              {credentialExpiration && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">
                    Credential Expiration:
                  </span>
                  <p className="font-medium">
                    {new Date(credentialExpiration).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/50 rounded p-4">
            <p className="text-sm text-blue-100">
              After completing setup, automatic syncing will be enabled for all
              supported data types. You can monitor sync progress and manage
              settings in the Sync Management tab.
            </p>
          </div>
        </div>
      ),
    },
  ];

  if (existingDataSource === undefined) {
    return <Loader />;
  }

  return (
    <div className="flex flex-col gap-4 size-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {isEditing ? "Edit" : "Setup"} Datto RMM Integration
          </h1>
          <p className="text-muted-foreground">
            {isEditing
              ? "Update your Datto RMM connection settings"
              : "Connect to Datto RMM to start automatic data synchronization"}
          </p>
        </div>
      </div>

      <SetupWizard
        steps={steps}
        onComplete={handleComplete}
        onCancel={() => router.push("/secure/default/integrations/datto-rmm")}
      />
    </div>
  );
}
