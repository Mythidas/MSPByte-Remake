"use client";

import { useState, useEffect } from "react";
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
import {
  saveAutoTaskConfig,
  getAutoTaskConfig,
  testAutoTaskConnection,
  type AutoTaskConfigInput,
} from "./actions/config";
import { Spinner } from "@/components/Spinner";

const formSchema = z.object({
  server: z.string().min(1, "Server is required"),
  client_id: z.string().min(1, "Client ID is required"),
  tracker_id: z.string().min(1, "Tracker ID is required"),
  client_secret: z.string().min(1, "Client Secret is required"),
});

type Props = {
  integration: Tables<"integrations">;
};

export default function AutoTaskConnectStep({ integration }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [hasExistingConfig, setHasExistingConfig] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isValid },
  } = useForm<AutoTaskConfigInput>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
  });

  // Load existing configuration on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const result = await getAutoTaskConfig(integration.id);

        if (result.success && result.hasConfig && result.config) {
          setHasExistingConfig(true);
          setValue("server", result.config.server);
          setValue("client_id", result.config.client_id);
          setValue("tracker_id", result.config.tracker_id);
          setValue("client_secret", result.config.client_secret);
        }
      } catch (error) {
        console.error("Error loading config:", error);
        toast.error("Failed to load existing configuration");
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [integration.id, setValue]);

  const onSubmit = async (data: AutoTaskConfigInput) => {
    setSaving(true);
    try {
      const result = await saveAutoTaskConfig(integration.id, data);

      if (result.success) {
        const action = result.action === "updated" ? "updated" : "saved";
        toast.success(`AutoTask configuration ${action} successfully!`);
        setHasExistingConfig(true);
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
    if (
      !currentValues.server ||
      !currentValues.client_id ||
      !currentValues.tracker_id ||
      !currentValues.client_secret
    ) {
      toast.error("Please fill in all fields before testing the connection");
      return;
    }

    setTesting(true);
    try {
      const result = await testAutoTaskConnection(currentValues);

      if (result) {
        toast.success("Connection test successful!");
      } else {
        toast.error("Connection test failed");
      }
    } catch (error) {
      console.error("Error testing connection:", error);
      toast.error("Connection test failed");
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
        <h2 className="text-2xl font-semibold">AutoTask Configuration</h2>
        <p className="text-muted-foreground">
          Configure your AutoTask connection settings
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
                <Label htmlFor="server">Server URL</Label>
                <Input
                  id="server"
                  placeholder="https://your-server.autotask.net"
                  {...register("server")}
                />
                {errors.server && (
                  <p className="text-sm text-red-600">
                    {errors.server.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="client_id">Client ID</Label>
                <Input
                  id="client_id"
                  placeholder="Your client ID"
                  {...register("client_id")}
                />
                {errors.client_id && (
                  <p className="text-sm text-red-600">
                    {errors.client_id.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tracker_id">Tracker ID</Label>
                <Input
                  id="tracker_id"
                  placeholder="Your tracker ID"
                  {...register("tracker_id")}
                />
                {errors.tracker_id && (
                  <p className="text-sm text-red-600">
                    {errors.tracker_id.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="client_secret">Client Secret</Label>
                <Input
                  id="client_secret"
                  type="password"
                  placeholder="Your client secret"
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
