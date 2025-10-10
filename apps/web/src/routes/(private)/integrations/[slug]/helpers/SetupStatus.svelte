<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { getIntegration } from './integration/state.svelte.js';
	import Loader from '$lib/components/Loader.svelte';
	import { useQuery } from 'convex-svelte';
	import { api, type Doc } from '$lib/convex';

	const integration = getIntegration();

	const formatLastSynced = (dateRaw?: number) => {
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

	const mostRecentJobQuery = useQuery(api.scheduledjobs.query.getRecentByDataSource, {
		dataSourceId: integration.dataSource?._id || ('' as any)
	});
	const mostRecentJob = $derived(mostRecentJobQuery.data);

	const getStatusBadge = (job?: Doc<'scheduled_jobs'> | null) => {
		if (!job) {
			return { variant: 'secondary' as const, text: 'No sync scheduled' };
		}

		if (job.status === 'running') {
			return { variant: 'default' as const, text: 'Syncing...' };
		}

		if (job.status === 'completed') {
			return { variant: 'outline' as const, text: 'Up to date' };
		}

		if (job.status === 'failed') {
			return { variant: 'destructive' as const, text: 'Sync failed' };
		}

		if (job.status === 'pending') {
			return { variant: 'secondary' as const, text: 'Pending' };
		}

		return { variant: 'secondary' as const, text: 'Unknown' };
	};
</script>

<Card>
	<CardHeader class="pb-2">
		<CardTitle class="text-sm font-medium">Setup Status</CardTitle>
	</CardHeader>
	<CardContent class="space-y-3">
		{#if mostRecentJobQuery.isLoading}
			<div class="flex items-center justify-center py-4">
				<Loader />
			</div>
		{:else}
			<div class="flex items-center justify-between">
				<span class="text-sm text-muted-foreground">Configuration</span>
				<Badge variant={integration.isValidConfig() ? 'default' : 'secondary'}>
					{integration.isValidConfig() ? 'Complete' : 'Incomplete'}
				</Badge>
			</div>

			<div class="flex items-center justify-between">
				<span class="text-sm text-muted-foreground">Sync Status</span>
				<div class="flex gap-2">
					{#if mostRecentJob}
						<span class="text-sm font-medium text-muted-foreground">
							{formatLastSynced(mostRecentJob.updatedAt || mostRecentJob.createdAt)}
						</span>
					{/if}
					<Badge variant={getStatusBadge(mostRecentJob).variant}>
						{getStatusBadge(mostRecentJob).text}
					</Badge>
				</div>
			</div>
		{/if}
	</CardContent>
</Card>
