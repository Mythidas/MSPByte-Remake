"use client";

import { useSites } from "@/hooks/use-ward";
import { useWardStore } from "@/stores/ward-store";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import { Building2, ChevronRight } from "lucide-react";

export default function WardPage() {
    const sites = useSites();
    const { setSite, setMode } = useWardStore();
    const router = useRouter();

    const handleSiteSelect = (site: typeof sites[0]) => {
        setSite(site);
        setMode("home");
        router.push(`/ward/${site.slug}`);
    };

    if (!sites || sites.length === 0) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>No Sites Found</CardTitle>
                        <CardDescription>
                            There are no sites available for your organization. Please contact your administrator.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Select a Site</h1>
                <p className="text-muted-foreground">Choose a site to view and manage its integrations</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sites.map((site) => (
                    <Card
                        key={site._id}
                        className="cursor-pointer transition-all hover:border-primary hover:shadow-md"
                        onClick={() => handleSiteSelect(site)}
                    >
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                        <Building2 className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">{site.name}</CardTitle>
                                        <CardDescription className="text-sm">{site.slug}</CardDescription>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2">
                                <Badge variant={site.status === "active" ? "default" : "secondary"}>
                                    {site.status}
                                </Badge>
                                {site.psaIntegrationName && (
                                    <span className="text-xs text-muted-foreground">
                                        via {site.psaIntegrationName}
                                    </span>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
