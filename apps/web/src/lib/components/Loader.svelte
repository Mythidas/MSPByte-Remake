<script lang="ts">
	import { cn } from "$lib/utils";

	interface Props {
		size?: "sm" | "md" | "lg" | "xl";
		variant?: "spinner" | "dots" | "pulse" | "bars";
		class?: string;
		text?: string;
	}

	let { size = "md", variant = "spinner", class: className, text }: Props = $props();

	const sizeClasses = {
		sm: "w-4 h-4",
		md: "w-8 h-8",
		lg: "w-12 h-12",
		xl: "w-16 h-16",
	};

	const dotSizes = {
		sm: "w-1.5 h-1.5",
		md: "w-2.5 h-2.5",
		lg: "w-3.5 h-3.5",
		xl: "w-5 h-5",
	};

	const barSizes = {
		sm: "w-1 h-3",
		md: "w-1.5 h-5",
		lg: "w-2 h-7",
		xl: "w-3 h-10",
	};
</script>

{#if variant === "spinner"}
	<div class={cn("flex flex-col items-center justify-center gap-3", className)}>
		<div class={cn("relative", sizeClasses[size])}>
			<div
				class="absolute inset-0 rounded-full border-4 border-primary/20"
			></div>
			<div
				class="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin"
			></div>
		</div>
		{#if text}
			<p class="text-sm text-muted-foreground animate-pulse">{text}</p>
		{/if}
	</div>
{:else if variant === "dots"}
	<div class={cn("flex flex-col items-center justify-center gap-3", className)}>
		<div class="flex items-center gap-2">
			<div
				class={cn(
					"rounded-full bg-primary animate-bounce",
					dotSizes[size]
				)}
				style="animation-delay: 0ms"
			></div>
			<div
				class={cn(
					"rounded-full bg-primary animate-bounce",
					dotSizes[size]
				)}
				style="animation-delay: 150ms"
			></div>
			<div
				class={cn(
					"rounded-full bg-primary animate-bounce",
					dotSizes[size]
				)}
				style="animation-delay: 300ms"
			></div>
		</div>
		{#if text}
			<p class="text-sm text-muted-foreground animate-pulse">{text}</p>
		{/if}
	</div>
{:else if variant === "pulse"}
	<div class={cn("flex flex-col items-center justify-center gap-3", className)}>
		<div class={cn("relative", sizeClasses[size])}>
			<div
				class="absolute inset-0 rounded-full bg-primary/30 animate-ping"
			></div>
			<div class="absolute inset-0 rounded-full bg-primary/50 animate-pulse"></div>
			<div class="absolute inset-0 rounded-full bg-primary scale-75"></div>
		</div>
		{#if text}
			<p class="text-sm text-muted-foreground animate-pulse">{text}</p>
		{/if}
	</div>
{:else if variant === "bars"}
	<div class={cn("flex flex-col items-center justify-center gap-3", className)}>
		<div class="flex items-end gap-1.5">
			<div
				class={cn(
					"bg-primary rounded-sm animate-pulse",
					barSizes[size]
				)}
				style="animation-delay: 0ms; animation-duration: 1s;"
			></div>
			<div
				class={cn(
					"bg-primary rounded-sm animate-pulse",
					barSizes[size]
				)}
				style="animation-delay: 150ms; animation-duration: 1s;"
			></div>
			<div
				class={cn(
					"bg-primary rounded-sm animate-pulse",
					barSizes[size]
				)}
				style="animation-delay: 300ms; animation-duration: 1s;"
			></div>
			<div
				class={cn(
					"bg-primary rounded-sm animate-pulse",
					barSizes[size]
				)}
				style="animation-delay: 150ms; animation-duration: 1s;"
			></div>
			<div
				class={cn(
					"bg-primary rounded-sm animate-pulse",
					barSizes[size]
				)}
				style="animation-delay: 0ms; animation-duration: 1s;"
			></div>
		</div>
		{#if text}
			<p class="text-sm text-muted-foreground animate-pulse">{text}</p>
		{/if}
	</div>
{/if}
