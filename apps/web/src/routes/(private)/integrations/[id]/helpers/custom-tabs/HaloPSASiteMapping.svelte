<script lang="ts">
	import SearchBar from '$lib/components/SearchBar.svelte';
	import { Search, Link2, Unlink, Plus, ArrowRight } from 'lucide-svelte';
	import { getIntegration } from '../integration/state.svelte.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as ScrollArea from '$lib/components/ui/scroll-area/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import Loader from '$lib/components/Loader.svelte';
	import { toast } from 'svelte-sonner';
	import SearchBox from '$lib/components/SearchBox.svelte';
	import type { Tables } from '@workspace/shared/types/database/index.js';

	const integration = getIntegration();

	let searchQuery = $state('');
	let filterType = $state('all');
	let unlinkDialogOpen = $state(false);
	let createDialogOpen = $state(false);
	let companyToUnlink = $state<{ id: string; name: string } | null>(null);
	let companyToCreate = $state<Tables<'psa_companies_view'> | null>(null);
	let sites = $state<Tables<'sites_view'>[]>([]);
	let companies = $state<Tables<'psa_companies_view'>[]>([]);
	let loading = $state(true);

	async function fetchData() {
		// Fetch from views schema
		const [sitesResponse, companiesResponse] = await Promise.all([
			integration.orm.getRows('sites_view', {
				sorting: [['name', 'asc']]
			}),
			integration.orm.getRows('psa_companies_view', {
				filters: [['integration_id', 'eq', integration.integration.id]],
				sorting: [['name', 'asc']]
			})
		]);

		sites = sitesResponse.data?.rows || [];
		companies = companiesResponse.data?.rows || [];
		loading = false;
	}

	$effect(() => {
		fetchData();
	});

	async function onSiteSelect(companyExternalId: string, siteId?: string) {
		if (!siteId) {
			toast.error('Failed to get site info');
			return;
		}

		const company = companies.find((c) => c.external_id === companyExternalId);
		if (!company) {
			toast.error('Failed to find company');
			return;
		}

		// Check if another site is already linked to this company
		const alreadyLinkedSite = sites.find(
			(s) => s.psa_company_id === companyExternalId && s.psa_integration_id === 'halopsa'
		);
		if (alreadyLinkedSite && alreadyLinkedSite.id !== siteId) {
			// Unlink the old site first
			await integration.orm.updateRow('sites', {
				id: alreadyLinkedSite.id!,
				row: {
					psa_company_id: null,
					psa_integration_id: null,
					psa_parent_company_id: null
				}
			});
		}

		// Update selected site with PSA company link
		const { error } = await integration.orm.updateRow('sites', {
			id: siteId,
			row: {
				psa_company_id: company.external_id!,
				psa_integration_id: 'halopsa',
				psa_parent_company_id: null
			}
		});

		if (error) {
			toast.error('Failed to link company to site');
			return;
		}

		// Refresh data to show updated state
		await fetchData();

		toast.info('Successfully linked company to site!');
	}

	function onCreateNewSite(company: Tables<'psa_companies_view'>) {
		companyToCreate = company;
		createDialogOpen = true;
	}

	async function confirmCreateSite() {
		if (!companyToCreate) return;

		const { data: newSite, error } = await integration.orm.insertRows('sites', {
			rows: [
				{
					tenant_id: integration.dataSource?.tenant_id!,
					name: companyToCreate.name!,
					psa_company_id: companyToCreate.external_id!,
					psa_parent_company_id: companyToCreate.external_parent_id,
					psa_integration_id: 'halopsa',
					status: 'active'
				}
			]
		});

		if (error || !newSite || newSite.length === 0) {
			toast.error('Failed to create site from company');
			return;
		}

		// Refetch to get the updated view data
		await fetchData();

		toast.info(`Successfully created site "${companyToCreate.name}"!`);
		createDialogOpen = false;
		companyToCreate = null;
	}

	function openUnlinkDialog(companyExternalId: string, companyName: string) {
		companyToUnlink = { id: companyExternalId, name: companyName };
		unlinkDialogOpen = true;
	}

	async function confirmUnlink() {
		if (!companyToUnlink) return;

		// Find the site linked to this company
		const linkedSite = sites.find(
			(s) => s.psa_company_id === companyToUnlink!.id && s.psa_integration_id === 'halopsa'
		);

		if (!linkedSite) {
			toast.error('No linked site found');
			unlinkDialogOpen = false;
			companyToUnlink = null;
			return;
		}

		const { error } = await integration.orm.updateRow('sites', {
			id: linkedSite.id!,
			row: {
				psa_company_id: null,
				psa_integration_id: null,
				psa_parent_company_id: null
			}
		});

		if (error) {
			toast.error('Failed to unlink company');
		} else {
			await fetchData();
			toast.info('Company unlinked successfully');
		}

		unlinkDialogOpen = false;
		companyToUnlink = null;
	}

	function getFilteredCompanies() {
		let filtered = companies;

		// Filter by search query
		if (searchQuery.trim()) {
			filtered = filtered.filter((company) =>
				company.name?.toLowerCase().includes(searchQuery.toLowerCase())
			);
		}

		// Filter by link status
		if (filterType === 'linked') {
			filtered = filtered.filter((company) => isCompanyLinked(company.external_id!));
		} else if (filterType === 'unlinked') {
			filtered = filtered.filter((company) => !isCompanyLinked(company.external_id!));
		}

		return filtered;
	}

	function isCompanyLinked(companyExternalId: string) {
		return sites.some(
			(s) => s.psa_company_id === companyExternalId && s.psa_integration_id === 'halopsa'
		);
	}

	function getLinkedSite(companyExternalId: string) {
		return sites.find(
			(s) => s.psa_company_id === companyExternalId && s.psa_integration_id === 'halopsa'
		);
	}

	function getAvailableSites(currentCompanyExternalId: string) {
		// Filter out sites that are already linked to other companies
		// But include the site if it's linked to the current company
		return sites.filter((s) => !s.psa_company_id || s.psa_company_id === currentCompanyExternalId);
	}
</script>

{#if loading}
	<div class="flex size-full items-center justify-center">
		<Loader />
	</div>
{:else}
	{@const filteredCompanies = getFilteredCompanies()}
	<div class="flex size-full flex-col gap-4">
		<div class="flex w-full max-w-md gap-2">
			<SearchBar
				placeholder={`Search companies (${companies.length})`}
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
				{#each filteredCompanies as company}
					{@const linkedSite = getLinkedSite(company.external_id!)}
					{@const isLinked = !!linkedSite}
					{@const availableSites = getAvailableSites(company.external_id!)}
					<div
						class="flex w-full items-center justify-between rounded-lg border bg-card p-2 shadow-sm transition-shadow hover:shadow-md"
					>
						<div class="flex items-center gap-3">
							<div class="flex flex-col">
								<span class="font-medium">
									{company.name}
								</span>
								<div class="flex items-center gap-2">
									<p class="text-xs text-muted-foreground">(ID: {company.external_id})</p>
									{#if linkedSite}
										<ArrowRight class="w-3" />
										<span class="my-auto text-xs text-muted-foreground">{linkedSite.name}</span>
									{/if}
									{#if isLinked}
										<Link2 class="h-4 w-4 text-green-600" />
									{/if}
								</div>
							</div>
						</div>
						<div class="flex items-center gap-2">
							{#if isLinked}
								<Button
									variant="ghost"
									size="icon"
									onclick={() => openUnlinkDialog(company.external_id!, company.name!)}
									class="h-9 w-9"
								>
									<Unlink class="h-4 w-4" />
								</Button>

								<div class="w-80 rounded bg-input p-2 px-4 text-right shadow">
									{linkedSite.name}
								</div>
							{/if}

							{#if !isLinked}
								<SearchBox
									options={availableSites.map((s) => ({ label: s.name!, value: s.id! }))}
									onSelect={(val) => onSiteSelect(company.external_id!, val)}
									placeholder="Select internal site"
									delay={0}
									class="w-80"
								/>

								<Button
									variant="outline"
									size="sm"
									onclick={() => onCreateNewSite(company)}
									class="gap-2"
								>
									<Plus class="h-4 w-4" />
									Create
								</Button>
							{/if}
						</div>
					</div>
				{/each}

				{#if filteredCompanies.length === 0}
					<div class="flex items-center justify-center p-8 text-muted-foreground">
						<p>No companies found matching your criteria</p>
					</div>
				{/if}
			</div>
		</ScrollArea.Root>
	</div>

	<!-- Unlink Confirmation Dialog -->
	<AlertDialog.Root bind:open={unlinkDialogOpen}>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>Unlink HaloPSA Company</AlertDialog.Title>
				<AlertDialog.Description>
					Are you sure you want to unlink <strong>{companyToUnlink?.name}</strong>? This will remove
					the connection between this company and its internal site.
				</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
				<AlertDialog.Action onclick={confirmUnlink}>Unlink</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>

	<!-- Create Site Confirmation Dialog -->
	<AlertDialog.Root bind:open={createDialogOpen}>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>Create New Site</AlertDialog.Title>
				<AlertDialog.Description>
					{#if companyToCreate}
						Create a new internal site from HaloPSA company <strong>{companyToCreate.name}</strong>?
						The new site will be automatically linked to this company.
					{:else}
						Select a HaloPSA company to create a new site.
					{/if}
				</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
				<AlertDialog.Action onclick={confirmCreateSite} disabled={!companyToCreate}>
					Create Site
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
{/if}
