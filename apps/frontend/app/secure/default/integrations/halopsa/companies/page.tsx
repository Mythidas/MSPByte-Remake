"use client";

import { useState, useMemo } from "react";
import { api } from "@/lib/api";
import { useQuery } from "convex/react";
import { CompanyMappingCard } from "@/components/integrations/CompanyMappingCard";
import { SiteLinker } from "@/components/integrations/SiteLinker";
import SearchBar from "@/components/SearchBar";
import { Badge } from "@workspace/ui/components/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@workspace/ui/components/select";
import Loader from "@workspace/ui/components/Loader";
import { Search, AlertCircle, Filter } from "lucide-react";
import { toast } from "sonner";
import { useIntegration } from "../integration-provider";

export default function HaloPSACompanies() {
    const integration = useIntegration();
    const dataSource = useQuery(
        api.helpers.orm.get,
        {
            tableName: 'data_sources',
            index: {
                name: 'by_integration',
                params: {
                    integrationId: integration._id
                }
            },
            filters: {
                isPrimary: true
            }
        }
    );

    const companies = useQuery(
        api.helpers.orm.list,
        dataSource ? {
            tableName: 'entities',
            index: {
                name: 'by_data_source',
                params: {
                    dataSourceId: dataSource._id
                }
            },
            filters: {
                entityType: 'companies'
            }
        } : 'skip'
    );

    const allSites = useQuery(
        api.helpers.orm.list,
        {
            tableName: 'sites'
        }
    );

    const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [linkFilter, setLinkFilter] = useState<'all' | 'linked' | 'unlinked'>('all');

    // Transform companies data to include link information (must be before conditional return)
    const transformedCompanies = useMemo(() => {
        if (!companies || !allSites) return [];

        return companies.map((company: any) => {
            // Find if this company is linked to a site
            const linkedSite = allSites.find((site: any) =>
                site.psaIntegrationId === integration._id &&
                site.psaCompanyId === company.externalId
            );

            return {
                _id: company._id,
                name: company.normalizedData?.name || company.rawData?.name,
                externalId: company.externalId,
                externalParentId: company.normalizedData?.externalParentId || company.rawData?.parent_id,
                isLinked: !!linkedSite,
                linkedId: linkedSite?._id,
                linkedSlug: linkedSite?.slug,
                linkedName: linkedSite?.name
            };
        });
    }, [companies, allSites, integration]);

    // Filter companies
    const filteredCompanies = useMemo(() => {
        return transformedCompanies.filter((company) => {
            // Link status filter
            if (linkFilter === 'linked' && !company.isLinked) return false;
            if (linkFilter === 'unlinked' && company.isLinked) return false;

            // Search filter
            if (searchQuery) {
                const searchLower = searchQuery.toLowerCase();
                const matchesName = company.name?.toLowerCase().includes(searchLower);
                const matchesId = company.externalId?.toLowerCase().includes(searchLower);
                if (!matchesName && !matchesId) return false;
            }

            return true;
        });
    }, [transformedCompanies, linkFilter, searchQuery]);

    // Get available sites (not already linked to HaloPSA)
    const availableSites = useMemo(() => {
        if (!allSites) return [];
        return allSites.filter((site: any) => !site.psaIntegrationId || site.psaIntegrationId !== integration._id);
    }, [allSites, integration]);

    const selectedCompany = selectedCompanyId
        ? transformedCompanies.find(c => c._id === selectedCompanyId)
        : null;

    const linkedCount = transformedCompanies.filter(c => c.isLinked).length;
    const unlinkedCount = transformedCompanies.filter(c => !c.isLinked).length;

    // Early return after all hooks
    if (!dataSource) {
        return (
            <div className="flex flex-col gap-4 items-center justify-center size-full">
                <AlertCircle className="w-12 h-12 text-muted-foreground" />
                <p className="text-muted-foreground">
                    Please configure the integration first
                </p>
            </div>
        );
    }

    const handleLink = async (companyId: string, siteId: string) => {
        // TODO: Implement via Convex mutation
        await new Promise(resolve => setTimeout(resolve, 1000));
        toast.success('Company linked to site');
    };

    const handleUnlink = async (companyId: string) => {
        // TODO: Implement via Convex mutation
        await new Promise(resolve => setTimeout(resolve, 1000));
        toast.success('Company unlinked from site');
    };

    const handleCreate = async (companyId: string, siteName: string) => {
        // TODO: Implement via Convex mutation
        await new Promise(resolve => setTimeout(resolve, 1000));
        toast.success('Site created and linked');
    };

    return (
        <div className="flex flex-col gap-4 size-full">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Company Mapping</h1>
                    <p className="text-muted-foreground">
                        Link HaloPSA companies to MSPByte sites
                    </p>
                </div>

                {/* Stats */}
                <div className="flex gap-4">
                    <div className="flex flex-col items-end">
                        <span className="text-2xl font-semibold">{linkedCount}</span>
                        <span className="text-xs text-muted-foreground">Linked</span>
                    </div>
                    <div className="h-12 w-px bg-border" />
                    <div className="flex flex-col items-end">
                        <span className="text-2xl font-semibold">{unlinkedCount}</span>
                        <span className="text-xs text-muted-foreground">Unlinked</span>
                    </div>
                    <div className="h-12 w-px bg-border" />
                    <div className="flex flex-col items-end">
                        <span className="text-2xl font-semibold">{transformedCompanies.length}</span>
                        <span className="text-xs text-muted-foreground">Total</span>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex gap-4 flex-1 overflow-hidden">
                {/* Company List */}
                <div className="flex flex-col gap-3 w-2/5 min-w-[400px]">
                    {/* Filters */}
                    <div className="bg-card/50 border rounded shadow p-3 flex gap-2">
                        <SearchBar
                            placeholder="Search companies..."
                            onSearch={setSearchQuery}
                            lead={<Search className="w-4" />}
                            className="!bg-input flex-1"
                        />
                        <Select value={linkFilter} onValueChange={(value: any) => setLinkFilter(value)}>
                            <SelectTrigger className="w-40 bg-input border-border">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Companies</SelectItem>
                                <SelectItem value="linked">Linked Only</SelectItem>
                                <SelectItem value="unlinked">Unlinked Only</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Company List */}
                    <div className="bg-card/50 border rounded shadow flex-1 overflow-auto">
                        {!companies || !allSites ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader />
                            </div>
                        ) : filteredCompanies.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-muted-foreground">
                                <AlertCircle className="w-12 h-12" />
                                <p className="text-center">
                                    {searchQuery || linkFilter !== 'all'
                                        ? 'No companies match your filters'
                                        : 'No companies synced yet'
                                    }
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2 p-3">
                                {filteredCompanies.map((company) => (
                                    <CompanyMappingCard
                                        key={company._id}
                                        company={company}
                                        isSelected={selectedCompanyId === company._id}
                                        onClick={() => setSelectedCompanyId(company._id)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Results Count */}
                    {filteredCompanies.length > 0 && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                            Showing {filteredCompanies.length} of {transformedCompanies.length} companies
                        </div>
                    )}
                </div>

                {/* Site Linker Panel */}
                <div className="flex-1 bg-card/50 border rounded shadow overflow-auto">
                    <div className="h-full p-4">
                        <SiteLinker
                            company={selectedCompany || null}
                            availableSites={availableSites}
                            onLink={handleLink}
                            onUnlink={handleUnlink}
                            onCreate={handleCreate}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
