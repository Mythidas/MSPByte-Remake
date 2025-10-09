<script lang="ts">
	import { useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api.js';

	const query = useQuery(api.auth.getUser, {});
</script>

<h1>Public</h1>

{#if query.isLoading}
	Loading...
{:else}
	{query.data?.length}
{/if}
