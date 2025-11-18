"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, Doc } from "@/lib/api";
import { useQuery, useMutation } from "convex/react";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import Loader from "@workspace/ui/components/Loader";
import { CheckCircle, Cloud, Settings, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useIntegration } from "../integration-provider";
import { enableIntegration, generateConsentUrl } from "../actions";
import { Spinner } from "@workspace/ui/components/Spinner";

export default function Microsoft365Setup() {
    const router = useRouter();
    const integration = useIntegration();

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
            },
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
            }
        }
    ) as Doc<'data_sources'>[] | undefined;

    const [isEnabling, setIsEnabling] = useState(false);
    const [currentStep, setCurrentStep] = useState<'enable' | 'primary-source' | 'connection'>('enable');
    const [connectionName, setConnectionName] = useState('');
    const [isRedirecting, setIsRedirecting] = useState(false);

    const createOrUpdateDataSource = useMutation(api.datasources.mutate.createOrUpdate);

    const isEnabled = !!primaryDataSource;

    // Determine current step
    useEffect(() => {
        if (!isEnabled) {
            setCurrentStep('enable');
        } else if (!dataSources?.some(ds => ds.isPrimary)) {
            setCurrentStep('primary-source');
        } else {
            setCurrentStep('connection');
        }
    }, [isEnabled, dataSources]);

    const handleEnable = async () => {
        setIsEnabling(true);
        try {
            // Create primary data source with minimal config
            await createOrUpdateDataSource({
                integrationId: integration._id,
                config: { permissionVersion: 0 },
                credentialExpirationAt: Number.MAX_SAFE_INTEGER,
            });

            toast.success('Microsoft 365 integration enabled!');
            setCurrentStep('primary-source');
        } catch (error: any) {
            toast.error('Failed to enable integration: ' + (error.message || 'Unknown error'));
        } finally {
            setIsEnabling(false);
        }
    };

    const handleSetPrimarySource = async (sourceType: 'm365' | 'other') => {
        try {
            if (!primaryDataSource) return;

            await createOrUpdateDataSource({
                integrationId: integration._id,
                config: { permissionVersion: 0, primarySource: sourceType },
                credentialExpirationAt: Number.MAX_SAFE_INTEGER,
            });

            toast.success(`Primary data source set to ${sourceType === 'm365' ? 'Microsoft 365' : 'Other'}`);
            setCurrentStep('connection');
        } catch (error: any) {
            toast.error('Failed to set primary source: ' + (error.message || 'Unknown error'));
        }
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
            // Get tenant ID from Convex auth (you may need to adjust this)
            // For now, using the primary data source's tenant ID
            const tenantId = primaryDataSource.tenantId;

            const result = await generateConsentUrl({
                tenantId,
                dataSourceId: primaryDataSource._id,
                connectionName: connectionName.trim(),
            });

            if (result.error || !result.data) {
                throw new Error(result.error || 'Failed to generate consent URL');
            }

            // Redirect to Microsoft admin consent
            window.location.href = result.data;
        } catch (error: any) {
            toast.error('Failed to start consent flow: ' + (error.message || 'Unknown error'));
            setIsRedirecting(false);
        }
    };

    if (primaryDataSource === undefined || dataSources === undefined) {
        return <Loader />;
    }

    return (
        <div className="flex flex-col gap-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3">
                {integration.iconUrl && (
                    <img
                        src={integration.iconUrl}
                        alt={integration.name}
                        className="w-12 h-12 rounded"
                    />
                )}
                <div>
                    <h1 className="text-2xl font-semibold">Microsoft 365 Setup</h1>
                    <p className="text-sm text-muted-foreground">
                        Configure your Microsoft 365 integration
                    </p>
                </div>
            </div>

            {/* Progress Indicator */}
            <div className="flex gap-4">
                <div className={`flex items-center gap-2 ${currentStep === 'enable' ? 'text-primary' : isEnabled ? 'text-green-400' : 'text-muted-foreground'}`}>
                    {isEnabled ? <CheckCircle className="w-5 h-5" /> : <div className="w-5 h-5 rounded-full border-2" />}
                    <span className="text-sm font-medium">Enable Integration</span>
                </div>
                <div className={`flex items-center gap-2 ${currentStep === 'primary-source' ? 'text-primary' : currentStep === 'connection' ? 'text-green-400' : 'text-muted-foreground'}`}>
                    {currentStep === 'connection' ? <CheckCircle className="w-5 h-5" /> : <div className="w-5 h-5 rounded-full border-2" />}
                    <span className="text-sm font-medium">Primary Source</span>
                </div>
                <div className={`flex items-center gap-2 ${currentStep === 'connection' ? 'text-primary' : 'text-muted-foreground'}`}>
                    <div className="w-5 h-5 rounded-full border-2" />
                    <span className="text-sm font-medium">Add Connection</span>
                </div>
            </div>

            {/* Step: Enable Integration */}
            {currentStep === 'enable' && (
                <div className="bg-card/50 border rounded shadow p-6 flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-semibold">Enable Microsoft 365 Integration</h2>
                    </div>
                    <p className="text-muted-foreground">
                        Enable the Microsoft 365 integration to start syncing users, groups, licenses,
                        and more from your Entra tenants.
                    </p>
                    <div className="flex gap-2">
                        <Button
                            onClick={handleEnable}
                            disabled={isEnabling}
                            className="gap-2"
                        >
                            {isEnabling && <Spinner size={16} />}
                            {isEnabling ? 'Enabling...' : 'Enable Integration'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Step: Set Primary Data Source */}
            {currentStep === 'primary-source' && (
                <div className="bg-card/50 border rounded shadow p-6 flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-semibold">Select Primary Data Source</h2>
                    </div>
                    <p className="text-muted-foreground">
                        Choose whether Microsoft 365 should be your primary source for user data,
                        or if you're using another integration as the primary source.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => handleSetPrimarySource('m365')}
                            className="bg-card/30 border rounded p-4 hover:border-primary transition-colors flex flex-col gap-2"
                        >
                            <Cloud className="w-8 h-8 text-primary" />
                            <span className="font-medium">Microsoft 365</span>
                            <span className="text-xs text-muted-foreground">
                                Use M365 as primary identity source
                            </span>
                        </button>
                        <button
                            onClick={() => handleSetPrimarySource('other')}
                            className="bg-card/30 border rounded p-4 hover:border-primary transition-colors flex flex-col gap-2"
                        >
                            <Settings className="w-8 h-8 text-muted-foreground" />
                            <span className="font-medium">Other Source</span>
                            <span className="text-xs text-muted-foreground">
                                Use another integration as primary
                            </span>
                        </button>
                    </div>
                </div>
            )}

            {/* Step: Add First Connection */}
            {currentStep === 'connection' && (
                <div className="bg-card/50 border rounded shadow p-6 flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <Cloud className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-semibold">Add Your First Connection</h2>
                    </div>
                    <p className="text-muted-foreground">
                        Create a connection to a Microsoft 365 tenant. You'll be redirected to Microsoft
                        to grant admin consent for accessing tenant data.
                    </p>

                    <div className="flex flex-col gap-4 mt-2">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="connectionName">Connection Name</Label>
                            <Input
                                id="connectionName"
                                type="text"
                                placeholder="e.g., Main Tenant, Customer A"
                                value={connectionName}
                                onChange={(e) => setConnectionName(e.target.value)}
                                className="bg-input border-border"
                                disabled={isRedirecting}
                            />
                            <p className="text-xs text-muted-foreground">
                                A friendly name to identify this Microsoft 365 tenant
                            </p>
                        </div>

                        <div className="bg-blue-500/10 border border-blue-500/20 rounded p-4 flex gap-3">
                            <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                            <div className="flex flex-col gap-1">
                                <span className="text-sm font-medium text-blue-400">Admin Consent Required</span>
                                <span className="text-xs text-muted-foreground">
                                    You'll need Global Administrator permissions in the Microsoft 365 tenant
                                    to grant the necessary permissions for this integration.
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                onClick={handleCreateConnection}
                                disabled={!connectionName.trim() || isRedirecting}
                                className="gap-2"
                            >
                                {isRedirecting && <Spinner size={16} />}
                                {isRedirecting ? 'Redirecting...' : 'Connect to Microsoft'}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => router.push('/secure/default/integrations/microsoft-365')}
                                disabled={isRedirecting}
                            >
                                Skip for Now
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Already Configured Message */}
            {isEnabled && primaryDataSource && (
                <div className="bg-green-500/10 border border-green-500/20 rounded p-4 flex gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                    <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-green-400">Integration Enabled</span>
                        <span className="text-xs text-muted-foreground">
                            You can manage connections and domain mappings from the Connections page.
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
