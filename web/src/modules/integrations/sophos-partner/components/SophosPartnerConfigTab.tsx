import DatePicker from "@/components/DatePicker";
import { SubmitButton } from "@/components/SubmitButton";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { saveSophoPartnerConfig } from "@/lib/actions/sophos-partner";
import { useAuthStore } from "@/lib/stores/auth-store";
import zodSchemaBuilder from "@/lib/utils/zodSchemaBuilder";
import { zodResolver } from "@hookform/resolvers/zod";
import { Tables } from "@workspace/shared/types/database";
import { SophosPartnerConfig } from "@workspace/shared/types/source/sophos-partner";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

type Props = {
  integration: Tables<"integrations">;
  dataSource?: Tables<"data_sources">;
};

export default function SophosPartnerConfigTab({
  integration,
  dataSource,
}: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuthStore();

  const configSchema = integration.config_schema as Record<
    string,
    { label: string; sensitive?: boolean }
  >;
  configSchema.expiration = { label: "Expiration" };
  const formSchema = zodSchemaBuilder(configSchema);
  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...((dataSource?.config as any) || {}),
      expiration: dataSource?.credential_expiration_at,
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
      if (!user) throw "Failed to fetch context. Please refresh";

      const result = await saveSophoPartnerConfig({
        tenantId: user.tenant_id!,
        integrationId: integration.id,
        dataSourceId: dataSource?.id,
        config: data as SophosPartnerConfig,
        schema: configSchema,
        data: data,
      });

      if (result.error) {
        throw result.error.message;
      }

      toast.info(`${result.data} successfully`);
      window.location.reload();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-4 w-1/2"
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <p className="font-semibold">Configuration</p>
        {Object.entries(configSchema).map(([k, v]) => {
          if (k === "expiration") return null;

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

        <FormField
          control={form.control}
          name="expiration"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Expiration Date</FormLabel>
              <FormControl>
                <DatePicker {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <SubmitButton
          className="w-fit"
          pending={isSaving}
          disabled={!form.formState.isValid || isFormUnchanged}
        >
          Connect
        </SubmitButton>
      </form>
    </Form>
  );
}
