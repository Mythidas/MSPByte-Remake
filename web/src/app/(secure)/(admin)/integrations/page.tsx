"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Tables } from "@workspace/shared/types/database";
import Link from "next/link";
import {
  Globe,
  Settings,
  Zap,
  Database,
  MessageSquare,
  Users,
  BarChart3,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Integration = Tables<"integrations">;
type DataSource = Tables<"data_sources">;

interface IntegrationWithStatus extends Integration {
  isEnabled: boolean;
  dataSourceCount: number;
}

interface GroupedIntegrations {
  [category: string]: IntegrationWithStatus[];
}

// Category icons mapping
const categoryIcons: { [key: string]: React.ElementType } = {
  psa: Settings,
  communication: MessageSquare,
  crm: Users,
  analytics: BarChart3,
  security: Shield,
  database: Database,
  automation: Zap,
  default: Globe,
};

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationWithStatus[]>([]);
  const [groupedIntegrations, setGroupedIntegrations] =
    useState<GroupedIntegrations>({});
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [hasPsaIntegration, setHasPsaIntegration] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      // Fetch all integrations
      const { data: integrationsData, error: integrationsError } =
        await supabase
          .from("integrations")
          .select("*")
          .order("category", { ascending: true })
          .order("name", { ascending: true });

      if (integrationsError) throw integrationsError;

      // Fetch active data sources to determine which integrations are enabled
      const { data: dataSourcesData, error: dataSourcesError } = await supabase
        .from("data_sources")
        .select("integration_id");

      if (dataSourcesError) throw dataSourcesError;

      // Create a map of integration usage
      const integrationUsage = dataSourcesData.reduce(
        (acc, ds) => {
          acc[ds.integration_id] = (acc[ds.integration_id] || 0) + 1;
          return acc;
        },
        {} as { [key: string]: number }
      );

      // Combine integrations with their status
      const integrationsWithStatus: IntegrationWithStatus[] =
        integrationsData.map((integration) => ({
          ...integration,
          isEnabled: integrationUsage[integration.id]! > 0,
          dataSourceCount: integrationUsage[integration.id] || 0,
        }));

      // Group integrations by category
      const grouped = integrationsWithStatus.reduce((acc, integration) => {
        const category = integration.category || "other";
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(integration);
        return acc;
      }, {} as GroupedIntegrations);

      // Check if there's at least one PSA integration enabled
      const psaEnabled = integrationsWithStatus.some(
        (integration) => integration.category === "PSA" && integration.isEnabled
      );

      setIntegrations(integrationsWithStatus);
      setGroupedIntegrations(grouped);
      setHasPsaIntegration(psaEnabled);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching integrations:", error);
      setLoading(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    const IconComponent = categoryIcons[category] || categoryIcons.default!;
    return <IconComponent className="w-5 h-5" />;
  };

  const getStatusBadge = (integration: IntegrationWithStatus) => {
    if (integration.isEnabled) {
      return (
        <Badge
          variant="default"
          className="bg-green-100 text-green-800 hover:bg-green-100"
        >
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Active ({integration.dataSourceCount})
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-gray-100 text-gray-600">
        Not Connected
      </Badge>
    );
  };

  const canEnableIntegration = (integration: IntegrationWithStatus) => {
    // PSA integrations can always be enabled
    if (integration.category === "psa") return true;
    // Other integrations require at least one PSA integration to be active
    return hasPsaIntegration;
  };

  const getIntegrationCard = (integration: IntegrationWithStatus) => {
    const canEnable = canEnableIntegration(integration);

    return (
      <Card
        key={integration.id}
        className={`transition-all duration-200 hover:shadow-md ${!canEnable && !integration.isEnabled ? "opacity-60" : ""}`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              {integration.icon_url ? (
                <img
                  src={integration.icon_url}
                  alt={integration.name}
                  className="w-8 h-8 rounded-lg object-cover"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-medium"
                  style={{ backgroundColor: integration.color || "#6366f1" }}
                >
                  {integration.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <CardTitle className="text-lg">{integration.name}</CardTitle>
                <div className="flex items-center space-x-2 mt-1">
                  {getCategoryIcon(integration.category)}
                  <span className="text-sm text-gray-500 capitalize">
                    {integration.category}
                  </span>
                </div>
              </div>
            </div>
            {getStatusBadge(integration)}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <CardDescription className="mb-4">
            {integration.description}
          </CardDescription>
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              {integration.product_url && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={integration.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Learn More
                  </a>
                </Button>
              )}
            </div>
            <div className="flex space-x-2">
              {integration.isEnabled ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/integrations/${integration.id}`}>
                    <Settings className="w-4 h-4 mr-1" />
                    Configure
                  </Link>
                </Button>
              ) : (
                <Button
                  size="sm"
                  asChild={canEnable}
                  disabled={!canEnable}
                  className={!canEnable ? "cursor-not-allowed" : ""}
                >
                  {canEnable ? (
                    <Link href={`/integrations/${integration.id}`}>
                      <Plus className="w-4 h-4 mr-1" />
                      Connect
                    </Link>
                  ) : (
                    <span>
                      <Plus className="w-4 h-4 mr-1" />
                      Connect
                    </span>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="grid gap-4">
        <div>
          <h1 className="text-3xl font-bold">Integrations</h1>
          <p className="text-gray-600 mt-2">Loading integrations...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-48 bg-input animate-pulse rounded-lg"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  const categories = Object.keys(groupedIntegrations).sort();
  const totalIntegrations = integrations.length;
  const activeIntegrations = integrations.filter((i) => i.isEnabled).length;

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-gray-600 mt-2">
          Connect and manage your business integrations. {activeIntegrations} of{" "}
          {totalIntegrations} integrations are active.
        </p>
      </div>

      {/* PSA Warning */}
      {!hasPsaIntegration && (
        <Alert className="border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>PSA Integration Required:</strong> Connect at least one PSA
            (Professional Service Automation) integration before setting up
            other integrations. PSAs drive most of the data linking between
            systems.
          </AlertDescription>
        </Alert>
      )}

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList>
          <TabsTrigger value="all">All Categories</TabsTrigger>
          {categories.map((category) => (
            <TabsTrigger key={category} value={category} className="capitalize">
              <span className="flex items-center space-x-2">
                {getCategoryIcon(category)}
                <span>{category}</span>
                <Badge variant="secondary" className="ml-2">
                  {groupedIntegrations[category]!.length}
                </Badge>
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="space-y-8">
            {categories.map((category) => (
              <div key={category}>
                <div className="flex items-center space-x-3 mb-4">
                  {getCategoryIcon(category)}
                  <h2 className="text-xl font-semibold capitalize">
                    {category}
                  </h2>
                  <Badge variant="outline">
                    {groupedIntegrations[category]!.length} integration
                    {groupedIntegrations[category]!.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupedIntegrations[category]!.map(getIntegrationCard)}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {categories.map((category) => (
          <TabsContent key={category} value={category} className="mt-6">
            <div>
              <div className="flex items-center space-x-3 mb-6">
                {getCategoryIcon(category)}
                <h2 className="text-2xl font-semibold capitalize">
                  {category} Integrations
                </h2>
                <Badge variant="outline">
                  {groupedIntegrations[category]!.length} integration
                  {groupedIntegrations[category]!.length !== 1 ? "s" : ""}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedIntegrations[category]!.map(getIntegrationCard)}
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
