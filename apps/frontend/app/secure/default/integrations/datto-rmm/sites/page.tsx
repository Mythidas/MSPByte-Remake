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
import { Search, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { pushSiteVariable } from "../actions";

export default function DattoRMMSites() {
	const dataSource = useQuery(api.helpers.orm.get, {
		tableName: "data_sources",
		index: {
			name: "by_integration",
			params: {
				integrationId: "datto-rmm",
			},
		},
		filters: {
			isPrimary: true,
		},
	}) as Doc<"data_sources"> | undefined;

	const sites = useQuery(
		api.helpers.orm.list,
		dataSource
			? {
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
			: "skip",
	) as Doc<"entities">[] | undefined;

	const allMSPSites = useQuery(api.helpers.orm.list, {
		tableName: "sites",
	}) as Doc<"sites">[] | undefined;

	const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [linkFilter, setLinkFilter] = useState<"all" | "linked" | "unlinked">(
		"all",
	);

	// Mutation hooks
	const linkSite = useMutation(api.sites.mutate.linkToRMMSite);
	const unlinkSite = useMutation(api.sites.mutate.unlinkFromRMMSite);

	// Transform sites data to include link information (must be before conditional return)
	const transformedSites = useMemo(() => {
		if (!sites || !allMSPSites) return [];

		return sites.map((site: any) => {
			// Find if this Datto site is linked to an MSPByte site
			const linkedMSPSite = allMSPSites.find(
				(mspSite: any) =>
					mspSite.rmmIntegrationId === "datto-rmm" &&
					mspSite.rmmSiteId === site.externalId,
			);

			return {
				_id: site._id,
				name: site.normalizedData?.name || site.rawData?.name,
				externalId: site.externalId,
				isLinked: !!linkedMSPSite,
				linkedId: linkedMSPSite?._id,
				linkedSlug: linkedMSPSite?.slug,
				linkedName: linkedMSPSite?.name,
			};
		});
	}, [sites, allMSPSites]);

	// Filter sites
	const filteredSites = useMemo(() => {
		return transformedSites.filter((site) => {
			// Link status filter
			if (linkFilter === "linked" && !site.isLinked) return false;
			if (linkFilter === "unlinked" && site.isLinked) return false;

			// Search filter
			if (searchQuery) {
				const searchLower = searchQuery.toLowerCase();
				const matchesName = site.name?.toLowerCase().includes(searchLower);
				const matchesId = site.externalId?.toLowerCase().includes(searchLower);
				if (!matchesName && !matchesId) return false;
			}

			return true;
		});
	}, [transformedSites, linkFilter, searchQuery]);

	// Get available MSPByte sites (not already linked to Datto RMM)
	const availableMSPSites = useMemo(() => {
		if (!allMSPSites) return [];
		return allMSPSites.filter(
			(site: any) =>
				!site.rmmIntegrationId || site.rmmIntegrationId !== "datto-rmm",
		);
	}, [allMSPSites]);

	const selectedSite = selectedSiteId
		? transformedSites.find((s) => s._id === selectedSiteId)
		: null;

	const linkedCount = transformedSites.filter((s) => s.isLinked).length;
	const unlinkedCount = transformedSites.filter((s) => !s.isLinked).length;

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

	const handleLink = async (dattoSiteId: string, mspSiteId: string) => {
		if (!sites || !dataSource) {
			toast.error("Sites not loaded");
			return;
		}
		const dattoSite = sites.find((s: any) => s._id === dattoSiteId);
		if (!dattoSite) {
			toast.error("Datto site not found");
			return;
		}

		try {
			// Link site in database
			await linkSite({
				siteId: mspSiteId as any,
				integrationId: "datto-rmm",
				rmmSiteId: dattoSite.externalId,
			});

			toast.success(`Linked ${dattoSite.rawData?.name} to MSPByte site`);

			// Push site variable to Datto RMM
			const pushResult = await pushSiteVariable(
				dataSource._id,
				mspSiteId as any,
				dattoSite.externalId,
			);

			if (pushResult.error) {
				toast.error("Failed to push site variable: " + pushResult.error);
			} else {
				toast.success("Site variable pushed to Datto RMM successfully");
			}
		} catch (error: any) {
			toast.error("Failed to link: " + error.message);
		}
	};

	const handleUnlink = async (dattoSiteId: string) => {
		const dattoSite = transformedSites.find((s: any) => s._id === dattoSiteId);
		if (!dattoSite || !dattoSite.linkedId) {
			toast.error("Site not linked");
			return;
		}

		try {
			await unlinkSite({
				siteId: dattoSite.linkedId as any,
			});
			toast.success(`Unlinked ${dattoSite.name} from MSPByte site`);
		} catch (error: any) {
			toast.error("Failed to unlink: " + error.message);
		}
	};

	return (
		<div className="flex flex-col gap-4 size-full">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold">Site Mapping</h1>
					<p className="text-muted-foreground">
						Link Datto RMM sites to MSPByte sites. Site variables are
						automatically pushed when linking.
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
						<span className="text-2xl font-semibold">
							{transformedSites.length}
						</span>
						<span className="text-xs text-muted-foreground">Total</span>
					</div>
				</div>
			</div>

			{/* Main Content */}
			<div className="flex gap-4 flex-1 overflow-hidden">
				{/* Datto Site List */}
				<div className="flex flex-col gap-3 w-2/5 min-w-[400px]">
					{/* Filters */}
					<div className="bg-card/50 border rounded shadow p-3 flex gap-2">
						<SearchBar
							placeholder="Search Datto sites..."
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
								<SelectItem value="all">All Sites</SelectItem>
								<SelectItem value="linked">Linked Only</SelectItem>
								<SelectItem value="unlinked">Unlinked Only</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Site List */}
					<div className="bg-card/50 border rounded shadow flex-1 overflow-y-auto overflow-x-hidden">
						{!sites || !allMSPSites ? (
							<div className="flex items-center justify-center h-full">
								<Loader />
							</div>
						) : filteredSites.length === 0 ? (
							<div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-muted-foreground">
								<AlertCircle className="w-12 h-12" />
								<p className="text-center">
									{searchQuery || linkFilter !== "all"
										? "No sites match your filters"
										: "No sites synced yet"}
								</p>
							</div>
						) : (
							<div className="flex flex-col gap-2 p-3">
								{filteredSites.map((site) => (
									<CompanyMappingCard
										key={site._id}
										company={site}
										isSelected={selectedSiteId === site._id}
										onClick={() => setSelectedSiteId(site._id)}
									/>
								))}
							</div>
						)}
					</div>

					{/* Results Count */}
					{filteredSites.length > 0 && (
						<div className="px-3 text-sm">
							Showing {filteredSites.length} of {transformedSites.length} sites
						</div>
					)}
				</div>

				{/* Site Linker Panel */}
				<div className="flex-1 bg-card/50 border rounded shadow overflow-auto">
					<SiteLinker
						company={selectedSite || null}
						availableSites={availableMSPSites}
						onLink={handleLink}
						onUnlink={handleUnlink}
					/>
				</div>
			</div>
		</div>
	);
}
