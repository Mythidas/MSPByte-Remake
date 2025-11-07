<script lang="ts">
	import { Chart, Svg, Pie, Arc } from 'layerchart';
	import { ChartContainer, ChartTooltip, type ChartConfig } from '$lib/components/ui/chart';

	type Props = {
		totalSites: number;
		activeSites: number;
	};

	let { totalSites = 0, activeSites = 0 }: Props = $props();

	// Prepare data for the chart
	const chartData = $derived(
		[
			{ label: 'Active', value: activeSites, fill: 'hsl(var(--chart-1))' },
			{ label: 'Inactive', value: totalSites - activeSites, fill: 'hsl(var(--chart-3))' }
		].filter((item) => item.value > 0)
	); // Only show segments with data

	const chartConfig: ChartConfig = {
		active: {
			label: 'Active Sites',
			color: 'hsl(var(--chart-1))'
		},
		inactive: {
			label: 'Inactive Sites',
			color: 'hsl(var(--chart-3))'
		}
	};

	const hasData = $derived(totalSites > 0);
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
						<Arc {arc} fill={arc.data.fill} stroke="hsl(var(--background))" strokeWidth={2} />
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
						{totalSites > 0 ? (((value as number) / totalSites) * 100).toFixed(1) : '0.0'}% of total
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
			<p class="text-sm text-muted-foreground">No sites to display</p>
		</div>
	</div>
{/if}
