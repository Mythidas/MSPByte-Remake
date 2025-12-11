"use client";

import { useQuery } from "convex/react";
import { api, Doc } from "@/lib/api";
import { Building2, Server, Ticket, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/lib/hooks/useApp";
import { useAuthReady } from "@/lib/hooks/useAuthReady";

export default function MSPAgentDashboard() {
	// Get selected site from app state
	const { site: currentSite } = useApp();

	// Ensure auth is ready before querying
	const { isLoading: authLoading, isAuthenticated } = useAuthReady();

	// Fetch primary data source for MSP Agent
	const dataSource = useQuery(
		api.helpers.orm.get,
		!authLoading && isAuthenticated && currentSite
			? {
					tableName: "data_sources",
					index: {
						name: "by_integration_primary",
						params: {
							integrationId: "msp-agent",
							isPrimary: true,
						},
					},
				}
			: "skip",
	) as Doc<"data_sources">;

	// Fetch companies (sites) for this site
	const companies = useQuery(
		api.helpers.orm.list,
		!authLoading && isAuthenticated && currentSite && dataSource
			? {
					tableName: "sites",
					filters: {
						psaIntegrationId: dataSource.config.psaIntegrationId,
					},
				}
			: "skip",
	) as Doc<"entities">[] | undefined;

	// Fetch agents for the current site
	const agents = useQuery(
		api.helpers.orm.list,
		!authLoading && isAuthenticated && currentSite
			? {
					tableName: "agents",
					index: {
						name: "by_site",
						params: {
							siteId: currentSite._id,
						},
					},
				}
			: "skip",
	) as Doc<"agents">[] | undefined;

	// Fetch ticket usage for the current site
	const tickets = useQuery(
		api.helpers.orm.list,
		!authLoading && isAuthenticated && currentSite
			? {
					tableName: "ticket_usage",
					index: {
						name: "by_site",
						params: {
							siteId: currentSite._id,
						},
					},
				}
			: "skip",
	) as Doc<"ticket_usage">[] | undefined;

	// Show empty state if no site is selected
	if (!currentSite) {
		return (
			<div className="flex flex-col gap-4 items-center justify-center size-full">
				<Building2 className="w-16 h-16 text-muted-foreground" />
				<div className="text-center">
					<h2 className="text-2xl font-semibold mb-2">Select a Site</h2>
					<p className="text-muted-foreground max-w-md">
						Please select a site from the dropdown in the top navigation bar to
						view MSP Agent data for that site.
					</p>
				</div>
			</div>
		);
	}

	// Show not configured message if dataSource query completed but returned null
	if (dataSource === null) {
		return (
			<div className="flex flex-col gap-4 items-center justify-center size-full">
				<AlertCircle className="w-12 h-12 text-muted-foreground" />
				<p className="text-muted-foreground">
					MSP Agent integration not configured
				</p>
				<Link
					href="/secure/default/integrations"
					className="text-sm text-blue-500 hover:underline"
				>
					Configure Integration
				</Link>
			</div>
		);
	}

	const entityCards = [
		{
			label: "Sites",
			href: "/secure/msp-agent/sites",
			icon: Building2,
			count: companies?.length ?? 0,
			description: "Managed sites and companies",
			loading: companies === undefined,
		},
		{
			label: "Agents",
			href: "/secure/msp-agent/agents",
			icon: Server,
			count: agents?.length ?? 0,
			description: "Monitored endpoints and devices",
			loading: agents === undefined,
		},
		{
			label: "Tickets",
			href: "/secure/msp-agent/tickets",
			icon: Ticket,
			count: tickets?.length ?? 0,
			description: "Support tickets submitted",
			loading: tickets === undefined,
		},
	];

	return (
		<div className="flex flex-col size-full gap-6">
			{/* Header */}
			<div>
				<h1 className="text-3xl font-bold tracking-tight">MSP Agent</h1>
				<div className="flex items-center gap-2 text-muted-foreground">
					<Building2 className="w-4 h-4" />
					<p>{currentSite.name}</p>
				</div>
			</div>

			{/* Integration Status */}
			<div className="bg-card/50 border rounded shadow p-6">
				<div className="flex items-center justify-between">
					{dataSource ? (
						<div className="flex items-center gap-3">
							<div
								className={`w-3 h-3 rounded-full ${dataSource.status === "active" ? "bg-green-500" : "bg-yellow-500"}`}
							/>
							<div>
								<h3 className="font-semibold">Integration Status</h3>
								<p className="text-sm text-muted-foreground">
									{dataSource.status === "active"
										? "Active and syncing"
										: "Configuration needed"}
								</p>
							</div>
						</div>
					) : (
						<div className="flex items-center gap-3">
							<div className="animate-pulse w-3 h-3 rounded-full bg-muted" />
							<div className="space-y-2">
								<div className="animate-pulse h-5 w-32 bg-muted rounded" />
								<div className="animate-pulse h-4 w-48 bg-muted rounded" />
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Entity Cards Grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{entityCards.map((card) => {
					const Icon = card.icon;
					return (
						<Link
							key={card.label}
							href={card.href}
							className="bg-card/50 border rounded shadow p-6 hover:bg-card/70 transition-colors group"
						>
							<div className="flex items-start justify-between mb-4">
								<div className="flex items-center gap-3">
									<div className="p-2 rounded bg-primary/10 group-hover:bg-primary/20 transition-colors">
										<Icon className="w-5 h-5 text-primary" />
									</div>
									<h3 className="font-semibold text-lg">{card.label}</h3>
								</div>
								{card.loading ? (
									<div className="animate-pulse bg-muted rounded w-12 h-8" />
								) : (
									<span className="text-2xl font-bold">{card.count}</span>
								)}
							</div>
							<p className="text-sm text-muted-foreground">
								{card.description}
							</p>
						</Link>
					);
				})}
			</div>
		</div>
	);
}
