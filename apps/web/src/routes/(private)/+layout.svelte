<script lang="ts">
	import { Binary, LayoutDashboard, Users, Shield, Settings, Building, Bolt } from 'lucide-svelte';
	import Navbar from '$lib/components/nav/Navbar.svelte';
	import NavLink from '$lib/components/nav/NavLink.svelte';
	import NavGroup from '$lib/components/nav/NavGroup.svelte';

	let { children } = $props();
</script>

<div class="flex size-full">
	<div class="flex h-full w-1/12 min-w-48 flex-col justify-between py-2 pl-2">
		<!--Content-->
		<div class="flex h-full flex-col gap-2">
			<!--Header-->
			<div class="flex items-center gap-2 p-2 text-2xl font-semibold">
				<Binary class="rounded border" />
				<span>MSPByte</span>
			</div>

			<hr class="hr" />

			<!--Nav-->
			<Navbar>
				<NavLink href="/" label="Dashboard" icon={LayoutDashboard} />
				<NavLink href="/sites" label="Sites" icon={Building} />

				<NavGroup name="Admin" icon={Settings}>
					<NavLink href="/users" label="Users" icon={Users} />
					<NavLink href="/roles" label="Roles" icon={Shield} />
					<NavLink href="/integrations" label="Integrations" icon={Bolt} />
				</NavGroup>
			</Navbar>
		</div>

		<!--Footer-->
		<div class="flex h-fit flex-col items-center gap-2">
			<span class="text-sm">[v0.0.1]</span>
		</div>
	</div>

	<!-- Main content -->
	<main class="flex size-full flex-col p-2">
		<div class="flex size-full flex-col overflow-hidden rounded bg-card/70 p-4 shadow">
			{@render children?.()}
		</div>
	</main>
</div>
