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
	import { type APIResponse } from '@workspace/shared/types/api.js';
	import SearchBox from '$lib/components/SearchBox.svelte';
	import type { Tables } from '@workspace/shared/types/database/index.js';

	const integration = getIntegration();

	let searchQuery = $state('');
	let filterType = $state('all');
	let unlinkDialogOpen = $state(false);
	let siteToUnlink = $state<{ id: string; name: string } | null>(null);
	let sites = $state<Tables<'sophos_partner_sites_view'>[]>([]);
	let tenants = $state<SophosPartnerTenant[]>([]);
	let loading = $state(true);

	async function fetchTenants() {
		const dataSourceId = integration.dataSource?.id;

		const [{ data: sitesData }, tenantsResponse] = await Promise.all([
			integration.orm.getRows('sophos_partner_sites_view'),
			fetch(`/api/v1.0/external/sophos/tenants?dataSourceId=${dataSourceId}`).then(
				(res) => res.json() as Promise<APIResponse<SophosPartnerTenant[]>>
			)
		]);

		sites = sitesData?.rows || [];
		tenants = tenantsResponse.data || [];
		loading = false;
	}

	$effect(() => {
		fetchTenants();
	});

	async function onTenantSelect(siteId: string, tenant?: SophosPartnerTenant) {
		if (!tenant) {
			toast.error('Failed to get the full tenant info');
			return;
		}

		const metadata = {
			tenant_id: tenant.id,
			tenant_name: tenant.showAs,
			api_host: tenant.apiHost
		} as SophosTenantConfig;

		const { data } = await integration.orm.getRow('data_sources', {
			filters: [
				['site_id', 'eq', siteId],
				['integration_id', 'eq', integration.integration?.id],
				['external_id', 'eq', tenant.id]
			]
		});

		if (data) {
			const { error: deleteError } = await integration.orm.deleteRows('data_sources', {
				filters: [['id', 'eq', data.id]]
			});
			if (deleteError) {
				toast.error('Failed to modify existing link');
				return;
			}
		}

		const { error: insertError } = await integration.orm.insertRows('data_sources', {
			rows: [
				{
					tenant_id: integration.dataSource?.tenant_id!,
					integration_id: integration.dataSource?.integration_id!,
					site_id: siteId,
					config: metadata,
					credential_expiration_at: '9999-12-31 23:59:59+00',
					external_id: tenant.id
				}
			]
		});

		if (insertError) {
			toast.error('Failed to create link with tenant');
			return;
		}

		// Optimistically update local state
		sites = sites.map((s) =>
			s.id === siteId
				? {
						...s,
						is_linked: true,
						linked_tenant_id: tenant.id,
						linked_tenant_name: tenant.showAs,
						linked_tenant_api_host: tenant.apiHost
					}
				: s
		);

		toast.info('Successfully created the link!');
	}

	function openUnlinkDialog(siteId: string, siteName: string) {
		siteToUnlink = { id: siteId, name: siteName };
		unlinkDialogOpen = true;
	}

	async function confirmUnlink() {
		if (!siteToUnlink) return;

		const { error } = await integration.orm.deleteRows('data_sources', {
			filters: [
				['site_id', 'eq', siteToUnlink.id],
				['integration_id', 'eq', integration.integration?.id]
			]
		});

		if (error) {
			toast.error('Failed to unlink site');
		} else {
			// Optimistically update local state
			sites = sites.map((s) =>
				s.id === siteToUnlink?.id
					? {
							...s,
							is_linked: false,
							linked_tenant_id: null,
							linked_tenant_name: null,
							linked_tenant_api_host: null
						}
					: s
			);
			toast.info('Site unlinked successfully');
		}

		unlinkDialogOpen = false;
		siteToUnlink = null;
	}

	function getFilteredSites(sites: Tables<'sophos_partner_sites_view'>[], tenants: any[]) {
		let filtered = sites;

		// Filter by search query
		if (searchQuery.trim()) {
			filtered = filtered.filter((site) =>
				site.name?.toLowerCase().includes(searchQuery.toLowerCase())
			);
		}

		// Filter by link status
		if (filterType === 'linked') {
			filtered = filtered.filter((site) => site.is_linked);
		} else if (filterType === 'unlinked') {
			filtered = filtered.filter((site) => !site.is_linked);
		}

		return filtered;
	}

	function getLinkedTenantName(site: any, tenants: SophosPartnerTenant[]) {
		if (!site.linked_tenant_id) return null;
		const tenant = tenants.find((t) => t.id === site.linked_tenant_id);
		return tenant?.showAs || null;
	}
</script>

{#if loading}
	<div class="flex size-full items-center justify-center">
		<Loader />
	</div>
{:else}
	{@const filteredSites = getFilteredSites(sites, tenants)}
	<div class="flex size-full flex-col gap-4">
		<div class="flex w-full max-w-md gap-2">
			<SearchBar
				placeholder={`Search sites (${sites.length})`}
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
					{@const linkedTenantName = getLinkedTenantName(site, tenants)}
					<div
						class="flex w-full items-center justify-between rounded-lg border bg-card p-2 shadow-sm transition-shadow hover:shadow-md"
					>
						<div class="flex items-center gap-3">
							<span class="font-medium">{site.name}</span>
							{#if site.is_linked}
								<Link2 class="h-4 w-4 text-green-600" />
							{/if}
						</div>
						<div class="flex items-center gap-2">
							{#if tenants.length === 0}
								<span class="text-sm text-muted-foreground italic">No tenants available</span>
							{:else}
								{#if site.is_linked}
									<Button
										variant="ghost"
										size="icon"
										onclick={() => openUnlinkDialog(site.id!, site.name!)}
										class="h-9 w-9"
									>
										<Unlink class="h-4 w-4" />
									</Button>
								{/if}

								<SearchBox
									options={tenants.map((t) => ({ label: t.showAs, value: t.id }))}
									onSelect={(val) =>
										onTenantSelect(
											site.id!,
											tenants.find((t) => t.id === val)
										)}
									placeholder="Select Sophos tenant"
									defaultValue={site.linked_tenant_id}
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
