<script lang="ts">
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import CostCard from './helpers/CostCard.svelte';
	import FeatureList from './helpers/FeatureList.svelte';
	import CardDescription from '$lib/components/ui/card/card-description.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import {
		integrationConfigs,
		type IntegrationBillingData
	} from './helpers/integrations.config.js';
	import { setIntegration } from './helpers/integration/state.svelte.js';
	import { createIntegrationActions } from './helpers/integration/actions.js';
	import IntegrationHeader from './helpers/IntegrationHeader.svelte';
	import SetupStatus from './helpers/SetupStatus.svelte';
	import SyncStatus from './helpers/SyncStatus.svelte';
	import EnableIntegrationDialog from './helpers/EnableIntegrationDialog.svelte';
	import DisableIntegrationDialog from './helpers/DisableIntegrationDialog.svelte';
	import { toast } from 'svelte-sonner';
	import Badge from '$lib/components/ui/badge/badge.svelte';

	const { data } = $props();

	// Get integration data from server
	const dataSourceConfig = data.dataSource?.config as Record<string, string>;
	const integration = setIntegration({
		integration: data.integration,
		dataSource: data.dataSource,
		tenantId: data.user?.tenant_id || ''
	});

	// Initialize business logic actions
	createIntegrationActions(integration);

	// Configuration form state
	let configFormData = $state<Record<string, string>>({});
	const isValidConfig = $derived(
		integration.isValidConfig(configFormData) &&
			integration.isConfigChanged(configFormData) &&
			Object.entries(configFormData).every(([key, val]) => !!val)
	);

	// Initialize config form data
	$effect(() => {
		const schema = integration.integration?.config_schema || {};
		const initialData: Record<string, string> = {};

		Object.entries(schema).forEach(([key]) => {
			initialData[key] = dataSourceConfig?.[key] || '';
		});

		configFormData = initialData;
	});

	const handleSaveConfig = async () => {
		const formData = new FormData();
		formData.append('dataSourceId', integration.dataSource?.id || '');
		formData.append('integrationId', integration.integration.id);
		formData.append('config', JSON.stringify(configFormData));

		const response = await fetch(window.location.pathname + '?/saveConfig', {
			method: 'POST',
			body: formData
		});

		const result = await response.json();

		if (result.type === 'success') {
			toast.info(result.data?.message || 'Configuration saved successfully!');

			// Update local dataSource config
			if (integration.dataSource) {
				integration.dataSource.config = configFormData;
			}

			// Re-initialize form with saved values
			const schema = integration.integration?.config_schema || {};
			const newData: Record<string, string> = {};
			Object.entries(schema).forEach(([key, fieldSchema]) => {
				newData[key] = configFormData[key] || '';
			});
			configFormData = newData;
		} else {
			toast.error(result.data?.message || 'Failed to save configuration');
		}
	};

	// Get config for this integration
	const config = integrationConfigs[integration.integration.id] || {
		overview: {
			description: 'No configuration available for this integration',
			features: []
		},
		setup: { steps: [] },
		troubleshooting: []
	};

	const getDefaultBilling = async (): Promise<IntegrationBillingData> => {
		return {
			lastMonth: 0,
			currentMonth: 0,
			yearly: 0,
			breakdown: []
		};
	};

	// Fetch billing data - uses config's custom fetcher or defaults to zeros
	const billingDataPromise = config.getBillingData
		? config.getBillingData(integration)
		: getDefaultBilling();

	// Fetch total failed job count for badge
	let totalFailedJobs = $state(0);

	const fetchFailedJobsCount = async () => {
		if (!integration.dataSource) {
			totalFailedJobs = 0;
			return;
		}

		const { data: failedJobs } = await integration.orm.getRows('scheduled_jobs', {
			filters: [
				['integration_id', 'eq', integration.integration.id],
				['data_source_id', 'eq', integration.dataSource.id],
				['status', 'eq', 'failed']
			]
		});

		totalFailedJobs = failedJobs?.rows?.length || 0;
	};

	// Fetch failed jobs count on mount and poll every 30 seconds
	$effect(() => {
		fetchFailedJobsCount();
		const interval = setInterval(fetchFailedJobsCount, 30000);
		return () => clearInterval(interval);
	});
</script>

<div class="flex size-full max-h-full flex-col gap-4 overflow-hidden">
	<!-- Header -->
	<IntegrationHeader />
	<Separator />

	<!-- Stats Cards -->
	{#if integration.isEnabled()}
		<div class="grid gap-4 md:grid-cols-4">
			{#await billingDataPromise}
				<!-- Loading skeleton for cost cards -->
				<Card>
					<CardHeader class="pb-2">
						<CardTitle class="text-sm font-medium">Last Month</CardTitle>
					</CardHeader>
					<CardContent>
						<div class="h-8 w-24 animate-pulse rounded bg-muted"></div>
						<p class="mt-1 text-xs text-muted-foreground">Previous billing period</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader class="pb-2">
						<CardTitle class="text-sm font-medium">Current Month</CardTitle>
					</CardHeader>
					<CardContent>
						<div class="h-8 w-24 animate-pulse rounded bg-muted"></div>
						<p class="mt-1 text-xs text-muted-foreground">Current billing period</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader class="pb-2">
						<CardTitle class="text-sm font-medium">Predicted Cost</CardTitle>
					</CardHeader>
					<CardContent>
						<div class="h-8 w-24 animate-pulse rounded bg-muted"></div>
						<p class="mt-1 text-xs text-muted-foreground">Year to date</p>
					</CardContent>
				</Card>
			{:then billingData}
				<CostCard
					title="Last Month"
					amount={billingData.lastMonth}
					description="Previous billing period"
				/>
				<CostCard
					title="Current Month"
					amount={billingData.currentMonth}
					description="Current billing period"
				/>
				<CostCard title="Current Year" amount={billingData.yearly} description="Year to date" />
			{:catch error}
				<Card>
					<CardHeader class="pb-2">
						<CardTitle class="text-sm font-medium text-destructive">Error Loading Billing</CardTitle
						>
					</CardHeader>
					<CardContent>
						<p class="text-xs text-muted-foreground">Failed to load billing data</p>
					</CardContent>
				</Card>
			{/await}
			<SetupStatus />
		</div>
	{/if}

	<!-- Tabs -->
	<Tabs value="sync-status" class="size-full overflow-hidden">
		<TabsList>
			<TabsTrigger value="overview">Overview</TabsTrigger>
			{#if integration.isEnabled()}
				<TabsTrigger value="setup">Setup</TabsTrigger>
				{#if integration.integration?.level === 'global'}
					<TabsTrigger value="configuration">Configuration</TabsTrigger>
				{/if}
				<TabsTrigger value="billing">Billing</TabsTrigger>
				{#if integration.isValidConfig()}
					<TabsTrigger value="sync-status" class="relative">
						Sync Status
						{#if totalFailedJobs > 0}
							<Badge variant="destructive" class="ml-2 h-5 min-w-5 px-1.5 text-xs">
								{totalFailedJobs}
							</Badge>
						{/if}
					</TabsTrigger>
				{/if}
				{#if config.troubleshooting}
					<TabsTrigger value="troubleshooting">Troubleshooting</TabsTrigger>
				{/if}
				{#if config.customTabs && integration.isValidConfig()}
					{#each config.customTabs as tab}
						<TabsTrigger value={tab.id}>{tab.label}</TabsTrigger>
					{/each}
				{/if}
			{/if}
		</TabsList>

		<!-- Sync Status Tab -->
		<TabsContent value="sync-status" class="flex flex-col space-y-4 overflow-hidden">
			<Card class="size-full overflow-hidden">
				<CardHeader>
					<CardTitle>Sync Status</CardTitle>
					<CardDescription
						>View detailed sync status for all entity types supported by this integration.</CardDescription
					>
				</CardHeader>
				<CardContent class="flex flex-1 flex-col overflow-auto">
					<SyncStatus />
				</CardContent>
			</Card>
		</TabsContent>

		<!-- Overview Tab -->
		<TabsContent value="overview" class="space-y-4">
			<Card>
				<CardHeader>
					<CardTitle>About {integration.integration?.name}</CardTitle>
					<CardDescription>{config.overview.description}</CardDescription>
				</CardHeader>
				<CardContent class="space-y-4">
					{#if config.overview.features.length > 0}
						<div>
							<h3 class="mb-3 font-semibold">Features</h3>
							<FeatureList features={config.overview.features} />
						</div>
					{/if}
				</CardContent>
			</Card>
		</TabsContent>

		<!-- Setup Tab -->
		<TabsContent value="setup" class="space-y-4">
			<Card>
				<CardHeader>
					<CardTitle>Setup Instructions</CardTitle>
				</CardHeader>
				<CardContent class="space-y-4">
					{#if config.setup.requirements && config.setup.requirements.length > 0}
						<div>
							<h3 class="mb-2 font-semibold">Requirements</h3>
							<ul class="ml-5 list-disc space-y-1 text-sm text-muted-foreground">
								{#each config.setup.requirements as requirement}
									<li>{requirement}</li>
								{/each}
							</ul>
						</div>
						<Separator />
					{/if}

					<div>
						<h3 class="mb-2 font-semibold">Steps</h3>
						<ol class="ml-5 list-decimal space-y-2 text-sm">
							{#each config.setup.steps as step}
								<li>{step}</li>
							{/each}
						</ol>
					</div>
				</CardContent>
			</Card>
		</TabsContent>

		<!-- Configuration Tab -->
		<TabsContent value="configuration" class="space-y-4">
			<Card>
				<CardHeader>
					<CardTitle>Configuration Settings</CardTitle>
					<CardDescription
						>Configure your {integration.integration?.name} integration settings below.</CardDescription
					>
				</CardHeader>
				<CardContent class="space-y-4">
					{#if config.configuration !== undefined}
						<config.configuration />
					{:else}
						<!-- Dynamic configuration form based on config_schema -->
						<form
							class="flex flex-col gap-4"
							onsubmit={(e) => {
								e.preventDefault();
								handleSaveConfig();
							}}
						>
							{#each Object.entries(integration.integration?.config_schema || {}) as [key, val]}
								<Label for={key} class="flex flex-col items-start gap-2">
									<span>{val.label}</span>
									<Input
										id={key}
										name={key}
										type={val.sensitive ? 'password' : 'text'}
										placeholder={val.sensitive ? 'Enter new value to update' : val.label}
										bind:value={configFormData[key]}
									/>
								</Label>
							{/each}

							<div class="flex justify-end gap-2">
								<Button type="submit" disabled={!isValidConfig}>Save Configuration</Button>
							</div>
						</form>
					{/if}
				</CardContent>
			</Card>
		</TabsContent>

		<!-- Billing Tab -->
		<TabsContent value="billing" class="space-y-4">
			<Card>
				<CardHeader>
					<CardTitle>Billing Breakdown</CardTitle>
				</CardHeader>
				<CardContent>
					{#await billingDataPromise}
						<!-- Loading skeleton -->
						<div class="space-y-4">
							<div class="space-y-2">
								{#each Array(3) as _}
									<div class="flex items-center justify-between rounded-lg border p-3">
										<div class="space-y-2">
											<div class="h-5 w-32 animate-pulse rounded bg-muted"></div>
											<div class="h-4 w-48 animate-pulse rounded bg-muted"></div>
										</div>
										<div class="h-6 w-20 animate-pulse rounded bg-muted"></div>
									</div>
								{/each}
							</div>
						</div>
					{:then billingData}
						<div class="space-y-4">
							{#if billingData.breakdown.length > 0}
								<div class="space-y-2">
									{#each billingData.breakdown as item}
										<div class="flex items-center justify-between rounded-lg border p-3">
											<div class="space-y-1">
												<p class="font-medium">{item.label}</p>
												<p class="text-sm text-muted-foreground">
													{item.units} × ${item.unitCost.toFixed(2)} per unit
												</p>
											</div>
											<span class="text-lg font-semibold">${item.total.toFixed(2)}</span>
										</div>
									{/each}
								</div>

								<Separator />

								<div class="flex items-center justify-between rounded-lg bg-muted p-3">
									<span class="font-semibold">Total (Month to Date)</span>
									<span class="text-xl font-bold">${billingData.currentMonth.toFixed(2)}</span>
								</div>
							{:else}
								<div class="flex items-center justify-center p-8 text-muted-foreground">
									<p>No billing data available</p>
								</div>
							{/if}
						</div>
					{:catch error}
						<div class="flex items-center justify-center p-8 text-destructive">
							<p>Failed to load billing data</p>
						</div>
					{/await}
				</CardContent>
			</Card>
		</TabsContent>

		<!-- Troubleshooting Tab -->
		<TabsContent value="troubleshooting" class="space-y-4">
			<Card>
				<CardHeader>
					<CardTitle>Troubleshooting & FAQ</CardTitle>
				</CardHeader>
				<CardContent>
					{#if config.troubleshooting}
						<div class="space-y-4">
							{#each config.troubleshooting as item}
								<div class="space-y-2">
									<h3 class="font-semibold">{item.title}</h3>
									<p class="text-sm text-muted-foreground">{item.solution}</p>
								</div>
								{#if config.troubleshooting.indexOf(item) < config.troubleshooting.length - 1}
									<Separator />
								{/if}
							{/each}
						</div>
					{:else}
						<p class="text-sm text-muted-foreground">No troubleshooting information available.</p>
					{/if}
				</CardContent>
			</Card>
		</TabsContent>

		<!-- Custom Tabs (e.g., Site Mapping for AutoTask) -->
		{#if config.customTabs}
			{#each config.customTabs as tab}
				<TabsContent value={tab.id} class="flex flex-col overflow-hidden">
					<Card class="size-full overflow-hidden">
						<CardHeader>
							<CardTitle>{tab.label}</CardTitle>
						</CardHeader>
						<CardContent class="flex flex-1 flex-col overflow-hidden">
							<tab.component {data} />
						</CardContent>
					</Card>
				</TabsContent>
			{/each}
		{/if}
	</Tabs>
</div>

<!-- Dialogs -->
<EnableIntegrationDialog />
<DisableIntegrationDialog />
