<script lang="ts">
	import { getIntegration } from './integration/state.svelte.js';
	import { Badge } from '$lib/components/ui/badge';
	import Loader from '$lib/components/Loader.svelte';
	import { useQuery } from 'convex-svelte';
	import { api, type Id } from '$lib/convex';

	const integration = getIntegration();

	const formatLastSynced = (dateRaw?: number | null) => {
		if (!dateRaw) return 'Never';
		const date = new Date(dateRaw);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		return `${diffDays}d ago`;
	};

	const supportedTypes = integration.integration.supportedTypes.map((st) => st.type);
	const syncStatusQuery = useQuery(api.integrations.query.getStatusMatrix, {
		dataSourceId: integration.dataSource?._id! as Id<'data_sources'>, // Replace "dataSources" with your table name
		supportedTypes
	});
	const syncStatuses = $derived(syncStatusQuery?.data);

	const getStatusBadge = (status?: string) => {
		switch (status) {
			case 'running':
				return { variant: 'default' as const, text: 'Syncing' };
			case 'completed':
				return { variant: 'outline' as const, text: 'Completed' };
			case 'failed':
				return { variant: 'destructive' as const, text: 'Failed' };
			case 'pending':
				return { variant: 'secondary' as const, text: 'Pending' };
			case 'cancelled':
				return { variant: 'secondary' as const, text: 'Cancelled' };
			default:
				return { variant: 'secondary' as const, text: 'Not Started' };
		}
	};

	const formatEntityType = (type: string) => {
		// Convert "sites" -> "Sites", "user_groups" -> "User Groups"
		return type
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	};
</script>

{#if syncStatusQuery?.isLoading}
	<div class="flex items-center justify-center py-12">
		<Loader />
	</div>
{:else if syncStatuses && syncStatuses.length === 0}
	<div class="flex flex-col items-center justify-center py-12 text-center">
		<p class="text-muted-foreground">No sync data available</p>
		<p class="mt-1 text-sm text-muted-foreground">
			Configure the integration to start syncing data
		</p>
	</div>
{:else}
	<div class="space-y-3">
		{#each integration.integration.supportedTypes as supported}
			{@const syncStatus = syncStatuses?.find((ss) => ss.entityType === supported.type)}
			<div class="rounded-lg border p-4">
				<div class="flex items-start justify-between">
					<div class="flex-1">
						<div class="flex items-center gap-3">
							<h3 class="font-semibold">{formatEntityType(supported.type)}</h3>
							<Badge variant={getStatusBadge(syncStatus?.status).variant}>
								{getStatusBadge(syncStatus?.status).text}
							</Badge>
							{#if syncStatus && syncStatus.failedJobs > 0}
								<Badge variant="destructive"
									>{syncStatus?.failedJobs} Error{syncStatus.failedJobs > 1 ? 's' : ''}</Badge
								>
							{/if}
							<Badge>
								{supported.isGlobal ? 'Global' : 'Site'}
							</Badge>
						</div>

						<div class="mt-2 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
							<div>
								<span class="text-muted-foreground">Last Sync:</span>
								<span class="ml-1 font-medium">{formatLastSynced(syncStatus?.lastSync)}</span>
							</div>
							<div>
								<span class="text-muted-foreground">Total Jobs:</span>
								<span class="ml-1 font-medium">{syncStatus?.totalJobs || 0}</span>
							</div>
							<div>
								<span class="text-muted-foreground">Running:</span>
								<span class="ml-1 font-medium">{syncStatus?.runningJobs || 0}</span>
							</div>
							<div>
								<span class="text-muted-foreground">Pending:</span>
								<span class="ml-1 font-medium">{syncStatus?.pendingJobs || 0}</span>
							</div>
						</div>

						{#if syncStatus?.error}
							<div class="mt-3 rounded-md bg-destructive/10 p-3">
								<p class="text-sm font-medium text-destructive">Latest Error:</p>
								<p class="mt-1 text-sm text-destructive/80">{syncStatus.error}</p>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}
