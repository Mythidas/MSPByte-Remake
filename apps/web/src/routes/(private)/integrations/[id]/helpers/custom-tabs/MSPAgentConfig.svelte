<script lang="ts">
	import Loader from '$lib/components/Loader.svelte';
	import SearchBox from '$lib/components/SearchBox.svelte';
	import { Bolt } from 'lucide-svelte';
	import { getIntegrationState } from '../state.svelte.js';
	import Button from '$lib/components/ui/button/button.svelte';

	const integrationState = getIntegrationState();
	const fetchIntegrations = async () => {
		return integrationState.orm.getRows('integrations_view', {
			filters: [
				['is_active', 'eq', true],
				['category', 'eq', 'PSA'],
				['data_sources_count', 'gte', 1]
			]
		});
	};

	let selected = $state((integrationState.dataSource?.config as any).psa_integration_id || '');

	const handleSave = () => {
		integrationState.saveConfig({ psa_integration_id: selected });
	};
</script>

{#await fetchIntegrations()}
	<Loader />
{:then { data }}
	{@const integrations = data?.rows || []}
	<div class="justify-left flex w-full flex-col items-start gap-2">
		<span>PSA</span>
		<SearchBox
			options={integrations.map((i) => ({ label: i.name!, value: i.id! }))}
			placeholder="Search Integrations"
			icon={Bolt}
			onSelect={(val) => (selected = val)}
			defaultValue={(integrationState.dataSource?.config as any).psa_integration_id}
		/>

		<Button
			onclick={handleSave}
			disabled={!integrationState.isConfigChanged({ psa_integration_id: selected })}
			class="ml-auto">Save Configuration</Button
		>
	</div>
{/await}
