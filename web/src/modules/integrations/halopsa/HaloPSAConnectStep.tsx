"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Tables } from "@workspace/shared/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, TestTube } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/Spinner";
import { getRow, upsertRows } from "@/lib/supabase/orm";
import { APIResponse } from "@workspace/shared/types/api";
import { useAsyncDataCached } from "@/lib/hooks/useAsyncDataCached";
import { HaloPSAConfig } from "@workspace/shared/types/integrations/halopsa";
import { useAuthStore } from "@/lib/stores/auth";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { SubmitButton } from "@/components/SubmitButton";
import { saveConfig, testConfig } from "@/modules/integrations/actions/config";
import { useAsyncData, useAsyncRender } from "@/lib/hooks/useAsync";

const formSchema = z.object({
  url: z.string().min(1, "URL is required"),
  client_id: z.string().min(1, "Client ID is required"),
  client_secret: z.string().min(1, "Client Secret is required"),
});
type FormSchema = z.infer<typeof formSchema>;

type Props = {
  integration: Tables<"integrations">;
};

export default function HaloPSAConnectStep({ integration }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const { user } = useAuthStore();

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
  });

  // TODO: Make default UUID a constant
  const asyncState = useAsyncData(
    async () => {
      const { data, error } = await getRow("data_sources", {
        filters: [
          ["integration_id", "eq", integration.id],
          ["site_id", "eq", "00000000-0000-0000-0000-000000000000"],
        ],
      });

      if (data) {
        const config = data.config as HaloPSAConfig;

        // Reset form with proper default values
        form.reset({
          url: config.url || "",
          client_id: config.client_id || "",
          client_secret: "", // Don't populate with masked value for security
        });

        return config;
      }

      // If no existing config, reset with empty values
      form.reset({
        url: "",
        client_id: "",
        client_secret: "",
      });

      return {
        url: "",
        client_id: "",
        client_secret: "",
      };
    },
    {
      deps: [integration.id],
    }
  );

  const formValues = form.watch();
  const isConfigValid = useMemo(() => {
    if (!asyncState.data) return false;

    // Form is valid for submission if it has values
    return formValues.client_id && formValues.client_secret;
  }, [formValues, asyncState.data]);

  async function handleSubmit(data: FormSchema) {
    setIsSaving(true);

    try {
      if (!user) throw "User not authenticated";

      const result = await saveConfig({
        data,
        integrationID: integration.id,
        tenantID: user.tenant_id!,
      });

      if (result.error) throw result.error.message;
      toast.info("Saved integration configuration!");
    } catch (err) {
      toast.error(`Failed to save config: ${err}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTest() {
    setIsTesting(true);
    const data = form.getValues();

    try {
      const result = await testConfig({
        data,
        integrationID: integration.id,
      });

      if (result.error) throw result.error.message;
      toast.info("Config tested successfully!");
    } catch (err) {
      toast.error(`Failed to test config: ${err}`);
    } finally {
      setIsTesting(false);
    }
  }

  return useAsyncRender(asyncState, (config) => (
    <div className="flex p-4 border shadow w-full">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex flex-col w-1/3 gap-2"
        >
          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>URL</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter Halo URL (https://[tenant].halopsa.com)"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="client_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client ID</FormLabel>
                <FormControl>
                  <Input placeholder="Enter Client ID" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="client_secret"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client Secret</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Enter Client Secret"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-2 w-1/3">
            <SubmitButton
              type="submit"
              pending={isSaving}
              disabled={isTesting || !isConfigValid || !form.formState.isValid}
            >
              Save
            </SubmitButton>
            <SubmitButton
              type="button"
              pending={isTesting}
              disabled={isSaving}
              onClick={handleTest}
            >
              Test
            </SubmitButton>
          </div>
        </form>
      </Form>
    </div>
  ));
}
