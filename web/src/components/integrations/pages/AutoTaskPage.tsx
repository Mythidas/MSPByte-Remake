"use client";

import { Tables } from "@workspace/shared/types/database";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import zodSchemaBuilder from "@/lib/utils/zodSchemaBuilder";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useMemo, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import PSAMapSitesTab from "@/components/integrations/tabs/PSAMapSitesTab";
import AutoTaskConnector from "@workspace/shared/lib/connectors/AutoTaskConnector";
import { AutoTaskConfig } from "@workspace/shared/types/source/autotask/generic";
import { toast } from "sonner";

type Props = {
  integration: Tables<"integrations">;
  dataSource?: Tables<"data_sources">;
};

export default function AutoTaskPage({ integration, dataSource }: Props) {
  const [isSaving, setIsSaving] = useState(false);

  const configSchema = integration.config_schema as Record<
    string,
    { label: string; sensitive?: boolean }
  >;
  const formSchema = zodSchemaBuilder(configSchema);
  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...((dataSource?.config as any) || {}),
    },
  });

  const formValues = form.watch();
  const isFormUnchanged = useMemo(() => {
    if (!dataSource?.config) return false;

    return Object.keys(configSchema).every((key) => {
      return formValues[key] === form.formState.defaultValues![key];
    });
  }, [
    formValues,
    form.formState.defaultValues,
    configSchema,
    dataSource?.config,
  ]);

  const handleSubmit = async (data: FormValues) => {
    setIsSaving(true);

    try {
      const connector = new AutoTaskConnector(
        dataSource
          ? (dataSource.config as AutoTaskConfig)
          : (data as AutoTaskConfig)
      );
      if (!(await connector.checkHealth())) {
        throw "Connect health check failed";
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid gap-4">
      <span className="text-2xl font-semibold">Instructions</span>
      <div className="grid gap-2">
        <p className="flex gap-2">
          <Badge variant="default">Step 1</Badge>
          <span>
            Before you get started, please make sure that you have an active
            AutoTask account.
          </span>
        </p>
        <p className="flex gap-2">
          <Badge variant="default">Step 2</Badge>
          <span>
            Log into AutoTask and create a API User with ID, Tracker and Secret
          </span>
        </p>
        <p className="flex gap-2">
          <Badge variant="default">Step 3</Badge>
          <span>Create sites in MSPByte linked to customers in AutoTask</span>
        </p>
      </div>
      <Tabs defaultValue="1">
        <TabsList>
          <TabsTrigger value="1">
            <Badge className="rounded-full bg-primary w-6 h-6">1</Badge>
            Connect
          </TabsTrigger>
          <TabsTrigger value="2">
            <Badge className="rounded-full bg-primary w-6 h-6">2</Badge>
            Map sites
          </TabsTrigger>
        </TabsList>

        <TabsContent value="1">
          <Form {...form}>
            <form
              className="flex flex-col gap-4 w-1/2"
              onSubmit={form.handleSubmit(handleSubmit)}
            >
              <p className="font-semibold">Configuration</p>
              {Object.entries(configSchema).map(([k, v]) => {
                return (
                  <FormField
                    key={k}
                    control={form.control}
                    name={k}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{v.label}</FormLabel>
                        <FormControl>
                          <Input
                            type={v.sensitive ? "password" : "text"}
                            placeholder={v.label}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                );
              })}
              <SubmitButton
                className="w-fit"
                pending={isSaving}
                disabled={!form.formState.isValid || isFormUnchanged}
              >
                Connect
              </SubmitButton>
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="2">
          <PSAMapSitesTab integration={integration} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
