"use client";

import { useWard } from "@/hooks/use-ward";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import { Users, UsersRound, Shield, AlertTriangle } from "lucide-react";

export default function Microsoft365Dashboard() {
    const { site } = useWard();

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-3xl font-bold">Microsoft 365 Overview</h1>
                <p className="text-muted-foreground">
                    Identity, security, and compliance for {site?.name}
                </p>
            </div>

            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">--</div>
                        <p className="text-xs text-muted-foreground">Loading...</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Groups</CardTitle>
                        <UsersRound className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">--</div>
                        <p className="text-xs text-muted-foreground">Loading...</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Admin Roles</CardTitle>
                        <Shield className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">--</div>
                        <p className="text-xs text-muted-foreground">Loading...</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Security Alerts</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">--</div>
                        <p className="text-xs text-muted-foreground">Loading...</p>
                    </CardContent>
                </Card>
            </div>

            {/* Security Summary */}
            <div className="grid gap-4 md:grid-cols-2 mb-8">
                <Card>
                    <CardHeader>
                        <CardTitle>MFA Coverage</CardTitle>
                        <CardDescription>Multi-factor authentication status</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Enforced</span>
                                <Badge variant="default">--</Badge>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Not Enforced</span>
                                <Badge variant="secondary">--</Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Conditional Access</CardTitle>
                        <CardDescription>Policy coverage status</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Enabled</span>
                                <Badge variant="default">--</Badge>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Disabled</span>
                                <Badge variant="secondary">--</Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Alerts */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Security Alerts</CardTitle>
                    <CardDescription>Latest alerts and recommendations</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-center text-muted-foreground py-8">No alerts to display</p>
                </CardContent>
            </Card>
        </div>
    );
}
