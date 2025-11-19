"use client";

import { useQuery } from "convex/react";
import { api, Doc } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft,
    CheckCircle,
    XCircle,
    AlertCircle,
    ShieldAlert,
    Key,
    LogOut,
    ExternalLink,
    Users,
    Shield,
    CreditCard,
    Bell,
    History,
    Mail
} from "lucide-react";
import Loader from "@workspace/ui/components/Loader";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { toast } from "sonner";
import { prettyText } from "@workspace/shared/lib/utils";
import { useApp } from "@/hooks/useApp";
import { AlertsTable } from "@/components/alerts/AlertsTable";

type UserEntity = Doc<'entities'>;

export default function UserDetailPage() {
    const params = useParams();
    const router = useRouter();
    const userId = params.userId as string;

    const { site: currentSite } = useApp();

    // Fetch the user entity
    const user = useQuery(
        api.helpers.orm.get,
        userId ? { tableName: 'entities', id: userId } : 'skip'
    ) as UserEntity | null | undefined;

    // Fetch relationships for this user
    const relationships = useQuery(
        api.helpers.orm.list,
        user ? {
            tableName: 'entity_relationships',
            filters: {
                childEntityId: user._id
            }
        } : 'skip'
    ) as Doc<'entity_relationships'>[] | undefined;

    // Fetch roles
    const roleIds = relationships?.filter(r => r.relationshipType === 'assigned_role').map(r => r.parentEntityId) || [];
    const roles = useQuery(
        api.helpers.orm.list,
        roleIds.length > 0 && relationships?.length ? {
            tableName: 'entities',
            index: {
                name: 'by_data_source_type',
                params: {
                    dataSourceId: relationships[0].dataSourceId,
                    entityType: 'roles'
                }
            },
            filters: {
                _id: { in: roleIds }
            }
        } : 'skip'
    ) as UserEntity[] | undefined;

    // Fetch groups
    const groupIds = relationships?.filter(r => r.relationshipType === 'member_of').map(r => r.parentEntityId) || [];
    const groups = useQuery(
        api.helpers.orm.list,
        groupIds.length > 0 && relationships?.length ? {
            tableName: 'entities',
            index: {
                name: 'by_data_source_type',
                params: {
                    dataSourceId: relationships[0].dataSourceId,
                    entityType: 'groups'
                }
            },
            filters: {
                _id: { in: groupIds }
            }
        } : 'skip'
    ) as UserEntity[] | undefined;

    // Fetch active alerts
    const alerts = useQuery(
        api.helpers.orm.list,
        user && currentSite ? {
            tableName: 'entity_alerts',
            index: {
                name: 'by_site',
                params: {
                    siteId: currentSite._id,
                }
            },
            filters: {
                entityId: user._id
            }
        } : 'skip'
    ) as Doc<'entity_alerts'>[] | undefined;

    // Fetch license entities by SKU IDs
    const licenseSkuIds = user?.normalizedData?.licenses || [];
    const licenses = useQuery(
        api.helpers.orm.list,
        licenseSkuIds.length > 0 && relationships?.length ? {
            tableName: 'entities',
            index: {
                name: 'by_data_source_type',
                params: {
                    dataSourceId: relationships[0].dataSourceId,
                    entityType: 'licenses'
                }
            },
            filters: {
                externalId: { in: licenseSkuIds }
            }
        } : 'skip'
    ) as UserEntity[] | undefined;

    // TODO: Fetch audit logs
    // TODO: Fetch applied policies

    // Stub action handlers
    const handleEnable = () => {
        toast.info("Enable user functionality coming soon");
        // TODO: Call server action
    };

    const handleDisable = () => {
        toast.info("Disable user functionality coming soon");
        // TODO: Call server action
    };

    const handleResetPassword = () => {
        toast.info("Reset password functionality coming soon");
        // TODO: Call server action
    };

    const handleRevokeSessions = () => {
        toast.info("Revoke sessions functionality coming soon");
        // TODO: Call server action
    };

    const handleLockdown = () => {
        toast.info("Lockdown functionality coming soon");
        // TODO: Call server action (disable + revoke + reset)
    };

    const handleViewInAzure = () => {
        if (user && currentSite) {
            const tenantId = user.rawData?.tenantId || currentSite.name;
            const url = `https://portal.azure.com/#view/Microsoft_AAD_UsersAndTenants/UserProfileMenuBlade/~/overview/userId/${user.externalId}/tenantId/${tenantId}`;
            window.open(url, '_blank');
        }
    };

    if (!user) {
        return (
            <div className="flex items-center justify-center size-full">
                <Loader />
            </div>
        );
    }

    const userData = user.normalizedData;
    const enabled = userData?.enabled ?? true;
    const state = userData?.state || 'normal';
    const tags = userData?.tags || [];
    const userType = userData?.type || 'member';
    const lastLogin = userData?.last_login_at;
    const aliases = userData?.aliases || [];

    const stateConfig = {
        low: { color: "bg-slate-500/50", icon: AlertCircle, text: "Low Risk" },
        normal: { color: "bg-green-500/50", icon: CheckCircle, text: "Normal" },
        warn: { color: "bg-yellow-500/50", icon: AlertCircle, text: "Warning" },
        critical: { color: "bg-red-500/50", icon: AlertCircle, text: "Critical" },
    };
    const config = stateConfig[state as keyof typeof stateConfig] || stateConfig.normal;
    const StateIcon = config.icon;

    return (
        <div className="flex flex-col size-full gap-4">
            {/* Header with Back Button */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.back()}
                    className="gap-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Users
                </Button>
            </div>

            {/* User Header Card */}
            <Card className="border-2">
                <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-3">
                                <CardTitle className="text-3xl">{userData?.name || 'Unknown User'}</CardTitle>
                                {enabled ? (
                                    <CheckCircle className="w-6 h-6 text-green-500" />
                                ) : (
                                    <XCircle className="w-6 h-6 text-red-500" />
                                )}
                            </div>

                            <div className="flex items-center gap-2 text-muted-foreground">
                                <CardDescription className="text-base flex flex-col gap-2">
                                    <span className="flex gap-2 items-center">
                                        <Mail className="w-4 h-4" />
                                        {userData?.email || user.rawData?.userPrincipalName}
                                    </span>
                                    <span>Last Login: {new Date(lastLogin).toDateString()}</span>
                                </CardDescription>
                            </div>

                            {/* Status Badges */}
                            <div className="flex flex-wrap gap-2">
                                <Badge variant={enabled ? "default" : "destructive"} className="px-3 py-1">
                                    {enabled ? 'Enabled' : 'Disabled'}
                                </Badge>
                                <Badge variant="outline" className={`${config.color} px-3 py-1`}>
                                    <StateIcon className="w-3 h-3 mr-1" />
                                    {config.text}
                                </Badge>
                                <Badge variant="outline" className="px-3 py-1">
                                    {prettyText(userType)}
                                </Badge>
                                {tags.map((tag: string) => (
                                    <Badge key={tag} variant="secondary" className="px-3 py-1">
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-2 justify-end">
                            {enabled ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleDisable}
                                    className="gap-2"
                                >
                                    <XCircle className="w-4 h-4" />
                                    Disable
                                </Button>
                            ) : (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleEnable}
                                    className="gap-2"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    Enable
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleResetPassword}
                                className="gap-2"
                            >
                                <Key className="w-4 h-4" />
                                Reset Password
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRevokeSessions}
                                className="gap-2"
                            >
                                <LogOut className="w-4 h-4" />
                                Revoke Sessions
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleLockdown}
                                className="gap-2"
                            >
                                <ShieldAlert className="w-4 h-4" />
                                Lockdown
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleViewInAzure}
                                className="gap-2"
                            >
                                <ExternalLink className="w-4 h-4" />
                                View in Azure
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Tabbed Content */}
            <Tabs defaultValue="groups" className="flex-1">
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="groups" className="gap-2">
                        <Users className="w-4 h-4" />
                        <span className="hidden sm:inline">Groups</span>
                        <Badge variant="secondary" className="ml-1">{groupIds.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="roles" className="gap-2">
                        <Shield className="w-4 h-4" />
                        <span className="hidden sm:inline">Roles</span>
                        <Badge variant="secondary" className="ml-1">{roleIds.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="licenses" className="gap-2">
                        <CreditCard className="w-4 h-4" />
                        <span className="hidden sm:inline">Licenses</span>
                        <Badge variant="secondary" className="ml-1">{licenseSkuIds.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="alerts" className="gap-2">
                        <Bell className="w-4 h-4" />
                        <span className="hidden sm:inline">Alerts</span>
                        <Badge variant="secondary" className="ml-1">{alerts?.length || 0}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="audit" className="gap-2">
                        <History className="w-4 h-4" />
                        <span className="hidden sm:inline">Audit</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="groups" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Group Memberships</CardTitle>
                            <CardDescription>Security and distribution groups this user belongs to</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {groups && groups.length > 0 ? (
                                <div className="grid gap-3">
                                    {groups.map((group) => (
                                        <div key={group._id} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                                            <div className="flex-shrink-0 mt-1">
                                                <Users className="w-5 h-5 text-muted-foreground" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-base">{group.normalizedData?.name || 'Unknown Group'}</p>
                                                <p className="text-sm text-muted-foreground truncate">{group.normalizedData?.description || group.externalId}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                                    <p className="text-muted-foreground">No group memberships</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="roles" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Assigned Roles</CardTitle>
                            <CardDescription>Directory and administrative roles assigned to this user</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {roles && roles.length > 0 ? (
                                <div className="grid gap-3">
                                    {roles.map((role) => (
                                        <div key={role._id} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                                            <div className="flex-shrink-0 mt-1">
                                                <Shield className="w-5 h-5 text-orange-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-base">{role.normalizedData?.name || 'Unknown Role'}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {role.normalizedData?.description || 'No description available'}
                                                </p>
                                            </div>
                                            {role.normalizedData?.name?.toLowerCase().includes('admin') && (
                                                <Badge variant="destructive" className="flex-shrink-0">Admin</Badge>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                                    <p className="text-muted-foreground">No roles assigned</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="licenses" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Licenses</CardTitle>
                            <CardDescription>Microsoft 365 licenses and subscriptions assigned to this user</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {licenses && licenses.length > 0 ? (
                                <div className="grid gap-3">
                                    {licenses.map((license) => (
                                        <div key={license._id} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                                            <div className="flex-shrink-0 mt-1">
                                                <CreditCard className="w-5 h-5 text-blue-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-base">
                                                    {license.normalizedData?.name || license.normalizedData?.skuPartNumber || 'Unknown License'}
                                                </p>
                                                {license.normalizedData?.skuPartNumber && license.normalizedData?.name !== license.normalizedData?.skuPartNumber && (
                                                    <p className="text-sm text-muted-foreground">SKU: {license.normalizedData?.skuPartNumber}</p>
                                                )}
                                                {license.normalizedData?.consumedUnits !== undefined && license.normalizedData?.prepaidUnits !== undefined && (
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {license.normalizedData.consumedUnits} of {license.normalizedData.prepaidUnits} units consumed
                                                    </p>
                                                )}
                                            </div>
                                            <Badge variant="outline" className="flex-shrink-0">Active</Badge>
                                        </div>
                                    ))}
                                </div>
                            ) : licenseSkuIds.length > 0 ? (
                                <div className="grid gap-3">
                                    {licenseSkuIds.map((skuId: string) => (
                                        <div key={skuId} className="flex items-start gap-4 p-4 border rounded-lg">
                                            <div className="flex-shrink-0 mt-1">
                                                <CreditCard className="w-5 h-5 text-muted-foreground" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm text-muted-foreground">{skuId}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <CreditCard className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                                    <p className="text-muted-foreground">No licenses assigned</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="alerts" className="mt-4 space-y-4">
                    {alerts && alerts.length > 0 ? (
                        <AlertsTable
                            alerts={alerts}
                            siteId={currentSite?._id!}
                            integrationSlug="microsoft-365"
                        />
                    ) : (
                        <Card>
                            <CardContent className="pt-6">
                                <div className="text-center py-12">
                                    <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                                    <p className="text-lg font-medium mb-1">No Alerts</p>
                                    <p className="text-sm text-muted-foreground">
                                        This user has no security alerts at this time
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="audit" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Audit Log</CardTitle>
                            <CardDescription>History of actions and changes made to this user account</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-center py-12">
                                <History className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                                <p className="text-lg font-medium mb-1">Audit Log Coming Soon</p>
                                <p className="text-sm text-muted-foreground">
                                    View detailed history of all actions performed on this user
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
