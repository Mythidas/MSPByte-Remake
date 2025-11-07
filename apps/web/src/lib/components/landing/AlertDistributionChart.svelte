<script lang="ts">
	import { Chart, Svg, Pie, Arc } from 'layerchart';
	import { ChartContainer, ChartTooltip, type ChartConfig } from '$lib/components/ui/chart';

	type Props = {
		critical: number;
		high: number;
		medium: number;
		low: number;
	};

	let { critical = 0, high = 0, medium = 0, low = 0 }: Props = $props();

	// Prepare data for the chart
	const chartData = $derived(
		[
			{ severity: 'critical', label: 'Critical', value: critical, fill: 'hsl(var(--chart-1))' },
			{ severity: 'high', label: 'High', value: high, fill: 'hsl(var(--chart-2))' },
			{ severity: 'medium', label: 'Medium', value: medium, fill: 'hsl(var(--chart-3))' },
			{ severity: 'low', label: 'Low', value: low, fill: 'hsl(var(--chart-4))' }
		].filter((item) => item.value > 0)
	); // Only show segments with data

	const chartConfig: ChartConfig = {
		critical: {
			label: 'Critical',
			color: 'hsl(var(--chart-1))'
		},
		high: {
			label: 'High',
			color: 'hsl(var(--chart-2))'
		},
		medium: {
			label: 'Medium',
			color: 'hsl(var(--chart-3))'
		},
		low: {
			label: 'Low',
			color: 'hsl(var(--chart-4))'
		}
	};

	const totalAlerts = $derived(critical + high + medium + low);
	const hasData = $derived(totalAlerts > 0);
</script>

{#if hasData}
	<ChartContainer config={chartConfig} class="h-[200px] w-full">
		<Chart
			data={chartData}
			x="label"
			y="value"
			r="value"
			padding={{ top: 20, bottom: 20, left: 20, right: 20 }}
		>
			<Svg>
				<Pie let:arcs>
					{#each arcs as arc (arc.data.label)}
						<Arc
							{arc}
							fill={arc.data.fill}
							stroke="hsl(var(--background))"
							strokeWidth={2}
							class="cursor-pointer transition-opacity hover:opacity-80"
						/>
					{/each}
				</Pie>
			</Svg>
			<ChartTooltip>
				{#snippet formatter({ value, name })}
					<div class="flex w-full items-center justify-between">
						<span class="text-muted-foreground">{name}</span>
						<span class="font-mono font-medium">{value}</span>
					</div>
					<div class="text-xs text-muted-foreground">
						{totalAlerts > 0 ? (((value as number) / totalAlerts) * 100).toFixed(1) : '0.0'}% of
						total
					</div>
				{/snippet}
			</ChartTooltip>
		</Chart>
	</ChartContainer>

	<!-- Legend -->
	<div class="mt-4 flex flex-wrap justify-center gap-4 text-sm">
		{#each chartData as item (item.label)}
			<div class="flex items-center gap-2">
				<div class="h-3 w-3 rounded-sm" style="background-color: {item.fill}"></div>
				<span class="font-medium">{item.label}</span>
				<span class="text-muted-foreground">({item.value})</span>
			</div>
		{/each}
	</div>
{:else}
	<div class="flex h-[200px] items-center justify-center text-center">
		<div>
			<p class="text-sm text-muted-foreground">No alerts to display</p>
		</div>
	</div>
{/if}
