<script lang="ts">
	import { Chart, Svg, Pie, Arc } from 'layerchart';
	import { ChartContainer, ChartTooltip, type ChartConfig } from '$lib/components/ui/chart';

	type Props = {
		online: number;
		offline: number;
		unknown: number;
	};

	let { online = 0, offline = 0, unknown = 0 }: Props = $props();

	// Prepare data for the chart
	const chartData = $derived(
		[
			{ label: 'Online', value: online, color: 'rgb(34, 197, 94)', status: 'online' as const },
			{ label: 'Offline', value: offline, color: 'rgb(107, 114, 128)', status: 'offline' as const },
			{ label: 'Unknown', value: unknown, color: 'rgb(148, 163, 184)', status: 'unknown' as const }
		].filter((item) => item.value > 0)
	); // Only show segments with data

	const chartConfig: ChartConfig = {
		online: {
			label: 'Online',
			color: 'rgb(34, 197, 94)'
		},
		offline: {
			label: 'Offline',
			color: 'rgb(107, 114, 128)'
		},
		unknown: {
			label: 'Unknown',
			color: 'rgb(148, 163, 184)'
		}
	};

	const totalAgents = $derived(online + offline + unknown);
	const hasData = $derived(totalAgents > 0);
	const uptimePercentage = $derived(
		totalAgents > 0 ? ((online / totalAgents) * 100).toFixed(1) : '0.0'
	);
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
				<!-- Donut chart with innerRadius -->
				<Pie innerRadius={0.6} let:arcs>
					{#each arcs as arc (arc.data.label)}
						<Arc
							{arc}
							fill={arc.data.color}
							stroke="white"
							strokeWidth={2}
							class="transition-opacity hover:opacity-80"
						/>
					{/each}
				</Pie>

				<!-- Center text showing uptime -->
				<text
					x="50%"
					y="50%"
					text-anchor="middle"
					dominant-baseline="middle"
					class="fill-current text-2xl font-bold"
				>
					{uptimePercentage}%
				</text>
				<text
					x="50%"
					y="50%"
					dy="1.5em"
					text-anchor="middle"
					dominant-baseline="middle"
					class="fill-current text-xs text-muted-foreground"
				>
					Uptime
				</text>
			</Svg>
			<ChartTooltip>
				{#snippet formatter({ value, name })}
					<div class="flex w-full items-center justify-between">
						<span class="text-muted-foreground">{name}</span>
						<span class="font-mono font-medium">{value}</span>
					</div>
					<div class="text-xs text-muted-foreground">
						{totalAgents > 0 ? (((value as number) / totalAgents) * 100).toFixed(1) : '0.0'}% of
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
				<div class="h-3 w-3 rounded-sm" style="background-color: {item.color}"></div>
				<span class="font-medium">{item.label}</span>
				<span class="text-muted-foreground">({item.value})</span>
			</div>
		{/each}
	</div>
{:else}
	<div class="flex h-[200px] items-center justify-center text-center">
		<div>
			<p class="text-sm text-muted-foreground">No agents to display</p>
		</div>
	</div>
{/if}
