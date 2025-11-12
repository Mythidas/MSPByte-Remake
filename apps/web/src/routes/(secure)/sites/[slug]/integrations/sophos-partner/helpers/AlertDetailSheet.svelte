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
		AlertTriangle,
		TrendingUp,
		Package
	} from 'lucide-svelte';
	import { page } from '$app/stores';
	import { ALERT_DESCRIPTIONS, type AlertDescriptionConfig } from '@workspace/shared/config/alerts.js';

	let {
		alert,
		open = $bindable(false),
		onClose
	}: {
		alert: Doc<'entity_alerts'> | null;
		open?: boolean;
		onClose?: () => void;
	} = $props();

	// Icon mapping
	const ICON_MAP: Record<string, any> = {
		ShieldAlert,
		Clock,
		User,
		Mail,
		Key,
		Info,
		AlertTriangle,
		TrendingUp,
		Package
	};

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
		const config = ALERT_DESCRIPTIONS[alert.alertType];

		if (!config) {
			// Fallback for unknown alert types
			return {
				title: formatAlertType(alert.alertType),
				icon: AlertTriangle,
				bestPractice: 'No additional information available for this alert type.',
				metadata: [],
				futureActions: []
			};
		}

		// Map configuration to component format
		return {
			title: config.title,
			icon: ICON_MAP[config.icon] || AlertTriangle,
			bestPractice: config.bestPractice,
			metadata: config.metadata.map((field) => {
				const value = metadata[field.key];
				const formattedValue = field.format ? field.format(value) : value;
				const highlight = typeof field.highlight === 'function' ? field.highlight(value) : field.highlight;

				return {
					label: field.label,
					value: formattedValue,
					icon: ICON_MAP[field.icon || 'Info'] || Info,
					highlight: highlight || false
				};
			}),
			futureActions: config.futureActions || []
		};
	};

	const content = $derived(alert ? getAlertContent(alert) : null);

	function handleClose() {
		open = false;
		onClose?.();
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
			</div>

			<Sheet.Footer class="mt-4">
				<div class="text-muted-foreground text-xs">
					Created: {new Date(alert.createdAt).toLocaleString()}
					{#if alert.updatedAt && alert.updatedAt !== alert.createdAt}
						• Updated: {new Date(alert.updatedAt).toLocaleString()}
					{/if}
				</div>
			</Sheet.Footer>
		</Sheet.Content>
	</Sheet.Root>
{/if}
