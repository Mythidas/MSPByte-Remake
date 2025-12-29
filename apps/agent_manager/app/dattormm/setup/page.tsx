"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Doc } from "@workspace/database/convex/_generated/dataModel";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Card } from "@workspace/ui/components/card";
import { AlertCircle, CheckCircle, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import Encryption from "@workspace/shared/lib/Encryption";
import type { DattoRMMConfig } from "@workspace/shared/types/integrations/dattormm";
import { testConnection } from "../actions";

export default function DattoRMMSetup() {
  const router = useRouter();

  // Fetch existing data source if any
  const dataSource = useQuery(api.helpers.orm.get_s, {
    secret: process.env.NEXT_PUBLIC_CONVEX_SECRET!,
    tableName: "data_sources",
    index: {
      name: "by_integration",
      params: {
        integrationId: "datto-rmm",
      },
    },
    filters: {
      isPrimary: true,
    },
  }) as Doc<"data_sources"> | undefined;

  const [config, setConfig] = useState<DattoRMMConfig>({
    url: "",
    apiKey: "",
    apiSecretKey: "",
    siteVariableName: "MSPSiteCode",
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing config when dataSource is loaded
  useEffect(() => {
    if (dataSource?.config) {
      setConfig(dataSource.config as DattoRMMConfig);
    }
  }, [dataSource]);

  const createOrUpdateDataSource = useMutation(
    api.datasources.mutate.createOrUpdate
  );

  const handleTestConnection = async () => {
    if (!config.url || !config.apiKey || !config.apiSecretKey) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      // Use the testConnection server action
      const result = await testConnection(config);

      if (result.success) {
        setTestResult({ success: true });
        toast.success("Connection successful!");
      } else {
        setTestResult({
          success: false,
          error: result.error,
        });
        toast.error(`Connection failed: ${result.error}`);
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        error: error.message || "Unknown error",
      });
      toast.error(`Connection failed: ${error.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!config.url || !config.apiKey || !config.apiSecretKey) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSaving(true);

    try {
      // Encrypt sensitive fields
      const encryptedApiKey = await Encryption.encrypt(
        config.apiKey,
        process.env.NEXT_ENCRYPTION_KEY!
      );
      const encryptedApiSecretKey = await Encryption.encrypt(
        config.apiSecretKey,
        process.env.NEXT_ENCRYPTION_KEY!
      );

      const encryptedConfig: DattoRMMConfig = {
        url: config.url,
        apiKey: encryptedApiKey,
        apiSecretKey: encryptedApiSecretKey,
        siteVariableName: config.siteVariableName || "MSPSiteCode",
      };

      // Save to database
      await createOrUpdateDataSource({
        integrationId: "datto-rmm",
        config: encryptedConfig,
      });

      toast.success("Configuration saved successfully!");
      router.push("/dattormm");
    } catch (error: any) {
      toast.error(`Failed to save configuration: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Datto RMM Configuration</h2>
        <p className="text-muted-foreground">
          Configure your Datto RMM API credentials to enable site synchronization
          and management.
        </p>
      </div>

      <Card className="p-6">
        <div className="flex flex-col gap-6">
          {/* API URL */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="url">API URL *</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://your-instance-api.centrastage.net"
              value={config.url}
              onChange={(e) => setConfig({ ...config, url: e.target.value })}
              className="bg-input border-border"
            />
            <p className="text-xs text-muted-foreground">
              Your Datto RMM API base URL (e.g., https://pinotage-api.centrastage.net)
            </p>
          </div>

          {/* API Key */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="apiKey">API Key *</Label>
            <Input
              id="apiKey"
              type="text"
              placeholder="Enter your API key"
              value={config.apiKey}
              onChange={(e) =>
                setConfig({ ...config, apiKey: e.target.value })
              }
              className="bg-input border-border"
            />
          </div>

          {/* API Secret Key */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="apiSecretKey">API Secret Key *</Label>
            <Input
              id="apiSecretKey"
              type="password"
              placeholder="Enter your API secret key"
              value={config.apiSecretKey}
              onChange={(e) =>
                setConfig({ ...config, apiSecretKey: e.target.value })
              }
              className="bg-input border-border"
            />
          </div>

          {/* Site Variable Name */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="siteVariableName">Site Variable Name</Label>
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
              The name of the site variable used to store MSPByte site IDs
              (default: MSPSiteCode)
            </p>
          </div>

          {/* Test Connection */}
          <div className="flex flex-col gap-3 pt-4 border-t">
            <Button
              onClick={handleTestConnection}
              disabled={isTesting || !config.url || !config.apiKey || !config.apiSecretKey}
              variant="outline"
              className="w-full"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testing Connection...
                </>
              ) : (
                "Test Connection"
              )}
            </Button>

            {testResult && (
              <div
                className={`flex items-start gap-3 p-4 rounded border ${
                  testResult.success
                    ? "bg-green-500/10 border-green-500/50 text-green-300"
                    : "bg-red-500/10 border-red-500/50 text-red-300"
                }`}
              >
                {testResult.success ? (
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-medium">
                    {testResult.success
                      ? "Connection Successful"
                      : "Connection Failed"}
                  </p>
                  {testResult.error && (
                    <p className="text-sm mt-1">{testResult.error}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              onClick={() => router.push("/dattormm")}
              variant="ghost"
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                isSaving ||
                !config.url ||
                !config.apiKey ||
                !config.apiSecretKey
              }
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Configuration
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Info Card */}
      <Card className="p-6 bg-blue-500/5 border-blue-500/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-200">
            <p className="font-medium mb-2">Important Notes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Your API credentials will be encrypted before storage</li>
              <li>Make sure you have API access enabled in Datto RMM</li>
              <li>
                The site variable is used to link Datto RMM sites with MSPByte
                sites
              </li>
              <li>You can test the connection before saving</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
