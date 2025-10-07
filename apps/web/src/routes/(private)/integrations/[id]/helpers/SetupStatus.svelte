<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { getIntegration } from './integration/state.svelte.js';
	import Loader from '$lib/components/Loader.svelte';
	import type { Tables } from '@workspace/shared/types/database/index.js';

	const integration = getIntegration();

	let mostRecentJob = $state<Tables<'scheduled_jobs'> | null>(null);
	let loading = $state(true);
	let intervalId: number | null = null;

	const formatLastSynced = (dateString: string | undefined) => {
		if (!dateString) return 'Never';
		const date = new Date(dateString);
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

	const fetchMostRecentJob = async () => {
		const { data } = await integration.orm.getRow('scheduled_jobs', {
			filters: [
				['integration_id', 'eq', integration.integration.id],
				['data_source_id', 'eq', integration.dataSource?.id]
			],
			sorting: [['created_at', 'desc']]
		});

		mostRecentJob = data || null;
		loading = false;
	};

	// Poll every 10 seconds
	$effect(() => {
		fetchMostRecentJob();

		intervalId = window.setInterval(() => {
			fetchMostRecentJob();
		}, 10000);

		return () => {
			if (intervalId) {
				clearInterval(intervalId);
			}
		};
	});

	const getStatusBadge = (job: Tables<'scheduled_jobs'> | null) => {
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
		{#if loading}
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
							{formatLastSynced(mostRecentJob.updated_at || mostRecentJob.created_at)}
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
