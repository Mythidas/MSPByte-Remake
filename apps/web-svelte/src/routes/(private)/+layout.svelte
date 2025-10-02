<script lang="ts">
	import { Binary, LayoutDashboard, Users, Shield, Settings } from 'lucide-svelte';
	import NavLink from '$lib/components/NavLink.svelte';
	import NavGroup from '$lib/components/NavGroup.svelte';

	let { children } = $props();
</script>

<div class="flex size-full">
	<div class="flex h-full w-1/12 min-w-48 flex-col justify-between py-2 pl-2">
		<!--Content-->
		<div class="flex h-full flex-col gap-2">
			<!--Header-->
			<div class="flex justify-center gap-2 pt-2 text-xl font-semibold">
				<Binary class="rounded border" />
				<span>MSPByte</span>
			</div>

			<hr class="hr" />

			<!--Nav-->
			<nav class="flex size-full flex-col items-center gap-1">
				<NavLink href="/" label="Dashboard" icon={LayoutDashboard} />

				<NavGroup name="Admin" icon={Settings}>
					<NavLink href="/users" label="Users" icon={Users} />
					<NavLink href="/roles" label="Roles" icon={Shield} />
				</NavGroup>
			</nav>
		</div>

		<!--Footer-->
		<div class="flex h-fit flex-col items-center gap-2">
			<hr class="hr" />
			<span>[v0.0.1]</span>
		</div>
	</div>

	<!-- Main content -->
	<main class="flex-1 p-2">
		<div class="flex size-full flex-col overflow-auto rounded bg-surface-100-900 p-4 shadow">
			{@render children?.()}
		</div>
	</main>
</div>
