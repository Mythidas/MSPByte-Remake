<script lang="ts">
	import type { TableView } from './types.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Eye, X } from 'lucide-svelte';

	type Props = {
		views: TableView[];
		activeView?: TableView;
		onSelectView: (viewName: string) => void;
		onClearView: () => void;
	};

	let { views, activeView, onSelectView, onClearView }: Props = $props();

	// No views provided
	if (views.length === 0) {
		// Don't render anything
	}
</script>

{#if views.length > 0}
	<div class="flex items-center gap-2">
		{#if activeView}
			<Badge variant="default" class="flex items-center gap-2 pr-1">
				<Eye class="h-3 w-3" />
				<span class="text-xs font-medium">{activeView.label}</span>
				<button
					type="button"
					onclick={onClearView}
					class="rounded-full p-0.5 hover:bg-primary-foreground/20"
					aria-label="Clear view"
				>
					<X class="h-3 w-3" />
				</button>
			</Badge>
		{:else}
			<Select.Root
				type="single"
				value={activeView?.name || ''}
				onValueChange={(val) => {
					if (val) onSelectView(val);
				}}
			>
				<Select.Trigger class="w-[180px]">
					<Eye class="mr-2 h-4 w-4" />
					{activeView?.label || 'Select View'}
				</Select.Trigger>
				<Select.Content>
					{#each views as view}
						<Select.Item value={view.name}>
							<div class="flex flex-col">
								<span class="font-medium">{view.label}</span>
								{#if view.description}
									<span class="text-xs text-muted-foreground">{view.description}</span>
								{/if}
							</div>
						</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		{/if}
	</div>
{/if}
