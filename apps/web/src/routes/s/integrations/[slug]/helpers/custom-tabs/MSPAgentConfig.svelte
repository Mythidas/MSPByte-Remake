<script lang="ts">
	import Loader from '$lib/components/Loader.svelte';
	import SearchBox from '$lib/components/SearchBox.svelte';
	import { Bolt } from 'lucide-svelte';
	import { getIntegration } from '../integration/state.svelte.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '$lib/convex/index.js';

	const integration = getIntegration();
	const integrationsQuery = useQuery(api.integrations.query.listActiveByCategory, {
		category: 'PSA'
	});
	const integrations = $derived(integrationsQuery.data || []);

	let selected = $state((integration.dataSource?.config as any).psaIntegrationId || '');

	const handleSave = () => {
		integration.saveConfig({ psaIntegrationId: selected });
	};
</script>

{#if integrationsQuery.isLoading}
	<Loader />
{:else}
	<div class="justify-left flex w-full flex-col items-start gap-2">
		<span>PSA</span>
		<SearchBox
			options={integrations.map((i) => ({ label: i.name!, value: i._id! }))}
			placeholder="Search Integrations"
			icon={Bolt}
			onSelect={(val) => (selected = val)}
			defaultValue={(integration.dataSource?.config as any).psaIntegrationId}
		/>

		<Button
			onclick={handleSave}
			disabled={!integration.isConfigChanged({ psaIntegrationId: selected })}
			class="ml-auto">Save Configuration</Button
		>
	</div>
{/if}
