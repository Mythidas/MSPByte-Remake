<script lang="ts">
	import type { TableFilter } from './types.js';
	import { getOperatorLabel } from './types.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { X } from 'lucide-svelte';
	import { cn } from '$lib/utils.js';

	type Props = {
		filter: TableFilter;
		onRemove: () => void;
		class?: string;
	};

	let { filter, onRemove, class: className }: Props = $props();

	// Format value for display
	function formatValue(value: any): string {
		if (Array.isArray(value)) {
			return value.join(', ');
		}
		if (typeof value === 'boolean') {
			return value ? 'true' : 'false';
		}
		if (value === null || value === undefined) {
			return 'empty';
		}
		return String(value);
	}
</script>

<Badge variant="secondary" class={cn('flex items-center gap-2 pr-1', className)}>
	<span class="text-xs">
		<span class="font-semibold">{filter.field}</span>
		<span class="text-muted-foreground">{getOperatorLabel(filter.operator)}</span>
		<span class="font-medium">{formatValue(filter.value)}</span>
	</span>
	<button
		type="button"
		onclick={onRemove}
		class="rounded-full p-0.5 hover:bg-muted-foreground/20"
		aria-label="Remove filter"
	>
		<X class="h-3 w-3" />
	</button>
</Badge>
