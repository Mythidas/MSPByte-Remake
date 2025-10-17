<script lang="ts">
	interface Props {
		features: string[];
	}

	let { features }: Props = $props();
</script>

<ul class="grid gap-2 sm:grid-cols-2">
	{#each features as feature}
		<li class="flex items-start gap-2">
			<svg
				class="mt-0.5 h-5 w-5 shrink-0 text-primary"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M5 13l4 4L19 7"
				></path>
			</svg>
			<span class="text-sm">{feature}</span>
		</li>
	{/each}
</ul>
