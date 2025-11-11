<script lang="ts">
	import { type Doc } from '$lib/convex';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import {
		ShieldAlert,
		Clock,
		User,
		Mail,
		Key,
		Info,
		ExternalLink,
		AlertTriangle
	} from 'lucide-svelte';
	import AlertSuppressionDialog from './AlertSuppressionDialog.svelte';
	import { page } from '$app/stores';

	let {
		alert,
		open = $bindable(false),
		onClose
	}: {
		alert: Doc<'entity_alerts'> | null;
		open?: boolean;
		onClose?: () => void;
	} = $props();

	let suppressDialogOpen = $state(false);

	// Format alert type for display
	const formatAlertType = (type: string) => {
		return type
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	};

	// Get severity color
	const getSeverityColor = (severity: string) => {
		switch (severity) {
			case 'critical':
				return 'destructive';
			case 'high':
				return 'default';
			case 'medium':
				return 'secondary';
			case 'low':
				return 'outline';
			default:
				return 'outline';
		}
	};

	// Get alert type content (best practices, metadata display)
	const getAlertContent = (alert: Doc<'entity_alerts'>) => {
		const metadata = alert.metadata || {};

		switch (alert.alertType) {
			case 'mfa_not_enforced':
				return {
					title: 'MFA Not Enforced',
					icon: ShieldAlert,
					bestPractice:
						'Multi-factor authentication adds a critical security layer by requiring users to verify their identity through a second method beyond just a password. Admin accounts without MFA are high-value targets for attackers.',
					metadata: [
						{ label: 'Email', value: metadata.email, icon: Mail },
						{
							label: 'Admin Account',
							value: metadata.isAdmin ? 'Yes' : 'No',
							icon: User,
							highlight: metadata.isAdmin
						},
						{
							label: 'Security Defaults',
							value: metadata.securityDefaultsEnabled ? 'Enabled' : 'Disabled',
							icon: Info
						}
					],
					futureActions: ['Enable MFA for User', 'View Conditional Access Policies']
				};

			case 'stale_user':
				return {
					title: 'Stale User Account',
					icon: Clock,
					bestPractice:
						'Inactive accounts pose a security risk as they may have outdated access rights and could be compromised without detection. Consider disabling accounts inactive for 90+ days, especially if they consume licenses or have admin privileges.',
					metadata: [
						{ label: 'Email', value: metadata.email, icon: Mail },
						{
							label: 'Days Inactive',
							value: metadata.daysInactive,
							icon: Clock,
							highlight: true
						},
						{
							label: 'Last Login',
							value: new Date(metadata.lastLogin).toLocaleString(),
							icon: Info
						},
						{
							label: 'Has Licenses',
							value: metadata.hasLicenses ? 'Yes' : 'No',
							icon: Key,
							highlight: metadata.hasLicenses
						},
						{
							label: 'Admin Account',
							value: metadata.isAdmin ? 'Yes' : 'No',
							icon: User,
							highlight: metadata.isAdmin
						}
					],
					futureActions: ['Disable User', 'Remove Licenses', 'View Sign-in Activity']
				};

			case 'license_waste':
				return {
					title: 'License Waste',
					icon: Key,
					bestPractice:
						"Licenses assigned to disabled or inactive users represent unnecessary costs. Regular license auditing ensures you're only paying for actively used services.",
					metadata: [
						{ label: 'Email', value: metadata.email, icon: Mail },
						{ label: 'License', value: metadata.licenseName, icon: Key, highlight: true },
						{
							label: 'Reason',
							value: metadata.reason === 'disabled' ? 'User Disabled' : 'User Stale',
							icon: AlertTriangle,
							highlight: true
						},
						{ label: 'User Enabled', value: metadata.userEnabled ? 'Yes' : 'No', icon: User },
						{ label: 'User Stale', value: metadata.userStale ? 'Yes' : 'No', icon: Clock }
					],
					futureActions: ['Remove License', 'Enable User', 'View All User Licenses']
				};

			case 'policy_gap':
				return {
					title: 'Policy Coverage Gap',
					icon: ShieldAlert,
					bestPractice:
						'Users not covered by any security policy may lack basic protections like MFA requirements, device compliance checks, or conditional access controls. This is especially critical for admin accounts.',
					metadata: [
						{ label: 'Email', value: metadata.email, icon: Mail },
						{
							label: 'Admin Account',
							value: metadata.isAdmin ? 'Yes' : 'No',
							icon: User,
							highlight: metadata.isAdmin
						},
						{
							label: 'Security Defaults',
							value: metadata.securityDefaultsEnabled ? 'Enabled' : 'Disabled',
							icon: Info
						},
						{ label: 'Enabled Policies', value: metadata.enabledPolicyCount, icon: ShieldAlert }
					],
					futureActions: ['Add to Policy', 'Enable Security Defaults', 'View All Policies']
				};

			default:
				return {
					title: formatAlertType(alert.alertType),
					icon: AlertTriangle,
					bestPractice: 'No additional information available for this alert type.',
					metadata: [],
					futureActions: []
				};
		}
	};

	const content = $derived(alert ? getAlertContent(alert) : null);

	// Build link to affected entity
	const entityLink = $derived(() => {
		if (!alert?.metadata?.email) return null;
		const siteSlug = $page.params.slug;
		return `/sites/${siteSlug}/integrations/microsoft-365?tab=identities&globalSearch=${encodeURIComponent(alert.metadata.email)}`;
	});

	function handleClose() {
		open = false;
		onClose?.();
	}

	function handleSuppressionSuccess() {
		// Close the sheet and notify parent
		handleClose();
	}
</script>

{#if alert && content}
	<Sheet.Root bind:open onOpenChange={(isOpen) => !isOpen && handleClose()}>
		<Sheet.Content side="right" class="w-full overflow-y-auto pt-6 sm:max-w-[600px]">
			<Sheet.Header>
				<div class="flex items-start justify-between gap-4">
					<div class="flex-1">
						<Sheet.Title class="flex items-center gap-2 text-xl">
							<svelte:component this={content.icon} class="h-5 w-5" />
							{content.title}
						</Sheet.Title>
						<Sheet.Description class="mt-2">
							{alert.message}
						</Sheet.Description>
					</div>
					<Badge variant={getSeverityColor(alert.severity)}>
						{alert.severity.toUpperCase()}
					</Badge>
				</div>
			</Sheet.Header>

			<div class="mt-6 space-y-6 p-4">
				<!-- Best Practice Section -->
				<div class="space-y-2">
					<h3 class="flex items-center gap-2 font-semibold">
						<Info class="h-4 w-4" />
						Why This Matters
					</h3>
					<p class="text-muted-foreground text-sm leading-relaxed">
						{content.bestPractice}
					</p>
				</div>

				<Separator />

				<!-- Metadata Section -->
				{#if content.metadata.length > 0}
					<div class="space-y-3">
						<h3 class="font-semibold">Details</h3>
						<div class="space-y-2">
							{#each content.metadata as item}
								<div
									class="flex items-center justify-between rounded-md px-3 py-2 {item.highlight
										? 'bg-muted'
										: ''}"
								>
									<div class="flex items-center gap-2 text-sm">
										<svelte:component this={item.icon} class="text-muted-foreground h-4 w-4" />
										<span class="text-muted-foreground">{item.label}:</span>
									</div>
									<span class="text-sm font-medium">{item.value}</span>
								</div>
							{/each}
						</div>
					</div>

					<Separator />
				{/if}

				<!-- View Entity Link -->
				{#if entityLink()}
					<div>
						<Button variant="ghost" href={entityLink()} target="_blank" class="w-full" size="sm">
							<ExternalLink class="mr-2 h-4 w-4" />
							View Affected Identity
						</Button>
					</div>
				{/if}

				<!-- Future Actions (Disabled for now) -->
				{#if content.futureActions.length > 0}
					<div class="space-y-2">
						<h3 class="text-muted-foreground text-sm font-semibold">Quick Actions (Coming Soon)</h3>
						<div class="space-y-2">
							{#each content.futureActions as action}
								<Button variant="outline" disabled class="w-full justify-start" size="sm">
									{action}
								</Button>
							{/each}
						</div>
					</div>
				{/if}

				<Separator />

				<!-- Alert Status -->
				<div class="space-y-3">
					<h3 class="font-semibold">Alert Status</h3>
					<div class="space-y-2">
						<div class="flex items-center justify-between py-2">
							<span class="text-muted-foreground text-sm">Status:</span>
							<Badge variant="outline">{alert.status.toUpperCase()}</Badge>
						</div>
						<div class="flex items-center justify-between py-2">
							<span class="text-muted-foreground text-sm">Last Updated:</span>
							<span class="text-sm">{new Date(alert.updatedAt).toLocaleString()}</span>
						</div>
						{#if alert.status === 'suppressed' && alert.suppressionReason}
							<div class="bg-muted space-y-2 rounded-md p-3">
								<div>
									<span class="text-sm font-medium">Suppression Reason:</span>
									<p class="text-muted-foreground mt-1 text-sm">{alert.suppressionReason}</p>
								</div>
								{#if alert.suppressedAt}
									<div class="text-muted-foreground text-xs">
										Suppressed on {new Date(alert.suppressedAt).toLocaleString()}
									</div>
								{/if}
								{#if alert.suppressedUntil}
									<div class="text-muted-foreground text-xs">
										Expires on {new Date(alert.suppressedUntil).toLocaleString()}
									</div>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			</div>

			<Sheet.Footer class="mt-6">
				{#if alert.status === 'active'}
					<Button
						variant="destructive"
						onclick={() => {
							suppressDialogOpen = true;
						}}
						class="w-full"
					>
						Suppress Alert
					</Button>
				{/if}
				<Button onclick={handleClose} variant="default" class="w-full">Close</Button>
			</Sheet.Footer>
		</Sheet.Content>
	</Sheet.Root>

	<!-- Suppression Dialog -->
	{#if alert}
		<AlertSuppressionDialog
			{alert}
			bind:open={suppressDialogOpen}
			onSuccess={handleSuppressionSuccess}
		/>
	{/if}
{/if}
