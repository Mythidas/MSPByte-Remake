import { Alert, AlertTitle } from "@/components/ui/alert";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { getRow } from "@/lib/supabase/orm";
import { AlertCircleIcon } from "lucide-react";
import INTEGRATION_PAGES from "@/config/integration-pages";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DisableIntegrationButton from "@/modules/integrations/components/DisableIntegrationButton";
import { getDataSourcesCount } from "@/modules/integrations/actions/disable-integration";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Page({ params }: Props) {
  const { id: integrationId } = await params;
  const { data: integration } = await getRow("integrations", {
    filters: [["id", "eq", integrationId]],
  });
  const config = INTEGRATION_PAGES[integrationId];

  if (!integration || !config) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>Failed to find integration</AlertTitle>
      </Alert>
    );
  }

  // Get data sources count for the disable button
  const dataSourcesResult = await getDataSourcesCount(integrationId);
  const dataSourcesCount = dataSourcesResult.success
    ? dataSourcesResult.count || 0
    : 0;

  return (
    <div className="flex flex-col size-full gap-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/integrations">Integrations</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{integration.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex shrink w-full justify-between">
        <div className="flex gap-2">
          <div className={`p-1 bg-linear-to-br from-card to-primary/40 shadow`}>
            <img
              src={integration.icon_url || ""}
              width={60}
              alt={`${integration.name} icon`}
            />
          </div>

          <div className="flex flex-col justify-between">
            <span className="text-4xl font-semibold">{integration.name}</span>
            <span className="text-muted-foreground">
              {integration.description}
            </span>
          </div>
        </div>

        <DisableIntegrationButton
          integrationId={integrationId}
          integrationName={integration.name}
          dataSourcesCount={dataSourcesCount}
        />
      </div>

      <div className="flex flex-col bg-card rounded shadow p-4 gap-4 size-full overflow-hidden">
        <Tabs defaultValue="0">
          <TabsList>
            {config.steps.map((step, index) => {
              return (
                <TabsTrigger key={index} value={`${index}`}>
                  {step.name}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {config.steps.map((step, index) => {
            return (
              <TabsContent key={index} value={`${index}`}>
                {step.render({ integration })}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </div>
  );
}
