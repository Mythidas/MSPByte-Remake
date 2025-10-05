<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import type { SetupStatusData } from './mock-data';

	interface Props {
		status: SetupStatusData;
	}

	let { status }: Props = $props();

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
</script>

<Card>
	<CardHeader class="pb-2">
		<CardTitle class="text-sm font-medium">Setup Status</CardTitle>
	</CardHeader>
	<CardContent class="space-y-3">
		<div class="flex items-center justify-between">
			<span class="text-sm text-muted-foreground">Configuration</span>
			<Badge variant={status.configurationComplete ? 'default' : 'secondary'}>
				{status.configurationComplete ? 'Complete' : 'Incomplete'}
			</Badge>
		</div>

		<div class="flex items-center justify-between">
			<span class="text-sm text-muted-foreground">Last Synced</span>
			<span class="text-sm font-medium">{formatLastSynced(status.lastSyncedAt)}</span>
		</div>

		{#if status.errorMessage}
			<div class="rounded-md bg-destructive/10 p-2">
				<p class="text-xs text-destructive">{status.errorMessage}</p>
			</div>
		{/if}
	</CardContent>
</Card>
