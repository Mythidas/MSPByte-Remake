"use client";

import { useState } from "react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@workspace/ui/components/dialog";
import {
	Link as LinkIcon,
	Plus,
	Unlink,
	Building2,
	ExternalLink,
	RefreshCw,
	EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import SearchBox from "../SearchBox";

type Site = {
	_id: string;
	name: string;
	slug: string;
	status: string;
};

type SiteLinkerProps = {
	company: {
		_id: string;
		name?: string;
		externalId: string;
		externalParentId?: string;
		isLinked: boolean;
		linkedId?: string;
		linkedSlug?: string;
		linkedName?: string;
		isHidden?: boolean;
	} | null;
	sites?: Site[]; // Legacy prop name
	availableSites?: Site[]; // Preferred prop name
	onLink?: (companyId: string, siteId: string) => Promise<void>;
	onUnlink?: (companyId: string) => Promise<void>;
	onCreate?: (companyId: string, siteName: string) => Promise<void>;
	onPushVariable?: () => Promise<void>;
	onToggleHide?: () => Promise<void>;
	variableStatus?: {
		status: "set" | "not_set" | "unknown";
		value?: string;
	};
};

export function SiteLinker({
	company,
	sites,
	availableSites,
	onLink,
	onUnlink,
	onCreate,
	onPushVariable,
	onToggleHide,
	variableStatus,
}: SiteLinkerProps) {
	const [selectedSiteId, setSelectedSiteId] = useState<string>("");
	const [isLinking, setIsLinking] = useState(false);
	const [isUnlinking, setIsUnlinking] = useState(false);
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [newSiteName, setNewSiteName] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const [isPushing, setIsPushing] = useState(false);
	const [isTogglingHide, setIsTogglingHide] = useState(false);

	// Use availableSites if provided, otherwise fallback to sites (legacy)
	const sitesList = availableSites || sites || [];

	if (!company) {
		return (
			<div className="bg-card/30 border rounded p-8 flex flex-col items-center justify-center gap-3 h-full">
				<Building2 className="w-12 h-12 text-muted-foreground" />
				<p className="text-muted-foreground text-center">
					Select a company to manage site mapping
				</p>
			</div>
		);
	}

	const handleLink = async () => {
		if (!selectedSiteId || !onLink) return;

		setIsLinking(true);
		try {
			await onLink(company._id, selectedSiteId);
			toast.success("Company linked to site successfully");
			setSelectedSiteId("");
		} catch (error: any) {
			toast.error(`Failed to link: ${error.message || "Unknown error"}`);
		} finally {
			setIsLinking(false);
		}
	};

	const handleUnlink = async () => {
		if (!onUnlink) return;

		setIsUnlinking(true);
		try {
			await onUnlink(company._id);
			toast.success("Company unlinked from site");
		} catch (error: any) {
			toast.error(`Failed to unlink: ${error.message || "Unknown error"}`);
		} finally {
			setIsUnlinking(false);
		}
	};

	const handleCreate = async () => {
		if (!newSiteName.trim() || !onCreate) return;

		setIsCreating(true);
		try {
			await onCreate(company._id, newSiteName);
			toast.success("Site created and linked successfully");
			setShowCreateDialog(false);
			setNewSiteName("");
		} catch (error: any) {
			toast.error(`Failed to create site: ${error.message || "Unknown error"}`);
		} finally {
			setIsCreating(false);
		}
	};

	const handlePushVariable = async () => {
		if (!onPushVariable) return;

		setIsPushing(true);
		try {
			await onPushVariable();
		} catch (error: any) {
			// Error handling is done in the parent component
		} finally {
			setIsPushing(false);
		}
	};

	const handleToggleHide = async () => {
		if (!onToggleHide) return;

		setIsTogglingHide(true);
		try {
			await onToggleHide();
		} catch (error: any) {
			toast.error(`Failed to toggle hide: ${error.message || "Unknown error"}`);
		} finally {
			setIsTogglingHide(false);
		}
	};

	return (
		<>
			<div className="bg-card/30 border rounded p-6 flex flex-col gap-4 h-full">
				{/* Company Details */}
				<div className="pb-4 border-b">
					<div className="flex items-start justify-between gap-3">
						<div className="flex items-start gap-3">
							<div className="w-12 h-12 rounded border bg-card/50 flex items-center justify-center">
								<Building2 className="w-6 h-6 text-muted-foreground" />
							</div>
							<div>
								<h3 className="font-semibold text-lg">
									{company.name || "Unnamed Company"}
								</h3>
								<p className="text-sm text-muted-foreground">
									External ID: {company.externalId}
								</p>
								{company.externalParentId && (
									<p className="text-xs text-muted-foreground">
										Parent ID: {company.externalParentId}
									</p>
								)}
							</div>
						</div>
						<div className="flex flex-col gap-2 items-end">
							{company.isLinked ? (
								<Badge className="bg-green-500/50">Linked</Badge>
							) : (
								<Badge variant="secondary">Unlinked</Badge>
							)}
							{company.isHidden && (
								<Badge variant="outline" className="bg-orange-500/20 border-orange-500/50">
									Hidden
								</Badge>
							)}
						</div>
					</div>
				</div>

				{/* Linked Site Info or Link Options */}
				{company.isLinked ? (
					<div className="flex flex-col gap-4">
						<div className="bg-green-500/10 border border-green-500/50 rounded p-4 flex flex-col gap-3">
							<div className="flex items-center gap-2 text-green-400">
								<LinkIcon className="w-4 h-4" />
								<span className="font-medium">Linked to MSPByte Site</span>
							</div>
							<div className="flex items-center justify-between">
								<div>
									<p className="font-semibold">{company.linkedName}</p>
									<p className="text-sm text-muted-foreground">
										Slug: {company.linkedSlug} ID: {company.linkedId}
									</p>
								</div>
								{company.linkedSlug && (
									<Link
										href={`/secure/default/sites/${company.linkedSlug}`}
										target="_blank"
									>
										<Button size="sm" variant="outline" className="gap-2">
											<ExternalLink className="w-3 h-3" />
											View Site
										</Button>
									</Link>
								)}
							</div>
						</div>

						{/* Variable Status and Push Button (for Datto RMM) */}
						{variableStatus && (
							<div className="bg-card/50 border rounded p-4 flex flex-col gap-2">
								<div className="flex items-center justify-between">
									<span className="text-sm font-medium">
										Site Variable Status
									</span>
									<Badge
										className={
											variableStatus.status === "set"
												? "bg-green-500/50"
												: variableStatus.status === "not_set"
													? "bg-orange-500/50"
													: "bg-gray-500/50"
										}
									>
										{variableStatus.status === "set"
											? "Set"
											: variableStatus.status === "not_set"
												? "Not Set"
												: "Unknown"}
									</Badge>
								</div>
								{variableStatus.value && (
									<p className="text-xs text-muted-foreground">
										Value: {variableStatus.value}
									</p>
								)}
							</div>
						)}

						{onPushVariable && (
							<Button
								variant="outline"
								onClick={handlePushVariable}
								disabled={isPushing}
								className="gap-2"
							>
								<RefreshCw
									className={`w-4 h-4 ${isPushing ? "animate-spin" : ""}`}
								/>
								{isPushing ? "Pushing..." : "Push Site Variable"}
							</Button>
						)}

						{onToggleHide && (
							<Button
								variant="outline"
								onClick={handleToggleHide}
								disabled={isTogglingHide}
								className="gap-2"
							>
								<EyeOff className="w-4 h-4" />
								{isTogglingHide
									? "Toggling..."
									: company.isHidden
										? "Show Site"
										: "Hide Site"}
							</Button>
						)}

						<Button
							variant="destructive"
							onClick={handleUnlink}
							disabled={isUnlinking}
							className="gap-2"
						>
							<Unlink className="w-4 h-4" />
							{isUnlinking ? "Unlinking..." : "Unlink from Site"}
						</Button>
					</div>
				) : (
					<div className="flex flex-col gap-4 flex-1">
						<div>
							<h4 className="font-medium mb-3">Link to Existing Site</h4>
							<div className="flex flex-col gap-3">
								<SearchBox
									onSelect={setSelectedSiteId}
									placeholder="Select site..."
									options={sitesList.map((site) => ({
										label: site.name,
										value: site._id,
									}))}
								/>

								<Button
									onClick={handleLink}
									disabled={!selectedSiteId || isLinking}
									className="gap-2"
								>
									<LinkIcon className="w-4 h-4" />
									{isLinking ? "Linking..." : "Link to Site"}
								</Button>
							</div>
						</div>

						{onCreate && (
							<>
								<div className="relative">
									<div className="absolute inset-0 flex items-center">
										<span className="w-full border-t" />
									</div>
									<div className="relative flex justify-center text-xs uppercase">
										<span className="bg-card/30 px-2 text-muted-foreground">
											Or
										</span>
									</div>
								</div>

								<div>
									<h4 className="font-medium mb-3">Create New Site</h4>
									<Button
										onClick={() => {
											setNewSiteName(company.name || "");
											setShowCreateDialog(true);
										}}
										variant="outline"
										className="w-full gap-2"
									>
										<Plus className="w-4 h-4" />
										Create Site from Company
									</Button>
								</div>
							</>
						)}
					</div>
				)}
			</div>

			{/* Create Site Dialog */}
			<Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create New Site</DialogTitle>
						<DialogDescription>
							Create a new MSPByte site from this HaloPSA company
						</DialogDescription>
					</DialogHeader>

					<div className="flex flex-col gap-4 py-4">
						<div className="flex flex-col gap-2">
							<Label htmlFor="siteName">Site Name</Label>
							<Input
								id="siteName"
								value={newSiteName}
								onChange={(e) => setNewSiteName(e.target.value)}
								placeholder="Enter site name..."
								className="bg-input border-border"
							/>
						</div>

						<div className="bg-blue-500/10 border border-blue-500/50 rounded p-3">
							<p className="text-sm text-blue-100">
								The new site will be automatically linked to this HaloPSA
								company.
							</p>
						</div>
					</div>

					<DialogFooter>
						<Button
							variant="ghost"
							onClick={() => setShowCreateDialog(false)}
							disabled={isCreating}
						>
							Cancel
						</Button>
						<Button
							onClick={handleCreate}
							disabled={!newSiteName.trim() || isCreating}
						>
							{isCreating ? "Creating..." : "Create Site"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
