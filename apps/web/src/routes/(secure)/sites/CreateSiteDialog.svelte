<script lang="ts">
	import SubmitButton from '$lib/components/SubmitButton.svelte';
	import { buttonVariants } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Plus } from 'lucide-svelte';
</script>

<Dialog.Root>
	<Dialog.Trigger class={buttonVariants({ variant: 'default' })}>
		<Plus /> Create Site
	</Dialog.Trigger>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Create Site</Dialog.Title>
			<Dialog.Description>
				Manually create a site and link to a PSA later through Integrations
			</Dialog.Description>
		</Dialog.Header>

		<Dialog.Footer>
			<Dialog.Close class={buttonVariants({ variant: 'destructive' })}>Close</Dialog.Close>
			<SubmitButton>Save</SubmitButton>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
