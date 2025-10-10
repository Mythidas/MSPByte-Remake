<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { getIntegration } from './integration/state.svelte.js';
	import { daysUntil } from '$lib/utils.js';
	import { Dates } from '$lib/Dates.js';

	const integration = getIntegration();
	const { iconUrl, name, category, productUrl } = integration.integration!;

	function toggleEnabled() {
		if (integration.isEnabled()) {
			integration.disable();
		} else {
			integration.enable();
		}
	}
</script>

<div class="flex items-start justify-between gap-4">
	<div class="flex items-center gap-4">
		{#if iconUrl}
			<img src={iconUrl} alt={`${name} logo`} class="h-16 w-16 rounded-lg object-contain" />
		{:else}
			<div class="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
				<span class="text-2xl font-semibold text-muted-foreground">{name[0]}</span>
			</div>
		{/if}

		<div class="space-y-1">
			<div class="flex items-center gap-3">
				<h1 class="text-3xl font-bold">{name}</h1>
				<Badge variant={integration.isEnabled() ? 'default' : 'secondary'}>
					{integration.isEnabled() && integration.isValidConfig() ? 'Connected' : 'Not Connected'}
				</Badge>
				{#if integration.dataSource?.deletedAt && !integration.isEnabled()}
					<Badge variant="destructive">
						{new Dates(new Date(integration.dataSource.deletedAt)).add({ days: 7 }).toDaysUntil()}
					</Badge>
				{/if}
				{#if integration.isEnabled()}
					<Badge variant="outline" class="border-green-500 text-green-700 dark:text-green-400">
						Enabled
					</Badge>
				{/if}
			</div>
			<div class="flex items-center gap-2 text-sm text-muted-foreground">
				<span class="capitalize">{category}</span>
				{#if productUrl}
					<span>•</span>
					<a href={productUrl} target="_blank" rel="noopener noreferrer" class="hover:underline">
						Visit product page
					</a>
				{/if}
			</div>
		</div>
	</div>

	<div class="flex gap-2">
		{#if integration.isEnabled()}
			<Button
				variant="outline"
				onclick={integration.testConnection}
				disabled={!integration.isValidConfig()}
			>
				Test Connection
			</Button>
		{/if}
		<Button variant={integration.isEnabled() ? 'secondary' : 'default'} onclick={toggleEnabled}>
			{integration.isEnabled() ? 'Disable' : 'Enable'}
		</Button>
	</div>
</div>
