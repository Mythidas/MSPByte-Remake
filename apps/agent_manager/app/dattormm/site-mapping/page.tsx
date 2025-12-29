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
import { Button } from "@workspace/ui/components/button";
import Loader from "@workspace/ui/components/Loader";
import { AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
	pushSiteVariable,
	bulkCheckVariables,
	toggleHideStatus,
} from "../actions";
import Link from "next/link";
import { Id } from "@workspace/database/convex/_generated/dataModel.js";

export default function DattoRMMSiteMapping() {
	// Fetch Datto RMM data source using *_s variant
	const dataSource = useQuery(api.helpers.orm.get_s, {
		secret: process.env.NEXT_PUBLIC_CONVEX_SECRET!,
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

	// Fetch sites (entities) using *_s variant
	const sites = useQuery(
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

	// Fetch all MSPByte sites using *_s variant
	const allMSPSites = useQuery(api.helpers.orm.list_s, {
		secret: process.env.NEXT_PUBLIC_CONVEX_SECRET!,
		tableName: "sites",
	}) as Doc<"sites">[] | undefined;

	const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [linkFilter, setLinkFilter] = useState<"all" | "linked" | "unlinked">(
		"all"
	);
	const [hideFilter, setHideFilter] = useState<"visible" | "all" | "hidden">(
		"visible"
	);
	const [variableStatuses, setVariableStatuses] = useState<
		Record<string, { status: "set" | "not_set" | "unknown"; value?: string }>
	>({});
	const [isBulkChecking, setIsBulkChecking] = useState(false);

	// Mutation hooks
	const linkSite = useMutation(api.sites.mutate.linkToRMMSite);
	const unlinkSite = useMutation(api.sites.mutate.unlinkFromRMMSite);

	// Transform sites data to include link information
	const transformedSites = useMemo(() => {
		if (!sites || !allMSPSites) return [];

		return sites.map((site: any) => {
			// Find if this Datto site is linked to an MSPByte site
			const linkedMSPSite = allMSPSites.find(
				(mspSite: any) =>
					mspSite.rmmIntegrationId === "datto-rmm" &&
					mspSite.rmmSiteId === site.externalId
			);

			// Extract hidden status from tags array
			const isHidden = site.tags?.includes("cust_hidden") || false;

			return {
				_id: site._id,
				name: site.rawData?.name,
				externalId: site.externalId,
				isLinked: !!linkedMSPSite,
				linkedId: linkedMSPSite?._id,
				linkedSlug: linkedMSPSite?.slug,
				linkedName: linkedMSPSite?.name,
				variableStatus: variableStatuses[site.externalId]?.status || "unknown",
				isHidden,
			};
		});
	}, [sites, allMSPSites, variableStatuses]);

	// Filter sites
	const filteredSites = useMemo(() => {
		return transformedSites.filter((site) => {
			// Hide filter (applied first for performance)
			if (hideFilter === "visible" && site.isHidden) return false;
			if (hideFilter === "hidden" && !site.isHidden) return false;

			// Link status filter
			if (linkFilter === "linked" && !site.isLinked) return false;
			if (linkFilter === "unlinked" && site.isLinked) return false;

			// Search filter
			if (searchQuery && searchQuery !== "") {
				const searchLower = searchQuery.toLowerCase();
				const matchesName = site.name?.toLowerCase().includes(searchLower);
				const matchesId = site.externalId?.toLowerCase().includes(searchLower);
				if (!matchesName && !matchesId) return false;
			}

			return true;
		});
	}, [transformedSites, linkFilter, searchQuery, hideFilter]);

	// Get available MSPByte sites (not already linked to Datto RMM)
	const availableMSPSites = useMemo(() => {
		if (!allMSPSites) return [];
		return allMSPSites.filter(
			(site: any) =>
				!site.rmmIntegrationId || site.rmmIntegrationId !== "datto-rmm"
		);
	}, [allMSPSites]);

	const selectedSite = selectedSiteId
		? transformedSites.find((s) => s._id === selectedSiteId)
		: null;

	const linkedCount = transformedSites.filter((s) => s.isLinked).length;
	const unlinkedCount = transformedSites.filter((s) => !s.isLinked).length;
	const hiddenCount = transformedSites.filter((s) => s.isHidden).length;
	const visibleCount = transformedSites.filter((s) => !s.isHidden).length;

	// Early return after all hooks
	if (!dataSource) {
		return (
			<div className="flex flex-col gap-4 items-center justify-center size-full">
				<AlertCircle className="w-12 h-12 text-muted-foreground" />
				<p className="text-muted-foreground">
					Please configure the integration first
				</p>
				<Link href="/dattormm/setup">
					<Button>Go to Setup</Button>
				</Link>
			</div>
		);
	}

	const handleLink = async (dattoSiteId: string, mspSiteId: Id<"sites">) => {
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
				siteId: mspSiteId,
				integrationId: "datto-rmm",
				rmmSiteId: dattoSite.externalId,
			});

			// Push site variable to Datto RMM
			const pushResult = await pushSiteVariable(
				dataSource._id,
				mspSiteId as any,
				dattoSite.externalId
			);

			if (pushResult.success) {
				toast.success(`Linked ${dattoSite.rawData?.name} and pushed variable`);
				// Update variable status
				setVariableStatuses((prev) => ({
					...prev,
					[dattoSite.externalId]: { status: "set", value: mspSiteId },
				}));
			} else {
				toast.warning(
					`Linked ${dattoSite.rawData?.name} but failed to push variable: ${pushResult.error}`
				);
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
			toast.success(`Unlinked ${dattoSite.name} from site`);

			// Clear variable status
			setVariableStatuses((prev) => {
				const newStatuses = { ...prev };
				delete newStatuses[dattoSite.externalId];
				return newStatuses;
			});
		} catch (error: any) {
			toast.error("Failed to unlink: " + error.message);
		}
	};

	const handlePushVariable = async (
		dattoSiteId: string,
		mspSiteId: string,
		rmmSiteId: string
	) => {
		if (!dataSource) {
			toast.error("Data source not loaded");
			return;
		}

		try {
			const result = await pushSiteVariable(
				dataSource._id,
				mspSiteId as any,
				rmmSiteId
			);

			if (result.success) {
				toast.success("Site variable pushed successfully");
				setVariableStatuses((prev) => ({
					...prev,
					[rmmSiteId]: { status: "set", value: mspSiteId },
				}));
			} else {
				toast.error("Failed to push variable: " + result.error);
			}
		} catch (error: any) {
			toast.error("Failed to push variable: " + error.message);
		}
	};

	const handleBulkCheckVariables = async () => {
		if (!dataSource) {
			toast.error("Data source not loaded");
			return;
		}

		const linkedSites = transformedSites
			.filter((s) => s.isLinked && s.linkedId)
			.map((s) => ({
				rmmSiteId: s.externalId,
				siteId: s.linkedId as any,
			}));

		if (linkedSites.length === 0) {
			toast.info("No linked sites to check");
			return;
		}

		setIsBulkChecking(true);
		try {
			const results = await bulkCheckVariables(dataSource._id, linkedSites);
			setVariableStatuses(results);

			const setCount = Object.values(results).filter(
				(r) => r.status === "set"
			).length;
			const notSetCount = Object.values(results).filter(
				(r) => r.status === "not_set"
			).length;

			toast.success(
				`Checked ${linkedSites.length} sites: ${setCount} set, ${notSetCount} not set`
			);
		} catch (error: any) {
			toast.error("Failed to check variables: " + error.message);
		} finally {
			setIsBulkChecking(false);
		}
	};

	const handleToggleHide = async (entityId: string, isHidden: boolean) => {
		try {
			const result = await toggleHideStatus(entityId as any, !isHidden);
			if (result.success) {
				toast.success(isHidden ? "Site is now visible" : "Site is now hidden");
			} else {
				toast.error("Failed to toggle hide status: " + result.error);
			}
		} catch (error: any) {
			toast.error("Failed to toggle hide status: " + error.message);
		}
	};

	return (
		<div className="flex flex-col gap-4 size-full">
			{/* Top Bar with Search and Filters */}
			<div className="flex items-center gap-4">
				<div className="flex-1">
					<SearchBar
						value={searchQuery}
						onSearch={setSearchQuery}
						placeholder="Search sites..."
					/>
				</div>
				<Select value={linkFilter} onValueChange={(v: any) => setLinkFilter(v)}>
					<SelectTrigger className="w-40">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All ({transformedSites.length})</SelectItem>
						<SelectItem value="linked">Linked ({linkedCount})</SelectItem>
						<SelectItem value="unlinked">Unlinked ({unlinkedCount})</SelectItem>
					</SelectContent>
				</Select>
				<Select value={hideFilter} onValueChange={(v: any) => setHideFilter(v)}>
					<SelectTrigger className="w-40">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="visible">Visible ({visibleCount})</SelectItem>
						<SelectItem value="all">All ({transformedSites.length})</SelectItem>
						<SelectItem value="hidden">Hidden ({hiddenCount})</SelectItem>
					</SelectContent>
				</Select>
				<Button
					onClick={handleBulkCheckVariables}
					disabled={isBulkChecking || linkedCount === 0}
					variant="outline"
				>
					<RefreshCw
						className={`w-4 h-4 mr-2 ${isBulkChecking ? "animate-spin" : ""}`}
					/>
					{isBulkChecking ? "Checking..." : "Check All Variables"}
				</Button>
			</div>

			{/* Main Content - Two Panel Layout */}
			<div className="flex gap-4 flex-1 overflow-hidden">
				{/* Left Panel - Sites List */}
				<div className="w-1/2 flex flex-col gap-2 overflow-auto">
					{sites === undefined || allMSPSites === undefined ? (
						<div className="flex items-center justify-center size-full">
							<Loader />
						</div>
					) : filteredSites.length > 0 ? (
						filteredSites.map((site) => (
							<div
								key={site._id}
								onClick={() => setSelectedSiteId(site._id)}
								className="cursor-pointer"
							>
								<CompanyMappingCard
									company={{
										_id: site._id,
										name: site.name,
										externalId: site.externalId,
										externalParentId: undefined,
										isLinked: site.isLinked,
										linkedName: site.linkedName,
										linkedSlug: site.linkedSlug,
										isHidden: site.isHidden,
									}}
									isSelected={selectedSiteId === site._id}
									variableStatus={site.variableStatus}
									onToggleHide={(e) => {
										e.stopPropagation();
										handleToggleHide(site._id, site.isHidden);
									}}
								/>
							</div>
						))
					) : (
						<div className="flex flex-col gap-2 items-center justify-center size-full text-muted-foreground">
							<AlertCircle className="w-8 h-8" />
							<p>No sites found</p>
						</div>
					)}
				</div>

				{/* Right Panel - Site Linker */}
				<div className="w-1/2 overflow-auto">
					{selectedSite ? (
						<SiteLinker
							company={{
								_id: selectedSite._id,
								name: selectedSite.name,
								externalId: selectedSite.externalId,
								externalParentId: undefined,
								isLinked: selectedSite.isLinked,
								linkedId: selectedSite.linkedId,
								linkedName: selectedSite.linkedName,
								linkedSlug: selectedSite.linkedSlug,
								isHidden: selectedSite.isHidden,
							}}
							sites={availableMSPSites}
							onLink={(_, mspSiteId) =>
								handleLink(selectedSite._id, mspSiteId as any)
							}
							onUnlink={() => handleUnlink(selectedSite._id)}
							onPushVariable={
								selectedSite.linkedId
									? () =>
											handlePushVariable(
												selectedSite._id,
												selectedSite.linkedId!,
												selectedSite.externalId
											)
									: undefined
							}
							variableStatus={variableStatuses[selectedSite.externalId]}
							onToggleHide={() =>
								handleToggleHide(selectedSite._id, selectedSite.isHidden)
							}
						/>
					) : (
						<div className="flex items-center justify-center size-full text-muted-foreground">
							<p>Select a site to manage linking</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
