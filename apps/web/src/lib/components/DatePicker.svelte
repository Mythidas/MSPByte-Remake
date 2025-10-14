<script lang="ts">
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import {
		type DateValue,
		CalendarDate,
		DateFormatter,
		getLocalTimeZone
	} from '@internationalized/date';
	import { cn } from '$lib/utils.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Calendar } from '$lib/components/ui/calendar/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';

	type Props = {
		value: number | undefined;
		defaultValue?: number;
	};

	let { value = $bindable(), defaultValue }: Props = $props();
	let internal: DateValue | undefined = $state(undefined);

	const df = new DateFormatter('en-US', {
		dateStyle: 'long'
	});

	$effect(() => {
		if (!defaultValue) return;

		const jsDate = new Date(defaultValue);
		internal = new CalendarDate(jsDate.getFullYear(), jsDate.getMonth() + 1, jsDate.getDate());
	});

	$effect(() => {
		if (internal) value = internal.toDate(getLocalTimeZone()).getTime();
	});
</script>

<Popover.Root>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button
				variant="outline"
				class={cn(
					'w-[280px] justify-start text-left font-normal',
					!value && 'text-muted-foreground'
				)}
				{...props}
			>
				<CalendarIcon class="mr-2 size-4" />
				{internal ? df.format(internal.toDate(getLocalTimeZone())) : 'Select a date'}
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-auto p-0">
		<Calendar bind:value={internal} type="single" initialFocus captionLayout="dropdown" />
	</Popover.Content>
</Popover.Root>
