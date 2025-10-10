<script lang="ts">
	import { api } from '$convex/_generated/api.js';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import { getAppState } from '$lib/state/Application.svelte.js';
	import { useQuery } from 'convex-svelte';
	import { Search, Settings } from 'lucide-svelte';

	const appState = getAppState();

	let search = $state('');
	let tags: string[] = $state([]);

	// Reactively fetch integrations with enabled status
	// TODO: Get actual tenantId from appState.user once user queries are set up
	// For now, we'll use getActiveIntegrations and handle enabled status separately
	const query = useQuery(api.integrations.query.getActiveIntegrationsView, {});
	const integrations = $derived(query.data);

	// Computed: filtered integrations based on search and tags
	const filteredIntegrations = $derived.by(() => {
		if (!integrations) return [];

		const term = search.toLowerCase();

		return integrations.filter((integ) => {
			const lowerName = integ.name?.toLowerCase() ?? '';
			const lowerDesc = integ.description?.toLowerCase() ?? '';

			const matchesSearch = lowerName.includes(term) || lowerDesc.includes(term);
			const matchesTags = tags.length === 0 || tags.includes(integ.category);

			return matchesSearch && matchesTags;
		});
	});

	// Computed: unique category tags from all integrations
	const uniqueTags = $derived.by(() => {
		if (!integrations) return [];

		const tagSet = new Set<string>();
		for (const integ of integrations) {
			if (integ.category) {
				tagSet.add(integ.category);
			}
		}

		return Array.from(tagSet);
	});
</script>

<div class="flex size-full flex-col gap-4">
	<h1 class="text-2xl">Integrations</h1>

	<!--Header-->
	<div>
		<SearchBar
			placeholder="Search Integrations"
			onSearch={(val) => (search = val)}
			icon={Search}
			class="w-1/3"
			delay={0}
		/>
		<!--Tags-->
		<div class="flex gap-1 py-1">
			{#each uniqueTags as tag}
				<Badge
					onclick={() => {
						if (tags.includes(tag)) tags = tags.filter((t) => t !== tag);
						else tags.push(tag);
					}}
					variant={tags.includes(tag) ? 'default' : 'outline'}
					class="text-sm hover:cursor-pointer hover:bg-secondary"
				>
					{tag}
				</Badge>
			{/each}
		</div>
	</div>

	<!--Integrations Grid-->
	{#if query.isLoading}
		<!-- Loading state -->
		<div class="grid grid-cols-4 gap-2">
			{#each Array(8) as _}
				<Card.Root class="animate-pulse justify-between">
					<Card.Header>
						<div class="h-6 w-3/4 rounded bg-muted"></div>
						<div class="mt-2 h-4 w-full rounded bg-muted"></div>
					</Card.Header>
					<Card.Content>
						<div class="h-6 w-1/2 rounded bg-muted"></div>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{:else if filteredIntegrations.length === 0}
		<!-- Empty state -->
		<div class="flex h-64 items-center justify-center">
			<p class="text-muted-foreground">No integrations found</p>
		</div>
	{:else}
		<!-- Integrations list -->
		<div class="grid grid-cols-4 gap-2">
			{#each filteredIntegrations as integ}
				<Card.Root class="justify-between">
					<Card.Header>
						<Card.Title>
							{integ.name}
						</Card.Title>
						<Card.Description>
							{integ.description}
						</Card.Description>
					</Card.Header>
					<Card.Content>
						<div class="flex items-center justify-between">
							<div class="flex gap-1">
								{#if integ.isEnabled && integ.dataSourceStatus === 'active'}
									<Badge>Enabled</Badge>
								{:else if integ.isEnabled}
									<Badge variant="outline">{integ.dataSourceStatus}</Badge>
								{:else}
									<Badge variant="outline">Available</Badge>
								{/if}
								<Badge variant="secondary">{integ.category}</Badge>
							</div>

							<Button class="size-fit !p-2" variant="ghost" href={`/integrations/${integ._id}`}>
								<Settings class="w-4" />
							</Button>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>
