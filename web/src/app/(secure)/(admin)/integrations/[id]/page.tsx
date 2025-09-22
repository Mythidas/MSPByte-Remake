import { Alert, AlertTitle } from "@/components/ui/alert";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import INTEGRATION_PAGES from "@/config/integration-pages";
import { getRow } from "@/lib/supabase/orm";
import { AlertCircleIcon } from "lucide-react";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Page({ params }: Props) {
  const { id: integrationId } = await params;
  const { data: integration } = await getRow("integrations", {
    filters: [["id", "eq", integrationId]],
  });
  const config = INTEGRATION_PAGES[integrationId];

  if (!integration) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>Failed to find integration</AlertTitle>
      </Alert>
    );
  }

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

      <div className="flex w-full justify-between">
        <div className="flex gap-2">
          <div className={`p-1 bg-linear-to-br from-card to-primary/40 shadow`}>
            <img src={integration.icon_url || ""} width={60} />
          </div>

          <div className="flex flex-col justify-between">
            <span className="text-4xl font-semibold">{integration.name}</span>
            <span className="text-muted-foreground">
              {integration.description}
            </span>
          </div>
        </div>

        <Button variant="destructive">Disable</Button>
      </div>

      <div className="flex flex-col bg-card rounded shadow p-4 gap-4 size-full">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl">Instructions</h1>
          <div>
            {config.steps.map((step, index) => {
              return (
                <div key={step.name} className="flex gap-2 items-center">
                  <div className="flex bg-blue-500 rounded-full w-8 h-8 items-center justify-center">
                    {index + 1}
                  </div>
                  <span>{step.description}</span>
                </div>
              );
            })}
          </div>
        </div>

        <Tabs defaultValue="0">
          <TabsList>
            {config.steps.map((step, index) => {
              return <TabsTrigger value={`${index}`}>{step.name}</TabsTrigger>;
            })}
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
