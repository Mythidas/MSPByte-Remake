"use client";

import { useState, useMemo, useEffect } from "react";
import { api, Doc } from "@/lib/api";
import { useQuery, useMutation } from "convex/react";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import Loader from "@workspace/ui/components/Loader";
import SearchBox from "@/components/SearchBox";
import {
    Cloud,
    Building2,
    Settings,
    ArrowLeft,
    Save,
    X,
    Plus,
    Search,
    Trash2,
    Edit2,
    AlertTriangle,
    ShieldCheck,
    CheckCircle
} from "lucide-react";
import { toast } from "sonner";
import { useIntegration } from "../integration-provider";
import {
    generateConsentUrl,
    updateConnectionName,
    deleteConnection as deleteConnectionAction,
    checkPermissionVersion
} from "../actions";
import { Spinner } from "@workspace/ui/components/Spinner";
import { prettyText } from "@workspace/shared/lib/utils";
import type { Microsoft365DataSourceConfig } from "@workspace/shared/types/integrations/microsoft-365";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@workspace/ui/components/tabs";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@workspace/ui/components/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog";

export default function Microsoft365Connections() {
    const integration = useIntegration();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedConnection, setSelectedConnection] = useState<Doc<'data_sources'> | null>(null);
    const [currentTab, setCurrentTab] = useState('connections');
    const [domainMappings, setDomainMappings] = useState<{ domain: string; siteId: string }[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [connectionName, setConnectionName] = useState('');
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    // Filter state
    const [filter, setFilter] = useState<'all' | 'needs-reconsent'>('all');
    const [connectionPermissions, setConnectionPermissions] = useState<Map<string, boolean>>(new Map());
    const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);

    // Connection Settings state
    const [editedConnectionName, setEditedConnectionName] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);
    const [isSavingName, setIsSavingName] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [permissionStatus, setPermissionStatus] = useState<{
        needsReconsent: boolean;
        currentVersion: number;
        connectionVersion: number;
    } | null>(null);

    const primaryDataSource = useQuery(
        api.helpers.orm.get,
        {
            tableName: 'data_sources',
            index: {
                name: 'by_integration_primary',
                params: {
                    integrationId: integration._id,
                    isPrimary: true
                }
            }
        }
    ) as Doc<'data_sources'> | undefined;

    const dataSources = useQuery(
        api.helpers.orm.list,
        {
            tableName: 'data_sources',
            index: {
                name: 'by_integration',
                params: {
                    integrationId: integration._id
                }
            },
            filters: {
                isPrimary: false
            }
        }
    ) as Doc<'data_sources'>[] | undefined;

    const sites = useQuery(
        api.helpers.orm.list,
        {
            tableName: 'sites'
        }
    ) as Doc<'sites'>[] | undefined;

    const dataSourceToSiteLinks = useQuery(
        api.helpers.orm.list,
        {
            tableName: 'data_source_to_site',
            index: {
                name: 'by_integration',
                params: {
                    integrationId: integration._id
                }
            }
        }
    ) as Doc<'data_source_to_site'>[] | undefined;

    const updateM365DomainMappingsMutation = useMutation(api.datasources.mutate.updateM365DomainMappings);
    const scheduleJobsMutation = useMutation(api.scheduledjobs.mutate.scheduleJobsByIntegration);

    const isLoading = dataSources === undefined || sites === undefined || dataSourceToSiteLinks === undefined;

    // Batch check permission versions for all connections
    useEffect(() => {
        if (!dataSources || dataSources.length === 0) {
            setIsCheckingPermissions(false);
            return;
        }

        setIsCheckingPermissions(true);

        // Check all connections in parallel
        Promise.all(
            dataSources.map(async (ds) => {
                const result = await checkPermissionVersion({ dataSourceId: ds._id });
                return {
                    connectionId: ds._id,
                    needsReconsent: result.data?.needsReconsent || false
                };
            })
        ).then((results) => {
            const permissionsMap = new Map<string, boolean>();
            results.forEach(({ connectionId, needsReconsent }) => {
                permissionsMap.set(connectionId, needsReconsent);
            });
            setConnectionPermissions(permissionsMap);
            setIsCheckingPermissions(false);
        });
    }, [dataSources]);

    // Check permission version when connection is selected
    useEffect(() => {
        if (selectedConnection) {
            checkPermissionVersion({ dataSourceId: selectedConnection._id }).then((result) => {
                if (result.data) {
                    setPermissionStatus(result.data);
                }
            });
        }
    }, [selectedConnection]);

    // Filter by search query
    const searchFilteredConnections = useMemo(() => {
        if (!dataSources) return [];
        if (!searchQuery.trim()) return dataSources;
        return dataSources.filter((ds) => {
            const config = ds.config as Microsoft365DataSourceConfig;
            return (
                config.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                config.tenantName?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        });
    }, [dataSources, searchQuery]);

    // Filter by permission status
    const filteredConnections = useMemo(() => {
        if (filter === 'needs-reconsent') {
            return searchFilteredConnections.filter(conn =>
                connectionPermissions.get(conn._id) === true
            );
        }
        return searchFilteredConnections;
    }, [searchFilteredConnections, filter, connectionPermissions]);

    // Count connections needing reconsent
    const needsReconsentCount = useMemo(() => {
        return searchFilteredConnections.filter(conn =>
            connectionPermissions.get(conn._id) === true
        ).length;
    }, [searchFilteredConnections, connectionPermissions]);

    const getAvailableSites = (currentDataSourceId: string) => {
        if (!sites || !dataSourceToSiteLinks) return [];

        // Get sites that are not linked to any OTHER M365 data source
        const linkedSiteIds = dataSourceToSiteLinks
            .filter((link) => link.dataSourceId !== currentDataSourceId)
            .map((link) => link.siteId);

        return sites.filter((site) => !linkedSiteIds.includes(site._id));
    };

    const selectConnection = (connection: Doc<'data_sources'>) => {
        setSelectedConnection(connection);
        const config = connection.config as Microsoft365DataSourceConfig;
        setDomainMappings(config.domainMappings || []);
        setEditedConnectionName(config.name);
        setIsEditingName(false);
        setCurrentTab('sites');
    };

    const backToConnections = () => {
        setSelectedConnection(null);
        setDomainMappings([]);
        setEditedConnectionName('');
        setIsEditingName(false);
        setCurrentTab('connections');
    };

    const updateMapping = (domain: string, siteId: string | undefined) => {
        if (!siteId) {
            // Remove mapping
            setDomainMappings(prev => prev.filter((m) => m.domain !== domain));
        } else {
            // Add or update mapping
            setDomainMappings(prev => {
                const existing = prev.find((m) => m.domain === domain);
                if (existing) {
                    return prev.map(m => m.domain === domain ? { ...m, siteId } : m);
                } else {
                    return [...prev, { domain, siteId }];
                }
            });
        }
    };

    const getMappedSite = (domain: string) => {
        const mapping = domainMappings.find((m) => m.domain === domain);
        return mapping && sites ? sites.find((s) => s._id === mapping.siteId) : undefined;
    };

    const saveDomainMappings = async () => {
        if (!selectedConnection) return;

        setIsSaving(true);
        try {
            await updateM365DomainMappingsMutation({
                dataSourceId: selectedConnection._id,
                domainMappings
            });

            await scheduleJobsMutation({
                integrationId: selectedConnection.integrationId,
                dataSourceId: selectedConnection._id,
                scheduledAt: Date.now()
            });

            toast.success('Domain mappings saved successfully!');

            // Update selected connection to reflect new mappings
            const updatedConfig = { ...selectedConnection.config, domainMappings } as Microsoft365DataSourceConfig;
            setSelectedConnection({ ...selectedConnection, config: updatedConfig });
        } catch (error) {
            console.error('Failed to save mappings:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to save domain mappings');
        } finally {
            setIsSaving(false);
        }
    };

    const saveConnectionName = async () => {
        if (!selectedConnection || !editedConnectionName.trim()) return;

        setIsSavingName(true);
        try {
            const result = await updateConnectionName({
                dataSourceId: selectedConnection._id,
                newName: editedConnectionName.trim()
            });

            if (result.error) {
                throw new Error(result.error);
            }

            toast.success('Connection name updated!');
            setIsEditingName(false);

            // Update local state
            const updatedConfig = { ...selectedConnection.config, name: editedConnectionName.trim() } as Microsoft365DataSourceConfig;
            setSelectedConnection({ ...selectedConnection, config: updatedConfig });
        } catch (error: any) {
            toast.error('Failed to update name: ' + (error.message || 'Unknown error'));
        } finally {
            setIsSavingName(false);
        }
    };

    const handleDeleteConnection = async () => {
        if (!selectedConnection) return;

        setIsDeleting(true);
        try {
            const result = await deleteConnectionAction(selectedConnection._id);

            if (result.error) {
                throw new Error(result.error);
            }

            toast.success('Connection deleted successfully');
            setDeleteDialogOpen(false);
            backToConnections();
        } catch (error: any) {
            toast.error('Failed to delete connection: ' + (error.message || 'Unknown error'));
        } finally {
            setIsDeleting(false);
        }
    };

    const handleReconsent = async () => {
        if (!selectedConnection || !primaryDataSource) return;

        const config = selectedConnection.config as Microsoft365DataSourceConfig;
        setIsRedirecting(true);

        try {
            const result = await generateConsentUrl({
                tenantId: primaryDataSource.tenantId,
                dataSourceId: primaryDataSource._id,
                connectionName: config.name,
            });

            if (result.error || !result.data) {
                throw new Error(result.error || 'Failed to generate consent URL');
            }

            window.location.href = result.data;
        } catch (error: any) {
            toast.error('Failed to start reconsent flow: ' + (error.message || 'Unknown error'));
            setIsRedirecting(false);
        }
    };

    const getDomainCountText = (config: Microsoft365DataSourceConfig) => {
        const total = config.availableDomains?.length || 0;
        const mapped = config.domainMappings?.length || 0;
        return `${mapped} of ${total} domains mapped`;
    };

    const handleCreateConnection = async () => {
        if (!connectionName.trim()) {
            toast.error('Please enter a connection name');
            return;
        }

        if (!primaryDataSource) {
            toast.error('Primary data source not found');
            return;
        }

        setIsRedirecting(true);

        try {
            const tenantId = primaryDataSource.tenantId;

            const result = await generateConsentUrl({
                tenantId,
                dataSourceId: primaryDataSource._id,
                connectionName: connectionName.trim(),
            });

            if (result.error || !result.data) {
                throw new Error(result.error || 'Failed to generate consent URL');
            }

            setDialogOpen(false);
            window.location.href = result.data;
        } catch (error: any) {
            toast.error('Failed to start consent flow: ' + (error.message || 'Unknown error'));
            setIsRedirecting(false);
        }
    };

    const isMappingsChanged = useMemo(() => {
        if (!selectedConnection) return false;
        const existing = selectedConnection.config as Microsoft365DataSourceConfig;
        return JSON.stringify(existing.domainMappings) !== JSON.stringify(domainMappings);
    }, [selectedConnection, domainMappings]);

    if (isLoading) {
        return <Loader />;
    }

    return (
        <div className="flex flex-col gap-4 size-full">
            <Tabs value={currentTab} onValueChange={setCurrentTab} className="size-full flex flex-col overflow-hidden">
                <TabsList>
                    <TabsTrigger value="connections">Connections</TabsTrigger>
                    <TabsTrigger value="sites" disabled={!selectedConnection}>Connection Settings</TabsTrigger>
                </TabsList>

                {/* Connections Tab */}
                <TabsContent value="connections" className="flex flex-col gap-4 overflow-hidden flex-1">
                    {/* Filter Buttons */}
                    <div className="flex gap-2">
                        <Button
                            variant={filter === 'all' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setFilter('all')}
                            disabled={isCheckingPermissions}
                        >
                            All ({searchFilteredConnections.length})
                        </Button>
                        <Button
                            variant={filter === 'needs-reconsent' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setFilter('needs-reconsent')}
                            disabled={isCheckingPermissions}
                            className={needsReconsentCount > 0 ? 'border-yellow-500/50' : ''}
                        >
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Needs Reconsent ({needsReconsentCount})
                        </Button>
                    </div>

                    <div className="flex w-full justify-between">
                        <div className="relative w-1/3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search connections"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="gap-2">
                                    <Plus className="w-4 h-4" />
                                    Add Connection
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Add Microsoft 365 Connection</DialogTitle>
                                    <DialogDescription>
                                        Create a connection to a Microsoft 365 tenant. You'll be redirected to Microsoft to grant admin consent.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="flex flex-col gap-4 mt-4">
                                    <div className="flex flex-col gap-2">
                                        <Label htmlFor="dialogConnectionName">Connection Name</Label>
                                        <Input
                                            id="dialogConnectionName"
                                            placeholder="e.g., Main Tenant, Customer A"
                                            value={connectionName}
                                            onChange={(e) => setConnectionName(e.target.value)}
                                            disabled={isRedirecting}
                                        />
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <Button
                                            variant="outline"
                                            onClick={() => setDialogOpen(false)}
                                            disabled={isRedirecting}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={handleCreateConnection}
                                            disabled={!connectionName.trim() || isRedirecting}
                                            className="gap-2"
                                        >
                                            {isRedirecting && <Spinner size={16} />}
                                            {isRedirecting ? 'Redirecting...' : 'Connect to Microsoft'}
                                        </Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="flex-1 overflow-auto pr-3">
                        <div className="grid gap-3">
                            {filteredConnections.map((connection) => {
                                const config = connection.config as Microsoft365DataSourceConfig;
                                const needsReconsent = connectionPermissions.get(connection._id) === true;
                                return (
                                    <div
                                        key={connection._id}
                                        className={`bg-card/50 border rounded shadow flex items-center justify-between p-4 hover:shadow-md transition-shadow ${needsReconsent ? 'border-yellow-500/30' : ''
                                            }`}
                                    >
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <span className="text-lg font-semibold">{config.name}</span>
                                                <Badge variant={connection.status === 'active' ? 'default' : 'secondary'}>
                                                    {prettyText(connection.status)}
                                                </Badge>
                                                {!isCheckingPermissions && (
                                                    needsReconsent ? (
                                                        <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600">
                                                            <AlertTriangle className="w-3 h-3" />
                                                            Reconsent Required
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="gap-1 border-green-500/50 text-green-600">
                                                            <CheckCircle className="w-3 h-3" />
                                                            Up to date
                                                        </Badge>
                                                    )
                                                )}
                                            </div>
                                            <div className="text-muted-foreground flex flex-col gap-1 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="h-4 w-4" />
                                                    <span>{config.tenantName}</span>
                                                </div>
                                                <span>{getDomainCountText(config)}</span>
                                            </div>
                                        </div>
                                        <Button
                                            variant="outline"
                                            onClick={() => selectConnection(connection)}
                                            className="gap-2"
                                        >
                                            <Settings className="h-4 w-4" />
                                            Manage Connection
                                        </Button>
                                    </div>
                                );
                            })}

                            {filteredConnections.length === 0 && (
                                <div className="text-muted-foreground flex items-center justify-center p-8">
                                    <p>
                                        {searchQuery ? 'No connections found matching your search' : 'No connections yet'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </TabsContent>

                {/* Connection Settings Tab */}
                <TabsContent value="sites" className="flex flex-col gap-4 overflow-hidden flex-1">
                    {!selectedConnection ? (
                        <div className="text-muted-foreground flex size-full items-center justify-center">
                            <p>Select a connection to manage settings</p>
                        </div>
                    ) : (
                        <>
                            {(() => {
                                const config = selectedConnection.config as Microsoft365DataSourceConfig;
                                const availableSites = getAvailableSites(selectedConnection._id);
                                const siteOptions = availableSites.map(site => ({
                                    label: site.name,
                                    value: site._id
                                }));

                                return (
                                    <>
                                        {/* Header with Back Button */}
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="icon" onClick={backToConnections}>
                                                <ArrowLeft className="h-4 w-4" />
                                            </Button>
                                            <h2 className="text-xl font-semibold">Connection Settings</h2>
                                        </div>

                                        {/* Connection Settings Section */}
                                        <div className="bg-card/50 border rounded shadow p-6 flex flex-col gap-4">
                                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                                <Settings className="w-5 h-5" />
                                                Connection Details
                                            </h3>

                                            {/* Connection Name */}
                                            <div className="flex flex-col gap-2">
                                                <Label>Connection Name</Label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        value={editedConnectionName}
                                                        onChange={(e) => setEditedConnectionName(e.target.value)}
                                                        disabled={!isEditingName}
                                                        className="flex-1"
                                                    />
                                                    {!isEditingName ? (
                                                        <Button
                                                            variant="outline"
                                                            onClick={() => setIsEditingName(true)}
                                                            className="gap-2"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                            Edit
                                                        </Button>
                                                    ) : (
                                                        <>
                                                            <Button
                                                                onClick={saveConnectionName}
                                                                disabled={isSavingName || !editedConnectionName.trim()}
                                                                className="gap-2"
                                                            >
                                                                {isSavingName && <Spinner size={16} />}
                                                                Save
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                onClick={() => {
                                                                    setEditedConnectionName(config.name);
                                                                    setIsEditingName(false);
                                                                }}
                                                                disabled={isSavingName}
                                                            >
                                                                Cancel
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Tenant Info (Read-only) */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="flex flex-col gap-2">
                                                    <Label className="text-muted-foreground">Tenant Name</Label>
                                                    <div className="flex items-center gap-2 p-2 bg-muted/20 rounded border">
                                                        <Building2 className="w-4 h-4 text-muted-foreground" />
                                                        <span className="text-sm">{config.tenantName}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <Label className="text-muted-foreground">Tenant ID</Label>
                                                    <div className="p-2 bg-muted/20 rounded border">
                                                        <span className="text-sm font-mono">{config.tenantId}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Permission Version */}
                                            <div className="flex items-center justify-between p-4 bg-muted/20 rounded border">
                                                <div className="flex items-center gap-3">
                                                    <ShieldCheck className="w-5 h-5 text-muted-foreground" />
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium">Permissions</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            Version {config.permissionVersion}
                                                        </span>
                                                    </div>
                                                </div>
                                                {permissionStatus?.needsReconsent ? (
                                                    <Button
                                                        variant="outline"
                                                        onClick={handleReconsent}
                                                        disabled={isRedirecting}
                                                        className="gap-2"
                                                    >
                                                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                                        {isRedirecting ? 'Redirecting...' : 'Reconsent Required'}
                                                    </Button>
                                                ) : (
                                                    <Badge className="bg-green-500/50">Up to date</Badge>
                                                )}
                                            </div>

                                            {/* Delete Connection */}
                                            <div className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium">Delete Connection</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        Permanently remove this connection and all its mappings
                                                    </span>
                                                </div>
                                                <Button
                                                    variant="destructive"
                                                    onClick={() => setDeleteDialogOpen(true)}
                                                    className="gap-2"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Domain Mappings Section */}
                                        <div className="bg-card/50 border rounded shadow flex flex-col gap-3 overflow-hidden p-4 flex-1">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-lg font-semibold">Domain Mappings</h3>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground text-sm">
                                                        {domainMappings.length} of {config.availableDomains?.length || 0} domains mapped
                                                    </span>
                                                    <Button
                                                        onClick={saveDomainMappings}
                                                        disabled={isSaving || !isMappingsChanged}
                                                        className="gap-2"
                                                    >
                                                        {isSaving && <Spinner size={16} />}
                                                        <Save className="h-4 w-4" />
                                                        {isSaving ? 'Saving...' : 'Save Changes'}
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                <Input
                                                    placeholder="Search domains"
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className="pl-9"
                                                />
                                            </div>

                                            <div className="flex-1 overflow-auto pr-3">
                                                <div className="space-y-2">
                                                    {(config.availableDomains || [])
                                                        .filter((ad) =>
                                                            ad.name.toLowerCase().includes(searchTerm.toLowerCase())
                                                        )
                                                        .map((domain) => {
                                                            const mappedSite = getMappedSite(domain.name);
                                                            return (
                                                                <div
                                                                    key={domain.name}
                                                                    className="flex w-full items-center border rounded p-3 gap-3"
                                                                >
                                                                    <div className="flex-1">
                                                                        <div className="text-sm font-medium">
                                                                            {domain.name}
                                                                        </div>
                                                                        {domain.isDefault && (
                                                                            <Badge variant="secondary" className="mt-1">
                                                                                Default
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex gap-2 items-center min-w-[250px]">
                                                                        <SearchBox
                                                                            options={siteOptions}
                                                                            defaultValue={mappedSite?._id}
                                                                            placeholder="Select site..."
                                                                            onSelect={(value) => updateMapping(domain.name, value)}
                                                                            className="flex-1"
                                                                        />
                                                                        {mappedSite && (
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                onClick={() => updateMapping(domain.name, undefined)}
                                                                            >
                                                                                <X className="h-4 w-4" />
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </>
                    )}
                </TabsContent>
            </Tabs>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Connection?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the connection and all its domain mappings.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConnection}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting && <Spinner size={16} className="mr-2" />}
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
