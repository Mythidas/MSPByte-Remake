<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { getIntegration } from './integration/state.svelte.js';

	const integration = getIntegration();
</script>

<Card>
	<CardHeader class="pb-2">
		<CardTitle class="text-sm font-medium">Setup Status</CardTitle>
	</CardHeader>
	<CardContent class="flex h-full flex-col justify-end">
		<div class="flex items-center justify-between">
			<span class="text-sm text-muted-foreground">Configuration</span>
			<Badge variant={integration.isValidConfig() ? 'default' : 'secondary'}>
				{integration.isValidConfig() ? 'Complete' : 'Incomplete'}
			</Badge>
		</div>
	</CardContent>
</Card>
