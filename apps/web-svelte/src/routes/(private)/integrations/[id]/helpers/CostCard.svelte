<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';

	interface Props {
		title: string;
		amount: number;
		description?: string;
		trend?: 'up' | 'down' | 'neutral';
	}

	let { title, amount, description, trend }: Props = $props();

	const trendIcon = $derived(() => {
		if (!trend || trend === 'neutral') return '';
		return trend === 'up' ? '↑' : '↓';
	});

	const trendColor = $derived(() => {
		if (!trend || trend === 'neutral') return 'text-muted-foreground';
		return trend === 'up' ? 'text-red-500' : 'text-green-500';
	});
</script>

<Card>
	<CardHeader class="pb-2">
		<CardTitle class="text-sm font-medium">{title}</CardTitle>
	</CardHeader>
	<CardContent>
		<div class="flex items-baseline gap-2">
			<span class="text-2xl font-bold">${amount.toFixed(2)}</span>
			{#if trend && trend !== 'neutral'}
				<span class="{trendColor()} text-sm font-medium">
					{trendIcon()}
				</span>
			{/if}
		</div>
		{#if description}
			<p class="mt-1 text-xs text-muted-foreground">{description}</p>
		{/if}
	</CardContent>
</Card>
