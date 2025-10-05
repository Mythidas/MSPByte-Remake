<script lang="ts">
	import SearchBar from '$lib/components/SearchBar.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Search, Settings } from 'lucide-svelte';

	const { data } = $props();

	let search = $state('');
	let tags: string[] = $state([]);

	const filteredRows = () => {
		const term = search.toLowerCase();
		const isValid = (integ: any) => {
			const lowerName = integ.name?.toLowerCase();
			const lowerDesc = integ.description?.toLowerCase();

			return (
				(lowerName?.includes(term) || lowerDesc?.includes(term)) &&
				(tags.length ? tags.includes(integ.category) : true)
			);
		};

		return data.integrations.filter((integ) => isValid(integ));
	};

	const uniqueTags = () => {
		const tags = new Set<string>();
		for (const integ of data.integrations) {
			if (integ.category && !tags.has(integ.category)) {
				tags.add(integ.category);
			}
		}

		return Array.from(tags);
	};
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
			{#each uniqueTags() as tag}
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

	<!--Table-->
	<div class="grid grid-cols-4 gap-2">
		{#each filteredRows() as integ}
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
						<div>
							{#if data.dataSources.find((ds) => ds.integration_id === integ.id)?.status === 'active'}
								<Badge>Active</Badge>
							{:else}
								<Badge variant="destructive">Inactive</Badge>
							{/if}
							<Badge variant="secondary">{integ.category}</Badge>
						</div>

						<Button class="size-fit !p-2" variant="ghost" href={`/integrations/${integ.id}`}>
							<Settings class="w-4" />
						</Button>
					</div>
				</Card.Content>
			</Card.Root>
		{/each}
	</div>
</div>
