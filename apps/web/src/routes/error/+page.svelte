<script lang="ts">
	import { ServerCrash } from 'lucide-svelte';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';

	let { data } = $props();
</script>

<div class="flex size-full items-center justify-center bg-background">
	<Card.Card class="w-full max-w-2xl">
		<Card.Header class="text-center">
			<Card.Title class="flex items-center justify-center gap-4 text-3xl font-bold">
				Oops! Something went wrong
			</Card.Title>
			<Card.Description class="text-lg">
				We encountered an error while loading your data. Don't worry, our team has been notified.
			</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
				<h3 class="mb-2 font-semibold text-destructive">Error Details:</h3>
				<p class="font-mono text-sm break-words text-muted-foreground">
					{data.error}
				</p>
			</div>

			<div class="grid grid-cols-2 gap-2">
				<Button href="/home">Return to Dashboard</Button>
				<Button href="/" variant="outline">Go to Home</Button>
			</div>
		</Card.Content>
		<Card.Footer class="justify-center text-center text-sm text-muted-foreground">
			<p>If this problem persists, please contact support with the error details above.</p>
		</Card.Footer>
	</Card.Card>
</div>
