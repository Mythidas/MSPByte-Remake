<script lang="ts">
	import { getIntegration } from './integration/state.svelte.js';
	import { Badge } from '$lib/components/ui/badge';
	import Loader from '$lib/components/Loader.svelte';
	import type { Tables } from '@workspace/shared/types/database/index.js';

	const integration = getIntegration();

	type SyncStatusData = {
		entityType: string;
		lastSync: string | null;
		status: string;
		error: string | null;
		totalJobs: number;
		failedJobs: number;
		runningJobs: number;
		pendingJobs: number;
	};

	let syncStatuses = $state<SyncStatusData[]>([]);
	let loading = $state(true);
	let intervalId: number | null = null;

	const formatLastSynced = (dateString: string | null) => {
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

	const fetchSyncStatuses = async () => {
		if (!integration.dataSource) {
			loading = false;
			return;
		}

		const supportedTypes = integration.integration?.supported_types || [];

		// Fetch all jobs for this data source
		const { data: allJobs } = await integration.orm.getRows('scheduled_jobs', {
			filters: [
				['integration_id', 'eq', integration.integration.id],
				['data_source_id', 'eq', integration.dataSource.id]
			],
			sorting: [['created_at', 'desc']]
		});

		// Group jobs by entity type
		const jobsByType = new Map<string, Tables<'scheduled_jobs'>[]>();
		const jobsArray = allJobs?.rows || [];
		for (const type of supportedTypes) {
			const typeJobs = jobsArray.filter((job: Tables<'scheduled_jobs'>) => job.action === `sync.${type}`);
			jobsByType.set(type, typeJobs);
		}

		// Build sync status for each entity type
		syncStatuses = supportedTypes.map((type) => {
			const jobs = jobsByType.get(type) || [];
			const mostRecentJob = jobs[0] || null;
			const failedCount = jobs.filter((j) => j.status === 'failed').length;
			const runningCount = jobs.filter((j) => j.status === 'running').length;
			const pendingCount = jobs.filter((j) => j.status === 'pending').length;

			return {
				entityType: type,
				lastSync: mostRecentJob?.updated_at || mostRecentJob?.created_at || null,
				status: mostRecentJob?.status || 'none',
				error: mostRecentJob?.error || null,
				totalJobs: jobs.length,
				failedJobs: failedCount,
				runningJobs: runningCount,
				pendingJobs: pendingCount
			};
		});

		loading = false;
	};

	// Poll every 10 seconds
	$effect(() => {
		fetchSyncStatuses();

		intervalId = window.setInterval(() => {
			fetchSyncStatuses();
		}, 10000);

		return () => {
			if (intervalId) {
				clearInterval(intervalId);
			}
		};
	});

	const getStatusBadge = (status: string) => {
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

{#if loading}
	<div class="flex items-center justify-center py-12">
		<Loader />
	</div>
{:else if syncStatuses.length === 0}
	<div class="flex flex-col items-center justify-center py-12 text-center">
		<p class="text-muted-foreground">No sync data available</p>
		<p class="mt-1 text-sm text-muted-foreground">
			Configure the integration to start syncing data
		</p>
	</div>
{:else}
	<div class="space-y-3">
		{#each syncStatuses as syncStatus}
			<div class="rounded-lg border p-4">
				<div class="flex items-start justify-between">
					<div class="flex-1">
						<div class="flex items-center gap-3">
							<h3 class="font-semibold">{formatEntityType(syncStatus.entityType)}</h3>
							<Badge variant={getStatusBadge(syncStatus.status).variant}>
								{getStatusBadge(syncStatus.status).text}
							</Badge>
							{#if syncStatus.failedJobs > 0}
								<Badge variant="destructive">{syncStatus.failedJobs} Error{syncStatus.failedJobs >
								1
									? 's'
									: ''}</Badge>
							{/if}
						</div>

						<div class="mt-2 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
							<div>
								<span class="text-muted-foreground">Last Sync:</span>
								<span class="ml-1 font-medium">{formatLastSynced(syncStatus.lastSync)}</span>
							</div>
							<div>
								<span class="text-muted-foreground">Total Jobs:</span>
								<span class="ml-1 font-medium">{syncStatus.totalJobs}</span>
							</div>
							<div>
								<span class="text-muted-foreground">Running:</span>
								<span class="ml-1 font-medium">{syncStatus.runningJobs}</span>
							</div>
							<div>
								<span class="text-muted-foreground">Pending:</span>
								<span class="ml-1 font-medium">{syncStatus.pendingJobs}</span>
							</div>
						</div>

						{#if syncStatus.error}
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
