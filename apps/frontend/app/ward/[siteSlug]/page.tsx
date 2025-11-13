"use client";

import { useWard, useAvailableModes } from "@/hooks/use-ward";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Building2, AlertTriangle, Activity, Shield } from "lucide-react";
import { useRouter } from "next/navigation";

export default function HomeModePagePage() {
    const { site, setMode } = useWard();
    const availableModes = useAvailableModes();
    const router = useRouter();

    if (!site) {
        return (
            <div className="flex h-screen items-center justify-center">
                <p className="text-muted-foreground">Loading site...</p>
            </div>
        );
    }

    const handleModeSelect = (modeId: string) => {
        setMode(modeId);
        router.push(`/ward/${site.slug}/${modeId}`);
    };

    return (
        <div className="container mx-auto py-8">
            {/* Site Header */}
            <div className="mb-8">
                <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10">
                        <Building2 className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">{site.name}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge variant={site.status === "active" ? "default" : "secondary"}>
                                {site.status}
                            </Badge>
                            <span className="text-sm text-muted-foreground">{site.slug}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">0</div>
                        <p className="text-xs text-muted-foreground">No active alerts</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Integrations</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{availableModes.length}</div>
                        <p className="text-xs text-muted-foreground">Active integrations</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Security Score</CardTitle>
                        <Shield className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">--</div>
                        <p className="text-xs text-muted-foreground">Not available</p>
                    </CardContent>
                </Card>
            </div>

            {/* Available Modes */}
            <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">Integration Modes</h2>
                <p className="text-muted-foreground mb-6">
                    Select an integration mode to view detailed data and perform actions
                </p>

                {availableModes.length === 0 ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>No Integrations</CardTitle>
                            <CardDescription>
                                This site doesn't have any active integrations. Configure integrations to get started.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button>Configure Integrations</Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {availableModes.map((mode) => (
                            <Card
                                key={mode.id}
                                className="cursor-pointer transition-all hover:border-primary hover:shadow-md"
                                onClick={() => handleModeSelect(mode.id)}
                            >
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="text-lg">{mode.name}</CardTitle>
                                            <CardDescription className="text-sm">
                                                {mode.entityTypes.length} entity types
                                            </CardDescription>
                                        </div>
                                        <div
                                            className="h-3 w-3 rounded-full"
                                            style={{ backgroundColor: mode.color }}
                                        />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-wrap gap-1">
                                        {mode.entityTypes.slice(0, 3).map((type) => (
                                            <Badge key={type} variant="outline" className="text-xs">
                                                {type}
                                            </Badge>
                                        ))}
                                        {mode.entityTypes.length > 3 && (
                                            <Badge variant="outline" className="text-xs">
                                                +{mode.entityTypes.length - 3}
                                            </Badge>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Recent Activity */}
            <div>
                <h2 className="text-2xl font-bold mb-4">Recent Activity</h2>
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-center text-muted-foreground py-8">No recent activity</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
