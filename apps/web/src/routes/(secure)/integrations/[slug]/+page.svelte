<script lang="ts">
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import { Card, CardAction, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
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
	import { useQuery } from 'convex-svelte';
	import { api, type Doc } from '$lib/convex';
	import Loader from '$lib/components/Loader.svelte';
	import DatePicker from '$lib/components/DatePicker.svelte';
	import { getAppState } from '$lib/state/Application.svelte.js';
	import type { PageProps } from './$types.js';

	const { data }: PageProps = $props();

	const appState = getAppState();
	const integrationData = data.integration;

	// Fetch dataSource from Convex (client-side, reactive)
	// Pass empty string as integrationId when not available (query will return null)
	const dataSourceQuery = useQuery(api.helpers.orm.get, {
		tableName: 'data_sources',
		index: {
			name: 'by_integration_primary',
			params: {
				integrationId: integrationData?._id || ('' as any),
				isPrimary: true
			}
		}
	});
	const dataSourceData = $derived(dataSourceQuery.data as Doc<'data_sources'>);

	// Loading and error states
	const isLoading = $derived(dataSourceQuery.isLoading);

	// Initialize integration state with empty values (will be populated by effect)
	const integration = setIntegration({
		integration: integrationData as any,
		dataSource: dataSourceData || undefined
	});

	// Update integration state when queries return new data
	$effect(() => {
		if (integrationData) {
			integration.integration = integrationData;
		}
		if (dataSourceData !== undefined) {
			integration.dataSource = dataSourceData || undefined;
		}
	});

	// Initialize business logic actions
	$effect(() => {
		if (integrationData) {
			createIntegrationActions(integration);
		}
	});

	// Configuration form state
	let configFormData = $state<Record<string, string | number | undefined>>({});
	let credentialExpiration = $state<number | undefined>(undefined);
	const isValidConfig = $derived(
		integration.isValidConfig(configFormData) &&
			(integration.isConfigChanged(configFormData) ||
				credentialExpiration !== dataSourceData?.credentialExpirationAt) &&
			Object.values(configFormData).every((val) => !!val)
	);

	const config = $derived(
		integrationConfigs[integration.integration?.slug] || {
			overview: {
				description: 'No configuration available for this integration',
				features: []
			},
			setup: { steps: [] },
			troubleshooting: []
		}
	);

	// Initialize config form data
	$effect(() => {
		const schema = integration.integration?.configSchema || {};
		const initialData: Record<string, string> = {};
		const dataSourceConfig = (dataSourceData?.config || {}) as Record<string, string>;

		Object.keys(schema).forEach((key) => {
			initialData[key] = dataSourceConfig?.[key] || '';
		});

		credentialExpiration = dataSourceData?.credentialExpirationAt;
		configFormData = initialData;
	});

	const handleSaveConfig = async () => {
		const formData = new FormData();
		formData.append('dataSourceId', integration.dataSource?._id || '');
		formData.append('integrationId', integration.integration._id);

		for (const [key, val] of Object.entries(configFormData)) {
			if (val === dataSourceData?.config[key]) {
				configFormData[key] = undefined;
			}
		}

		if (credentialExpiration) {
			configFormData['expiration'] = credentialExpiration;
		}

		formData.append('config', JSON.stringify(configFormData));
		formData.append('originalConfig', JSON.stringify(dataSourceData?.config));

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
		} else {
			toast.error(result.data?.message || 'Failed to save configuration');
		}
	};

	const handleSyncGlobal = async () => {
		try {
			const result = await appState.convex.mutation(
				api.scheduledjobs.mutate.scheduleJobsByIntegration,
				{
					integrationId: integration.integration._id,
					dataSourceId: integration.dataSource!._id
				}
			);

			if (result) toast.info('Queued global sync jobs');
			else throw 'Failed';
		} catch (err) {
			console.log(err);
			toast.error('Failed to queue global jobs');
		}
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
	const billingDataPromise = $derived(
		config.getBillingData ? config.getBillingData(integration) : getDefaultBilling()
	);

	// Fetch total failed job count for badge
	const totalFailedJobsQuery = useQuery(api.scheduledjobs.query.getFailedCountByDataSource, () => ({
		dataSourceId: integration.dataSource?._id || ('' as any)
	}));
	const totalFailedJobs = $derived(totalFailedJobsQuery.data);
</script>

<div class="flex size-full max-h-full flex-col gap-4 overflow-hidden">
	{#if isLoading}
		<div class="flex size-full items-center justify-center">
			<Loader />
		</div>
	{:else}
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
							<div class="bg-muted h-8 w-24 animate-pulse rounded"></div>
							<p class="text-muted-foreground mt-1 text-xs">Previous billing period</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader class="pb-2">
							<CardTitle class="text-sm font-medium">Current Month</CardTitle>
						</CardHeader>
						<CardContent>
							<div class="bg-muted h-8 w-24 animate-pulse rounded"></div>
							<p class="text-muted-foreground mt-1 text-xs">Current billing period</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader class="pb-2">
							<CardTitle class="text-sm font-medium">Predicted Cost</CardTitle>
						</CardHeader>
						<CardContent>
							<div class="bg-muted h-8 w-24 animate-pulse rounded"></div>
							<p class="text-muted-foreground mt-1 text-xs">Year to date</p>
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
				{:catch}
					<Card>
						<CardHeader class="pb-2">
							<CardTitle class="text-destructive text-sm font-medium"
								>Error Loading Billing</CardTitle
							>
						</CardHeader>
						<CardContent>
							<p class="text-muted-foreground text-xs">Failed to load billing data</p>
						</CardContent>
					</Card>
				{/await}
				<SetupStatus />
			</div>
		{/if}

		<!-- Tabs -->
		<Tabs value="overview" class="size-full overflow-hidden">
			<TabsList>
				<TabsTrigger value="overview">Overview</TabsTrigger>
				{#if integration.isEnabled()}
					<TabsTrigger value="setup">Setup</TabsTrigger>
					{#if integration.integration?.level === 'global'}
						<TabsTrigger value="configuration">Configuration</TabsTrigger>
					{/if}
					<TabsTrigger value="billing">Billing</TabsTrigger>
					{#if integration.isValidConfig() && (config.hasSyncStats === undefined || config.hasSyncStats)}
						<TabsTrigger value="sync-status" class="relative">
							Sync Status
							{#if (totalFailedJobs || 0) > 0}
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
						<CardAction>
							<Button variant="ghost" onclick={handleSyncGlobal}>Sync Global</Button>
						</CardAction>
					</CardHeader>
					<CardContent class="flex flex-1 flex-col overflow-auto">
						{#if integration.dataSource}
							<SyncStatus />
						{/if}
					</CardContent>
				</Card>
			</TabsContent>

			<!-- Overview Tab -->
			<TabsContent value="overview" class="space-y-4">
				<Card class="size-full overflow-hidden">
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
				<Card class="size-full overflow-hidden">
					<CardHeader>
						<CardTitle>Setup Instructions</CardTitle>
					</CardHeader>
					<CardContent class="space-y-4">
						{#if config.setup.requirements && config.setup.requirements.length > 0}
							<div>
								<h3 class="mb-2 font-semibold">Requirements</h3>
								<ul class="text-muted-foreground ml-5 list-disc space-y-1 text-sm">
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
			<TabsContent value="configuration" class="space-y-4 overflow-hidden">
				<Card class="size-full overflow-hidden">
					<CardHeader>
						<CardTitle>Configuration Settings</CardTitle>
						<CardDescription
							>Configure your {integration.integration?.name} integration settings below.</CardDescription
						>
					</CardHeader>
					<CardContent class="size-full space-y-4 overflow-hidden">
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
								{#each Object.entries(integration.integration?.configSchema || {}) as [key, _val]}
									<Label for={key} class="flex flex-col items-start gap-2">
										{@const val = _val as any}
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

								{#if !config.noExpiration}
									<Label for="expiration" class="flex flex-col items-start gap-2">
										<span>Expiration</span>
										<DatePicker
											bind:value={credentialExpiration}
											defaultValue={dataSourceData?.credentialExpirationAt}
										/>
									</Label>
								{/if}

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
				<Card class="size-full overflow-hidden">
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
												<div class="bg-muted h-5 w-32 animate-pulse rounded"></div>
												<div class="bg-muted h-4 w-48 animate-pulse rounded"></div>
											</div>
											<div class="bg-muted h-6 w-20 animate-pulse rounded"></div>
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
													<p class="text-muted-foreground text-sm">
														{item.units} × ${item.unitCost.toFixed(2)} per unit
													</p>
												</div>
												<span class="text-lg font-semibold">${item.total.toFixed(2)}</span>
											</div>
										{/each}
									</div>

									<Separator />

									<div class="bg-muted flex items-center justify-between rounded-lg p-3">
										<span class="font-semibold">Total (Month to Date)</span>
										<span class="text-xl font-bold">${billingData.currentMonth.toFixed(2)}</span>
									</div>
								{:else}
									<div class="text-muted-foreground flex items-center justify-center p-8">
										<p>No billing data available</p>
									</div>
								{/if}
							</div>
						{:catch}
							<div class="text-destructive flex items-center justify-center p-8">
								<p>Failed to load billing data</p>
							</div>
						{/await}
					</CardContent>
				</Card>
			</TabsContent>

			<!-- Troubleshooting Tab -->
			<TabsContent value="troubleshooting" class="space-y-4">
				<Card class="size-full overflow-hidden">
					<CardHeader>
						<CardTitle>Troubleshooting & FAQ</CardTitle>
					</CardHeader>
					<CardContent>
						{#if config.troubleshooting}
							<div class="space-y-4">
								{#each config.troubleshooting as item}
									<div class="space-y-2">
										<h3 class="font-semibold">{item.title}</h3>
										<p class="text-muted-foreground text-sm">{item.solution}</p>
									</div>
									{#if config.troubleshooting.indexOf(item) < config.troubleshooting.length - 1}
										<Separator />
									{/if}
								{/each}
							</div>
						{:else}
							<p class="text-muted-foreground text-sm">No troubleshooting information available.</p>
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
								<tab.component />
							</CardContent>
						</Card>
					</TabsContent>
				{/each}
			{/if}
		</Tabs>
	{/if}
</div>

<!-- Dialogs -->
<EnableIntegrationDialog />
<DisableIntegrationDialog />
