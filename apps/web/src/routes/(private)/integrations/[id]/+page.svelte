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
	import { integrationConfigs } from './helpers/integrations.config.js';
	import { setIntegrationState } from './helpers/state.svelte.js';
	import IntegrationHeader from './helpers/IntegrationHeader.svelte';
	import { mockBillingData } from './helpers/mock-data.js';
	import SetupStatus from './helpers/SetupStatus.svelte';
	import EnableIntegrationDialog from './helpers/EnableIntegrationDialog.svelte';
	import DisableIntegrationDialog from './helpers/DisableIntegrationDialog.svelte';

	const { data } = $props();

	// Get integration data from server
	const dataSourceConfig = data.dataSource?.config as Record<string, string>;
	const integrationState = setIntegrationState(data.integration, data.user?.tenant_id || '');
	integrationState.integration = data.integration;
	integrationState.dataSource = data.dataSource;

	// Get config for this integration (use a normalized key like "autotask", "connectwise", etc.)
	// For demo purposes, we'll use the integration name lowercased
	const configKey = integrationState.integration.id;
	const config = integrationConfigs[integrationState.integration.id] || {
		overview: {
			description: 'No configuration available for this integration',
			features: []
		},
		setup: { steps: [] },
		troubleshooting: []
	};

	// Get mock data
	const billing = mockBillingData[configKey] || {
		lastMonthCost: 0,
		currentMonthCost: 0,
		predictedMonthCost: 0,
		billingBreakdown: []
	};

	// Local state for actions
	let testingConnection = $state(false);

	// Calculate trend
	const costTrend = $derived(() => {
		if (billing.currentMonthCost > billing.lastMonthCost) return 'up';
		if (billing.currentMonthCost < billing.lastMonthCost) return 'down';
		return 'neutral';
	});
</script>

<div class="flex size-full max-h-full flex-col gap-4 overflow-hidden">
	<!-- Header -->
	<IntegrationHeader />
	<Separator />

	<!-- Stats Cards -->
	{#if integrationState.isEnabled()}
		<div class="grid gap-4 md:grid-cols-4">
			<CostCard
				title="Last Month"
				amount={billing.lastMonthCost}
				description="Previous billing period"
			/>
			<CostCard
				title="Current Month"
				amount={billing.currentMonthCost}
				description="Month to date"
				trend={costTrend()}
			/>
			<CostCard
				title="Predicted Cost"
				amount={billing.predictedMonthCost}
				description="Estimated end of month"
			/>
			<SetupStatus status={{ isConnected: true, isEnabled: true, configurationComplete: true }} />
		</div>
	{/if}

	<!-- Tabs -->
	<Tabs value="overview" class="size-full overflow-hidden">
		<TabsList>
			<TabsTrigger value="overview">Overview</TabsTrigger>
			{#if integrationState.isEnabled()}
				<TabsTrigger value="setup">Setup</TabsTrigger>
				{#if integrationState.integration?.level === 'global'}
					<TabsTrigger value="configuration">Configuration</TabsTrigger>
				{/if}
				<TabsTrigger value="billing">Billing</TabsTrigger>
				<TabsTrigger value="troubleshooting">Troubleshooting</TabsTrigger>
				{#if config.customTabs && integrationState.isValidConfig()}
					{#each config.customTabs as tab}
						<TabsTrigger value={tab.id}>{tab.label}</TabsTrigger>
					{/each}
				{/if}
			{/if}
		</TabsList>

		<!-- Overview Tab -->
		<TabsContent value="overview" class="space-y-4">
			<Card>
				<CardHeader>
					<CardTitle>About {integrationState.integration?.name}</CardTitle>
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
						>Configure your {integrationState.integration?.name} integration settings below.</CardDescription
					>
				</CardHeader>
				<CardContent class="space-y-4">
					{#if config.configuration}
						<config.configuration />
					{:else}
						<!-- Mock configuration form - will be dynamic based on config_schema -->
						<form class="flex flex-col gap-4">
							{#each Object.entries(integrationState.integration?.config_schema || {}) as [key, val]}
								<Label for={key} class="flex flex-col items-start gap-2">
									<span>{val.label}</span>
									<Input
										name={key}
										type={val.sensitive ? 'password' : 'text'}
										placeholder={val.label}
										defaultValue={val.sensitive ? '********' : dataSourceConfig[key]}
									/>
								</Label>
							{/each}

							<div class="flex justify-end gap-2">
								<Button>Save Configuration</Button>
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
					<div class="space-y-4">
						<div class="space-y-2">
							{#each billing.billingBreakdown as item}
								<div class="flex items-center justify-between rounded-lg border p-3">
									<div class="space-y-1">
										<p class="font-medium">{item.item}</p>
										<p class="text-sm text-muted-foreground">
											{item.quantity} × ${item.ratePerUnit.toFixed(2)} per unit
										</p>
									</div>
									<span class="text-lg font-semibold">${item.total.toFixed(2)}</span>
								</div>
							{/each}
						</div>

						<Separator />

						<div class="flex items-center justify-between rounded-lg bg-muted p-3">
							<span class="font-semibold">Total (Month to Date)</span>
							<span class="text-xl font-bold">${billing.currentMonthCost.toFixed(2)}</span>
						</div>
					</div>
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
					{#if config.troubleshooting.length > 0}
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
