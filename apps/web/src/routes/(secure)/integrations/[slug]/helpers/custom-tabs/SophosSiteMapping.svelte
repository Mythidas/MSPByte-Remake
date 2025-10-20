<script lang="ts">
	import SearchBar from '$lib/components/SearchBar.svelte';
	import { Search, Link2, Unlink } from 'lucide-svelte';
	import { getIntegration } from '../integration/state.svelte.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as ScrollArea from '$lib/components/ui/scroll-area/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import Loader from '$lib/components/Loader.svelte';
	import type { SophosPartnerTenant } from '@workspace/shared/types/integrations/sophos-partner/tenants.js';
	import type { SophosTenantConfig } from '@workspace/shared/types/integrations/sophos-partner/index.js';
	import { toast } from 'svelte-sonner';
	import SearchBox from '$lib/components/SearchBox.svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '$lib/convex/index.js';
	import { getAppState } from '$lib/state/Application.svelte.js';

	const integration = getIntegration();
	const appState = getAppState();

	let searchQuery = $state('');
	let filterType = $state('all');
	let unlinkDialogOpen = $state(false);
	let siteToUnlink = $state<{ id: string; name: string } | null>(null);

	const sitesQuery = useQuery(api.helpers.orm.list, () => ({
		tableName: 'sites'
	}));
	const dataSourcesQuery = useQuery(api.helpers.orm.list, () => ({
		tableName: 'data_sources',
		index: {
			name: 'by_integration',
			params: { integrationId: integration.integration._id }
		}
	}));
	const entitiesQuery = useQuery(api.helpers.orm.list, () => ({
		tableName: 'entities',
		index: {
			name: 'by_integration_type',
			params: {
				integrationId: integration.integration._id,
				entityType: 'companies'
			}
		}
	}));

	const sites = $derived(sitesQuery.data);
	const dataSources = $derived(dataSourcesQuery.data);
	const entities = $derived(entitiesQuery.data);

	// Map entities to tenants format
	const tenants = $derived(
		entities?.map((entity) => ({
			id: entity.externalId,
			showAs: entity.normalizedData?.name || entity.rawData?.name || entity.externalId,
			apiHost: entity.normalizedData?.apiHost || entity.rawData?.apiHost || ''
		})) || []
	);

	// Build the site view with linked tenant information
	const sitesWithLinks = $derived(
		sites?.map((site) => {
			const dataSource = dataSources?.find((ds) => ds.siteId === site._id);
			return {
				...site,
				isLinked: !!dataSource,
				linkedTenantId: dataSource?.externalId || null,
				linkedTenantName: dataSource
					? tenants.find((t) => t.id === dataSource.externalId)?.showAs
					: null,
				linkedTenantApiHost: dataSource?.config?.api_host || null
			};
		}) || []
	);

	async function onTenantSelect(
		siteId: string,
		tenant?: { id: string; showAs: string; apiHost: string }
	) {
		if (!tenant) {
			toast.error('Failed to get the full tenant info');
			return;
		}

		const metadata = {
			tenantId: tenant.id,
			tenantName: tenant.showAs,
			apiHost: tenant.apiHost
		} as SophosTenantConfig;

		try {
			await appState.convex.mutation(api.datasources.mutate.createSiteMapping, {
				siteId: siteId as any,
				integrationId: integration.integration._id,
				externalId: tenant.id,
				config: metadata
			});

			toast.info('Successfully created the link!');
		} catch (error) {
			toast.error('Failed to create link with tenant');
			console.error(error);
		}
	}

	function openUnlinkDialog(siteId: string, siteName: string) {
		siteToUnlink = { id: siteId, name: siteName };
		unlinkDialogOpen = true;
	}

	async function confirmUnlink() {
		if (!siteToUnlink) return;

		try {
			await appState.convex.mutation(api.datasources.mutate.deleteSiteMapping, {
				siteId: siteToUnlink.id as any,
				integrationId: integration.integration._id
			});

			toast.info('Site unlinked successfully');
		} catch (error) {
			toast.error('Failed to unlink site');
			console.error(error);
		}

		unlinkDialogOpen = false;
		siteToUnlink = null;
	}

	function getFilteredSites() {
		let filtered = sitesWithLinks;

		// Filter by search query
		if (searchQuery.trim()) {
			filtered = filtered.filter((site) =>
				site.name?.toLowerCase().includes(searchQuery.toLowerCase())
			);
		}

		// Filter by link status
		if (filterType === 'linked') {
			filtered = filtered.filter((site) => site.isLinked);
		} else if (filterType === 'unlinked') {
			filtered = filtered.filter((site) => !site.isLinked);
		}

		return filtered;
	}
</script>

{#if sitesQuery.isLoading || dataSourcesQuery.isLoading || entitiesQuery.isLoading}
	<div class="flex size-full items-center justify-center">
		<Loader />
	</div>
{:else}
	{@const filteredSites = getFilteredSites()}
	<div class="flex size-full flex-col gap-4">
		<div class="flex w-full max-w-md gap-2">
			<SearchBar
				placeholder={`Search sites (${sitesWithLinks.length})`}
				icon={Search}
				onSearch={(v) => (searchQuery = v)}
			/>
			<Select.Root type="single" onValueChange={(v) => (filterType = v)}>
				<Select.Trigger class="w-32">
					{filterType === 'all' ? 'All' : filterType === 'linked' ? 'Linked' : 'Unlinked'}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="all">All</Select.Item>
					<Select.Item value="linked">Linked</Select.Item>
					<Select.Item value="unlinked">Unlinked</Select.Item>
				</Select.Content>
			</Select.Root>
		</div>

		<ScrollArea.Root class="w-full flex-1 overflow-auto pr-3">
			<div class="grid gap-2">
				{#each filteredSites as site}
					<div
						class="flex w-full items-center justify-between rounded-lg border bg-card p-2 shadow-sm transition-shadow hover:shadow-md"
					>
						<div class="flex items-center gap-3">
							<span class="font-medium">{site.name}</span>
							{#if site.isLinked}
								<Link2 class="h-4 w-4 text-green-600" />
							{/if}
						</div>
						<div class="flex items-center gap-2">
							{#if tenants.length === 0}
								<span class="text-sm text-muted-foreground italic">No tenants available</span>
							{:else}
								{#if site.isLinked}
									<Button
										variant="ghost"
										size="icon"
										onclick={() => openUnlinkDialog(site._id, site.name)}
										class="h-9 w-9"
									>
										<Unlink class="h-4 w-4" />
									</Button>
								{/if}

								<SearchBox
									options={tenants.map((t) => ({ label: t.showAs, value: t.id }))}
									onSelect={(val) =>
										onTenantSelect(
											site._id,
											tenants.find((t) => t.id === val)
										)}
									placeholder="Select Sophos tenant"
									defaultValue={site.linkedTenantId}
									delay={0}
									class="w-96"
								/>
							{/if}
						</div>
					</div>
				{/each}

				{#if filteredSites.length === 0}
					<div class="flex items-center justify-center p-8 text-muted-foreground">
						<p>No sites found matching your criteria</p>
					</div>
				{/if}
			</div>
		</ScrollArea.Root>
	</div>

	<!-- Unlink Confirmation Dialog -->
	<AlertDialog.Root bind:open={unlinkDialogOpen}>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>Unlink Site from Tenant</AlertDialog.Title>
				<AlertDialog.Description>
					Are you sure you want to unlink <strong>{siteToUnlink?.name}</strong>? This action will
					remove the connection between this site and its Sophos tenant.
				</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
				<AlertDialog.Action onclick={confirmUnlink}>Unlink</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
{/if}
