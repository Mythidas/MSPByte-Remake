"use client";

import { useState, useMemo } from "react";
import { api, Doc } from "@/lib/api";
import { useQuery, useMutation } from "convex/react";
import { CompanyMappingCard } from "@/components/integrations/CompanyMappingCard";
import { SiteLinker } from "@/components/integrations/SiteLinker";
import SearchBar from "@/components/SearchBar";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import Loader from "@workspace/ui/components/Loader";
import { Search, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { INTEGRATIONS } from "@workspace/shared/types/integrations/config";
import Link from "next/link";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { syncHaloPSASites, toggleHideStatus } from "./actions";
import { pushSiteVariable as pushDattoVariable } from "../dattormm/actions";
import { ConvexHttpClient } from "convex/browser";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function HaloPSAPage() {
	const integration = INTEGRATIONS["halopsa"];

	// Fetch HaloPSA data source for companies using *_s variant
	const dataSource = useQuery(api.helpers.orm.get_s, {
		secret: process.env.NEXT_PUBLIC_CONVEX_SECRET!,
		tableName: "data_sources",
		index: {
			name: "by_integration",
			params: {
				integrationId: "halopsa",
			},
		},
		filters: {
			isPrimary: true,
		},
	}) as Doc<"data_sources"> | undefined;

	// Fetch companies (entities) using *_s variant
	const companies = useQuery(
		api.helpers.orm.list_s,
		dataSource
			? {
					secret: process.env.NEXT_PUBLIC_CONVEX_SECRET!,
					tableName: "entities",
					index: {
						name: "by_data_source",
						params: {
							dataSourceId: dataSource._id,
						},
					},
					filters: {
						entityType: "companies",
					},
				}
			: "skip"
	) as Doc<"entities">[] | undefined;

	// Fetch all sites using *_s variant
	const allSites = useQuery(api.helpers.orm.list_s, {
		secret: process.env.NEXT_PUBLIC_CONVEX_SECRET!,
		tableName: "sites",
	}) as Doc<"sites">[] | undefined;

	const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
		null
	);
	const [searchQuery, setSearchQuery] = useState("");
	const [linkFilter, setLinkFilter] = useState<"all" | "linked" | "unlinked">(
		"all"
	);
	const [hideFilter, setHideFilter] = useState<"visible" | "all" | "hidden">(
		"visible"
	);
	const [isSyncing, setIsSyncing] = useState(false);

	// Mutation hooks
	const linkSite = useMutation(api.sites.mutate.linkToPSACompany);
	const unlinkSite = useMutation(api.sites.mutate.unlinkFromPSACompany);
	const createSite = useMutation(api.sites.mutate.createFromPSACompany);

	// Transform companies data to include link information
	const transformedCompanies = useMemo(() => {
		if (!companies || !allSites) return [];

		return companies.map((company: any) => {
			// Find if this company is linked to a site
			const linkedSite = allSites.find(
				(site: any) =>
					site.psaIntegrationId === integration.slug &&
					site.psaCompanyId === company.externalId
			);

			// Extract hidden status from tags array
			const isHidden = company.tags?.includes("cust_hidden") || false;

			return {
				_id: company._id,
				name: company.normalizedData?.name || company.rawData?.name,
				externalId: company.externalId,
				externalParentId:
					company.normalizedData?.externalParentId ||
					company.rawData?.parent_id,
				isLinked: !!linkedSite,
				linkedId: linkedSite?._id,
				linkedSlug: linkedSite?.slug,
				linkedName: linkedSite?.name,
				isHidden,
			};
		});
	}, [companies, allSites, integration]);

	// Filter companies
	const filteredCompanies = useMemo(() => {
		return transformedCompanies.filter((company) => {
			// Hide filter (applied first for performance)
			if (hideFilter === "visible" && company.isHidden) return false;
			if (hideFilter === "hidden" && !company.isHidden) return false;

			// Link status filter
			if (linkFilter === "linked" && !company.isLinked) return false;
			if (linkFilter === "unlinked" && company.isLinked) return false;

			// Search filter
			if (searchQuery) {
				const searchLower = searchQuery.toLowerCase();
				const matchesName = company.name?.toLowerCase().includes(searchLower);
				const matchesId = company.externalId
					?.toLowerCase()
					.includes(searchLower);
				if (!matchesName && !matchesId) return false;
			}

			return true;
		});
	}, [transformedCompanies, linkFilter, searchQuery, hideFilter]);

	// Get available sites (not already linked to HaloPSA)
	const availableSites = useMemo(() => {
		if (!allSites) return [];
		return allSites.filter(
			(site: any) =>
				!site.psaIntegrationId || site.psaIntegrationId !== integration.slug
		);
	}, [allSites, integration]);

	const selectedCompany = selectedCompanyId
		? transformedCompanies.find((c) => c._id === selectedCompanyId)
		: null;

	const linkedCount = transformedCompanies.filter((c) => c.isLinked).length;
	const unlinkedCount = transformedCompanies.filter((c) => !c.isLinked).length;
	const hiddenCount = transformedCompanies.filter((c) => c.isHidden).length;
	const visibleCount = transformedCompanies.filter((c) => !c.isHidden).length;

	// Early return after all hooks
	if (!dataSource) {
		return (
			<div className="flex flex-col gap-4 items-center justify-center size-full">
				<AlertCircle className="w-12 h-12 text-muted-foreground" />
				<p className="text-muted-foreground">
					Please configure the HaloPSA integration first
				</p>
			</div>
		);
	}

	const handleLink = async (companyId: string, siteId: string) => {
		if (!companies) {
			toast.error("Companies not loaded");
			return;
		}
		const company = companies.find((c: any) => c._id === companyId);
		if (!company) {
			toast.error("Company not found");
			return;
		}

		try {
			await linkSite({
				siteId: siteId as any,
				integrationId: integration.slug as any,
				companyExternalId: company.externalId,
				companyExternalParentId: company.rawData?.parent_id,
			});
			toast.success(`Linked ${company.rawData?.name} to site`);

			// Cross-integration: Check if site has DattoRMM mapping and auto-push variable
			try {
				const linkedSite = (await convex.query(api.helpers.orm.get_s, {
					tableName: "sites",
					id: siteId as any,
					secret: process.env.NEXT_PUBLIC_CONVEX_SECRET!,
				})) as any;

				if (
					linkedSite?.rmmIntegrationId === "datto-rmm" &&
					linkedSite?.rmmSiteId
				) {
					// Get DattoRMM data source
					const dattoDataSource = (await convex.query(api.helpers.orm.get_s, {
						tableName: "data_sources",
						index: {
							name: "by_integration",
							params: { integrationId: "datto-rmm" },
						},
						filters: { isPrimary: true },
						secret: process.env.NEXT_PUBLIC_CONVEX_SECRET!,
					})) as any;

					if (dattoDataSource) {
						const pushResult = await pushDattoVariable(
							dattoDataSource._id,
							linkedSite._id,
							linkedSite.rmmSiteId
						);

						if (pushResult.success) {
							toast.success("Also pushed site variable to DattoRMM");
						} else {
							toast.warning("Failed to push to DattoRMM: " + pushResult.error);
						}
					}
				}
			} catch (dattoError: any) {
				console.error("DattoRMM auto-push error:", dattoError);
				// Don't fail the main operation, just log
			}
		} catch (error: any) {
			toast.error("Failed to link: " + error.message);
		}
	};

	const handleUnlink = async (companyId: string) => {
		const company = transformedCompanies.find((c: any) => c._id === companyId);
		if (!company || !company.linkedId) {
			toast.error("Company not linked");
			return;
		}

		try {
			await unlinkSite({
				siteId: company.linkedId as any,
			});
			toast.success(`Unlinked ${company.name} from site`);
		} catch (error: any) {
			toast.error("Failed to unlink: " + error.message);
		}
	};

	const handleCreate = async (companyId: string, siteName: string) => {
		if (!companies) {
			toast.error("Companies not loaded");
			return;
		}
		const company = companies.find((c: any) => c._id === companyId);
		if (!company) {
			toast.error("Company not found");
			return;
		}

		try {
			await createSite({
				name: siteName,
				integrationId: "halopsa",
				companyExternalId: company.externalId,
				companyExternalParentId: company.rawData?.parent_id,
			});
			toast.success(
				`Created site "${siteName}" and linked to ${company.rawData?.name}`
			);
		} catch (error: any) {
			toast.error("Failed to create site: " + error.message);
		}
	};

	const handleManualSync = async () => {
		setIsSyncing(true);
		try {
			const result = await syncHaloPSASites();
			if (result.success) {
				toast.success(
					`Synced ${result.total} companies: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`
				);
			} else {
				toast.error(`Sync failed: ${result.error}`);
			}
		} catch (error: any) {
			toast.error(`Sync failed: ${error.message}`);
		} finally {
			setIsSyncing(false);
		}
	};

	const handleToggleHide = async (entityId: string, isHidden: boolean) => {
		try {
			const result = await toggleHideStatus(entityId as any, !isHidden);
			if (result.success) {
				toast.success(
					isHidden ? "Company is now visible" : "Company is now hidden"
				);
			} else {
				toast.error("Failed to toggle hide status: " + result.error);
			}
		} catch (error: any) {
			toast.error("Failed to toggle hide status: " + error.message);
		}
	};

	return (
		<div className="flex flex-col gap-4 size-full">
			<div>
				<div className="flex items-center gap-2 mb-2">
					<Link
						href="/dashboard"
						className="text-muted-foreground hover:text-foreground"
					>
						Dashboard
					</Link>
					<span className="text-muted-foreground">/</span>
					<h1 className="text-3xl font-bold tracking-tight">HaloPSA</h1>
				</div>
				<p className="text-muted-foreground">
					Link HaloPSA companies to MSPByte sites
				</p>
			</div>

			<div className="flex items-center justify-between">
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
						<span className="text-2xl font-semibold">
							{transformedCompanies.length}
						</span>
						<span className="text-xs text-muted-foreground">Total</span>
					</div>
				</div>

				{/* Sync button */}
				<Button
					onClick={handleManualSync}
					disabled={isSyncing}
					className="gap-2"
				>
					<RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
					{isSyncing ? "Syncing..." : "Sync from HaloPSA"}
				</Button>
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
						<Select
							value={linkFilter}
							onValueChange={(value: any) => setLinkFilter(value)}
						>
							<SelectTrigger className="w-40 bg-input border-border">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Companies</SelectItem>
								<SelectItem value="linked">Linked Only</SelectItem>
								<SelectItem value="unlinked">Unlinked Only</SelectItem>
							</SelectContent>
						</Select>
						<Select
							value={hideFilter}
							onValueChange={(value: any) => setHideFilter(value)}
						>
							<SelectTrigger className="w-40 bg-input border-border">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="visible">
									Visible ({visibleCount})
								</SelectItem>
								<SelectItem value="all">
									All ({transformedCompanies.length})
								</SelectItem>
								<SelectItem value="hidden">Hidden ({hiddenCount})</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Company List */}
					<div className="bg-card/50 border rounded shadow flex-1 overflow-y-auto overflow-x-hidden">
						{!companies || !allSites ? (
							<div className="flex items-center justify-center h-full">
								<Loader />
							</div>
						) : filteredCompanies.length === 0 ? (
							<div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-muted-foreground">
								<AlertCircle className="w-12 h-12" />
								<p className="text-center">
									{searchQuery || linkFilter !== "all"
										? "No companies match your filters"
										: "No companies synced yet"}
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
										onToggleHide={(e) => {
											e.stopPropagation();
											handleToggleHide(company._id, company.isHidden);
										}}
									/>
								))}
							</div>
						)}
					</div>

					{/* Results Count */}
					{filteredCompanies.length > 0 && (
						<div className="px-3 text-sm">
							Showing {filteredCompanies.length} of{" "}
							{transformedCompanies.length} companies
						</div>
					)}
				</div>

				{/* Site Linker Panel */}
				<div className="flex-1 bg-card/50 border rounded shadow overflow-auto">
					<SiteLinker
						company={selectedCompany || null}
						availableSites={availableSites}
						onLink={handleLink}
						onUnlink={handleUnlink}
						onCreate={handleCreate}
						onToggleHide={
							selectedCompany
								? () =>
										handleToggleHide(
											selectedCompany._id,
											selectedCompany.isHidden
										)
								: undefined
						}
					/>
				</div>
			</div>
		</div>
	);
}
