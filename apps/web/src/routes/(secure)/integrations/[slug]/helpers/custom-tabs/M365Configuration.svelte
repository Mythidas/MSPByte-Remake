<script lang="ts">
	import SearchBar from '$lib/components/SearchBar.svelte';
	import { Tabs, TabsList, TabsContent, TabsTrigger } from '$lib/components/ui/tabs';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as ScrollArea from '$lib/components/ui/scroll-area';
	import * as Select from '$lib/components/ui/select';
	import { Search, Settings, ArrowLeft, Save, X, Building2 } from 'lucide-svelte';
	import M365ConnectDialog from '../components/M365ConnectDialog.svelte';
	import { useQuery } from 'convex-svelte';
	import { api, type Doc } from '$lib/convex';
	import { getIntegration } from '../integration/state.svelte';
	import { getAppState } from '$lib/state/Application.svelte';
	import Loader from '$lib/components/Loader.svelte';
	import { toast } from 'svelte-sonner';
	import { prettyText } from '@workspace/shared/lib/utils';
	import type { Microsoft365DataSourceConfig } from '@workspace/shared/types/integrations/microsoft-365';

	const integration = getIntegration();
	const appState = getAppState();

	// State
	let searchQuery = $state('');
	let selectedConnection = $state<Doc<'data_sources'> | null>(null);
	let currentTab = $state('connections');
	let domainMappings = $state<{ domain: string; siteId: string }[]>([]);
	let isSaving = $state(false);
	let searchTerm = $state('');

	// Queries
	const dataSourcesQuery = useQuery(api.helpers.orm.list, {
		tableName: 'data_sources',
		index: {
			name: 'by_integration_primary',
			params: {
				integrationId: integration.integration._id,
				isPrimary: false
			}
		}
	});

	const sitesQuery = useQuery(api.helpers.orm.list, {
		tableName: 'sites'
	});

	const dataSourceToSiteQuery = useQuery(api.helpers.orm.list, {
		tableName: 'data_source_to_site',
		index: {
			name: 'by_integration',
			params: {
				integrationId: integration.integration._id
			}
		}
	});

	const dataSources = $derived(
		(dataSourcesQuery.data as Doc<'data_sources'>[] | undefined)?.filter((ds) => !ds.siteId) || []
	);
	const sites = $derived((sitesQuery.data as Doc<'sites'>[] | undefined) || []);
	const dataSourceToSiteLinks = $derived(
		(dataSourceToSiteQuery.data as Doc<'data_source_to_site'>[] | undefined) || []
	);

	const isLoading = $derived(
		dataSourcesQuery.isLoading || sitesQuery.isLoading || dataSourceToSiteQuery.isLoading
	);

	// Computed
	function getFilteredConnections() {
		if (!searchQuery.trim()) return dataSources;
		return dataSources.filter((ds) => {
			const config = ds.config as Microsoft365DataSourceConfig;
			return (
				config.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				config.tenantName?.toLowerCase().includes(searchQuery.toLowerCase())
			);
		});
	}

	function getAvailableSites(currentDataSourceId: string) {
		// Get sites that are not linked to any OTHER M365 data source
		const linkedSiteIds = dataSourceToSiteLinks
			.filter((link) => link.dataSourceId !== currentDataSourceId)
			.map((link) => link.siteId);

		return sites.filter((site) => !linkedSiteIds.includes(site._id));
	}

	function selectConnection(connection: Doc<'data_sources'>) {
		selectedConnection = connection;
		const config = connection.config as Microsoft365DataSourceConfig;
		domainMappings = config.domainMappings || [];
		currentTab = 'sites';
	}

	function backToConnections() {
		selectedConnection = null;
		domainMappings = [];
		currentTab = 'connections';
	}

	function updateMapping(domain: string, siteId: string | undefined) {
		if (!siteId) {
			// Remove mapping
			domainMappings = domainMappings.filter((m) => m.domain !== domain);
		} else {
			// Add or update mapping
			const existing = domainMappings.find((m) => m.domain === domain);
			if (existing) {
				existing.siteId = siteId;
				domainMappings = [...domainMappings];
			} else {
				domainMappings = [...domainMappings, { domain, siteId }];
			}
		}
	}

	function getMappedSite(domain: string) {
		const mapping = domainMappings.find((m) => m.domain === domain);
		return mapping ? sites.find((s) => s._id === mapping.siteId) : undefined;
	}

	async function saveChanges() {
		if (!selectedConnection) return;

		isSaving = true;
		try {
			await appState.convex.mutation(api.datasources.mutate.updateM365DomainMappings, {
				dataSourceId: selectedConnection._id,
				domainMappings
			});

			toast.success('Domain mappings saved successfully!');
		} catch (error) {
			console.error('Failed to save mappings:', error);
			toast.error(error instanceof Error ? error.message : 'Failed to save domain mappings');
		} finally {
			isSaving = false;
		}
	}

	function getDomainCountText(config: Microsoft365DataSourceConfig) {
		const total = config.availableDomains?.length || 0;
		const mapped = config.domainMappings?.length || 0;
		return `${mapped} of ${total} domains mapped`;
	}
</script>

<Tabs bind:value={currentTab} class="size-full overflow-hidden">
	<TabsList>
		<TabsTrigger value="connections">Connections</TabsTrigger>
		<TabsTrigger value="sites" disabled={!selectedConnection}>Site Mappings</TabsTrigger>
	</TabsList>

	<!-- Connections Tab -->
	<TabsContent value="connections" class="flex flex-col gap-4 overflow-hidden">
		<div class="flex w-full justify-between">
			<SearchBar
				class="w-1/3"
				placeholder="Search connections"
				icon={Search}
				onSearch={(v) => (searchQuery = v)}
			/>
			<M365ConnectDialog />
		</div>

		{#if isLoading}
			<div class="flex size-full items-center justify-center">
				<Loader />
			</div>
		{:else}
			{@const filteredConnections = getFilteredConnections()}
			<ScrollArea.Root class="flex-1 overflow-auto pr-3">
				<div class="grid gap-3">
					{#each filteredConnections as connection}
						{@const config = connection.config as Microsoft365DataSourceConfig}
						<div
							class="bg-card flex items-center justify-between rounded-lg border p-4 shadow-sm transition-shadow hover:shadow-md"
						>
							<div class="flex flex-col gap-2">
								<div class="flex items-center gap-3">
									<span class="text-lg font-semibold">{config.name}</span>
									<Badge variant={connection.status === 'active' ? 'default' : 'secondary'}>
										{prettyText(connection.status)}
									</Badge>
								</div>
								<div class="text-muted-foreground flex flex-col gap-1 text-sm">
									<div class="flex items-center gap-2">
										<Building2 class="h-4 w-4" />
										<span>{config.tenantName}</span>
									</div>
									<span>{getDomainCountText(config)}</span>
								</div>
							</div>
							<Button variant="outline" onclick={() => selectConnection(connection)} class="gap-2">
								<Settings class="h-4 w-4" />
								Configure Mappings
							</Button>
						</div>
					{/each}

					{#if filteredConnections.length === 0}
						<div class="text-muted-foreground flex items-center justify-center p-8">
							<p>
								{searchQuery ? 'No connections found matching your search' : 'No connections yet'}
							</p>
						</div>
					{/if}
				</div>
			</ScrollArea.Root>
		{/if}
	</TabsContent>

	<!-- Site Mappings Tab -->
	<TabsContent value="sites" class="flex size-full flex-col gap-4 overflow-hidden">
		{#if !selectedConnection}
			<div class="text-muted-foreground flex size-full items-center justify-center">
				<p>Select a connection to manage site mappings</p>
			</div>
		{:else}
			{@const config = selectedConnection.config as Microsoft365DataSourceConfig}
			{@const availableSites = getAvailableSites(selectedConnection._id)}

			<!-- Header -->
			<div class="flex items-center justify-between">
				<div class="flex items-center">
					<Button variant="ghost" size="icon" onclick={backToConnections}>
						<ArrowLeft class="h-4 w-4" />
					</Button>
					<div class="flex flex-col">
						<h3 class="text-lg font-semibold">{config.name}</h3>
					</div>
				</div>
				<div class="flex items-center gap-2">
					<span class="text-muted-foreground text-sm">
						{domainMappings.length} of {config.availableDomains?.length || 0} domains mapped
					</span>
					<Button onclick={saveChanges} disabled={isSaving} class="gap-2">
						<Save class="h-4 w-4" />
						{isSaving ? 'Saving...' : 'Save Changes'}
					</Button>
				</div>
			</div>

			<!-- Split Panel Editor -->
			<div class="grid flex-1 gap-4 overflow-hidden">
				<!-- Right Panel: Site Mappings -->
				<div class="bg-card flex flex-col gap-3 overflow-hidden rounded-lg border p-4">
					<SearchBar placeholder="Search mappings" bind:value={searchTerm} />
					<ScrollArea.Root class="flex-1 overflow-auto pr-3">
						<div class="space-y-2">
							{#each (config.availableDomains || []).filter((ad) => ad.name
									.toLowerCase()
									.includes(searchTerm.toLowerCase())) as domain}
								{@const mappedSite = getMappedSite(domain.name)}
								<div class="flex w-full items-center border p-2">
									<div class="flex w-full items-center justify-between">
										<div class="mb-1 text-sm font-medium">{domain.name}</div>
										<div class="flex gap-2">
											{#if mappedSite}
												<Button
													variant="ghost"
													size="icon"
													onclick={() => updateMapping(domain.name, undefined)}
													class="shrink-0"
												>
													<X class="h-4 w-4" />
												</Button>
											{/if}
											<Select.Root
												type="single"
												value={mappedSite?._id}
												onValueChange={(v) => updateMapping(domain.name, v)}
											>
												<Select.Trigger class="w-full">
													{mappedSite?.name || 'Select site...'}
												</Select.Trigger>
												<Select.Content>
													{#each availableSites as site}
														<Select.Item value={site._id}>{site.name}</Select.Item>
													{/each}
													{#if availableSites.length === 0}
														<Select.Item value="" disabled>No available sites</Select.Item>
													{/if}
												</Select.Content>
											</Select.Root>
										</div>
									</div>
								</div>
							{/each}
						</div>
					</ScrollArea.Root>
				</div>
			</div>
		{/if}
	</TabsContent>
</Tabs>
