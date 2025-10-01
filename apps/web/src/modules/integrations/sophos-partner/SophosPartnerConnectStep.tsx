"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Tables } from "@workspace/shared/types/database";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { CheckCircle2, Loader2, TestTube } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@workspace/ui/components/Spinner";
import { SophosPartnerConfig } from "@workspace/shared/types/integrations/sophos-partner";
import { getRow } from "@/lib/supabase/orm";
import {
  SophosPartnerConfigInput,
  saveSophosPartnerConfig,
} from "@/modules/integrations/sophos-partner/actions/config";
import { testSophosPartnerConnection } from "@/modules/integrations/sophos-partner/actions/connector";
import { useAsyncDataCached } from "@/lib/hooks/useAsyncDataCached";

const formSchema = z.object({
  client_id: z.string().min(1, "Client ID is required"),
  client_secret: z.string().min(1, "Client Secret is required"),
});

type Props = {
  integration: Tables<"integrations">;
};

export default function SophosPartnerConnectStep({ integration }: Props) {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isValid },
  } = useForm<SophosPartnerConfigInput>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
  });

  const {
    data: hasExistingConfig,
    loading,
    refetch,
  } = useAsyncDataCached(
    async () => {
      const result = await getRow("data_sources", {
        filters: [
          ["integration_id", "eq", integration.id],
          ["site_id", "is", null],
        ],
      });

      if (!result.error) {
        setValue(
          "client_id",
          (result.data.config as SophosPartnerConfig).client_id
        );
        setValue("client_secret", "*********");
        return true;
      }

      return false;
    },
    {
      deps: [integration.id], // Refetch when integration changes
      namespace: "sophos-config", // Organized namespace
      ttl: 5 * 60 * 1000, // 5 minute cache
      staleWhileRevalidate: true, // Show cached data while refetching
      immediate: true,
    }
  );

  const onSubmit = async (data: SophosPartnerConfigInput) => {
    setSaving(true);
    try {
      const result = await saveSophosPartnerConfig(integration.id, data);

      if (result.success) {
        const action = result.action === "updated" ? "updated" : "saved";
        toast.success(`Sophos Partner configuration ${action} successfully!`);
        refetch();
      } else {
        toast.error(result.error || "Failed to save configuration");
      }
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    const currentValues = getValues();

    // Check if all fields are filled before testing
    if (!currentValues.client_id || !currentValues.client_secret) {
      toast.error("Please fill in all fields before testing the connection");
      return;
    }

    setTesting(true);
    try {
      const result = await testSophosPartnerConnection(currentValues);

      if (result.error) {
        toast.error(result.error.message || "Connection test failed");
      } else if (result.data) {
        toast.success("Connection test successful!");
      } else {
        toast.error("Connection test failed");
      }
    } catch (error) {
      console.error("Error testing connection:", error);
      toast.error(
        error instanceof Error ? error.message : "Connection test failed"
      );
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 gap-2">
        <Spinner />
        Loading configuration...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Sophos Partner Configuration</h2>
        <p className="text-muted-foreground">
          Configure your Sophos Partner API connection settings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connection Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client_id">Client ID</Label>
                <Input
                  id="client_id"
                  placeholder="Your Sophos Partner Client ID"
                  {...register("client_id")}
                />
                {errors.client_id && (
                  <p className="text-sm text-red-600">
                    {errors.client_id.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="client_secret">Client Secret</Label>
                <Input
                  id="client_secret"
                  type="password"
                  placeholder="Your Sophos Partner Client Secret"
                  {...register("client_secret")}
                />
                {errors.client_secret && (
                  <p className="text-sm text-red-600">
                    {errors.client_secret.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={testing || !isValid}
              >
                {testing ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <TestTube className="w-4 h-4 mr-2" />
                )}
                Test Connection
              </Button>

              <Button type="submit" disabled={saving || !isValid}>
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                {hasExistingConfig
                  ? "Update Configuration"
                  : "Save Configuration"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
