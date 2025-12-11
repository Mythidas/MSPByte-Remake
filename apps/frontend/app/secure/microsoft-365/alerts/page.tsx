"use client";

import { Building2 } from "lucide-react";
import Loader from "@workspace/ui/components/Loader";
import { useApp } from "@/lib/hooks/useApp";
import { useAlertsForSite } from "@/lib/hooks/useAlertsForSite";
import { AlertsTable } from "@/components/alerts/AlertsTable";

export default function Microsoft365Alerts() {
	const { site: currentSite } = useApp();
	const alerts = useAlertsForSite(currentSite?._id ?? null, "microsoft-365");

	// Show empty state if no site is selected
	if (!currentSite) {
		return (
			<div className="flex flex-col gap-4 items-center justify-center size-full">
				<Building2 className="w-16 h-16 text-muted-foreground" />
				<div className="text-center">
					<h2 className="text-2xl font-semibold mb-2">Select a Site</h2>
					<p className="text-muted-foreground max-w-md">
						Please select a site from the dropdown in the top navigation bar to
						view alerts for that site.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col size-full gap-2">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">
					Microsoft 365 Alerts
				</h1>
				<div className="flex items-center gap-2 text-muted-foreground">
					<Building2 className="w-4 h-4" />
					<p>{currentSite.name}</p>
				</div>
			</div>

			{alerts !== undefined ? (
				<AlertsTable
					alerts={alerts}
					siteId={currentSite._id}
					integrationSlug="microsoft-365"
				/>
			) : (
				<Loader />
			)}
		</div>
	);
}
