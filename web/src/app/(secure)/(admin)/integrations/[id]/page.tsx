import ToggleIntegration from "@/components/ToggleIntegration";
import INTEGRATION_PAGES from "@/lib/config/integrations/pages";
import { getRow } from "@/lib/supabase/orm";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Page({ ...props }: Props) {
  const { id: integrationId } = await props.params;
  const { data: integration } = await getRow("integrations", {
    filters: [["id", "eq", integrationId]],
  });
  const { data: dataSource } = await getRow("data_sources", {
    filters: [
      ["integration_id", "eq", integrationId],
      ["site_id", "is", null],
    ],
  });
  if (!integration) {
    return (
      <div>
        <Alert>Failed to fetch integration. Please refresh</Alert>
      </div>
    );
  }

  const page = INTEGRATION_PAGES[integrationId];

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

      <Card className="h-full">
        <CardHeader>
          <CardTitle>
            <div className="flex gap-2">
              <img
                src={integration.icon_url || ""}
                alt={integration.name}
                className="w-16 rounded-lg object-cover p-1 bg-gradient-to-br from-primary to-input shadow-2xl"
              />
              <div className="flex flex-col gap-2">
                <span className="text-xl">{integration.name}</span>
                <div>
                  <Badge>{integration.category}</Badge>
                </div>
              </div>
            </div>
          </CardTitle>
          <CardAction>
            <ToggleIntegration
              integration={integration}
              dataSource={dataSource}
            />
          </CardAction>
          <CardDescription>{integration.description}</CardDescription>
        </CardHeader>
        <CardContent>{page?.(integration, dataSource)}</CardContent>
      </Card>
    </div>
  );
}
