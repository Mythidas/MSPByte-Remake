<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { getIntegrationState } from './state.svelte.js';
	import { daysUntil } from '$lib/utils.js';

	const integrationState = getIntegrationState();
	const { icon_url, name, category, product_url } = integrationState.integration!;
</script>

<div class="flex items-start justify-between gap-4">
	<div class="flex items-center gap-4">
		{#if icon_url}
			<img src={icon_url} alt={`${name} logo`} class="h-16 w-16 rounded-lg object-contain" />
		{:else}
			<div class="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
				<span class="text-2xl font-semibold text-muted-foreground">{name[0]}</span>
			</div>
		{/if}

		<div class="space-y-1">
			<div class="flex items-center gap-3">
				<h1 class="text-3xl font-bold">{name}</h1>
				<Badge variant={integrationState.isEnabled() ? 'default' : 'secondary'}>
					{integrationState.isEnabled() ? 'Connected' : 'Not Connected'}
				</Badge>
				{#if integrationState.dataSource?.deleted_at && !integrationState.isEnabled()}
					<Badge variant="destructive">
						{daysUntil(integrationState.dataSource.deleted_at, 7)}
					</Badge>
				{/if}
				{#if integrationState.isEnabled()}
					<Badge variant="outline" class="border-green-500 text-green-700 dark:text-green-400">
						Enabled
					</Badge>
				{/if}
			</div>
			<div class="flex items-center gap-2 text-sm text-muted-foreground">
				<span class="capitalize">{category}</span>
				{#if product_url}
					<span>•</span>
					<a href={product_url} target="_blank" rel="noopener noreferrer" class="hover:underline">
						Visit product page
					</a>
				{/if}
			</div>
		</div>
	</div>

	<div class="flex gap-2">
		<Button
			variant="outline"
			onclick={integrationState.testConnection}
			disabled={!integrationState.isEnabled()}
		>
			Test Connection
		</Button>
		<Button
			variant={integrationState.isEnabled() ? 'secondary' : 'default'}
			onclick={integrationState.toggleEnabled}
		>
			{integrationState.isEnabled() ? 'Disable' : 'Enable'}
		</Button>
	</div>
</div>
