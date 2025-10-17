<script lang="ts">
	import { Binary, Shield, Database, Zap, GitBranch, Users, LogIn } from 'lucide-svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Badge } from '$lib/components/ui/badge';
	import ModeToggle from '$lib/components/ModeToggle.svelte';

	let { data } = $props();
</script>

<div class="flex h-full w-full flex-col overflow-auto">
	<!-- Navbar -->
	<nav class="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
		<div class="container mx-auto flex h-16 items-center justify-between px-4">
			<!-- Logo and Brand -->
			<div class="flex items-center gap-2">
				<Binary class="h-8 w-8 rounded border p-1" />
				<span class="text-xl font-semibold">MSPByte</span>
				<Badge variant="secondary" class="ml-2 text-xs">WIP</Badge>
			</div>

			<!-- Right side - User menu or Login -->
			<div class="flex items-center gap-3">
				<ModeToggle />

				{#if data.isAuthenticated && data.user}
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							<Button variant="outline" class="flex items-center gap-2">
								<div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
									{data.user.name[0].toUpperCase()}
								</div>
								<span class="hidden sm:inline">{data.user.name}</span>
							</Button>
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="end" class="w-48">
							<DropdownMenu.Label>
								<div class="flex flex-col">
									<span class="font-medium">{data.user.name}</span>
									<span class="text-xs text-muted-foreground">{data.user.email}</span>
								</div>
							</DropdownMenu.Label>
							<DropdownMenu.Separator />
							<DropdownMenu.Item>
								<a href="/home" class="block w-full">
									Dashboard
								</a>
							</DropdownMenu.Item>
							<DropdownMenu.Separator />
							<DropdownMenu.Item>
								<a href="/auth/logout" class="block w-full">
									Sign Out
								</a>
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				{:else}
					<Button href="/auth/login" variant="default">
						<LogIn class="mr-2 h-4 w-4" />
						Sign In
					</Button>
				{/if}
			</div>
		</div>
	</nav>

	<!-- Main Content -->
	<main class="flex-1">
		<!-- Hero Section -->
		<section class="container mx-auto px-4 py-16 md:py-24">
			<div class="mx-auto max-w-3xl text-center">
				<div class="mb-8 flex items-center justify-center gap-3">
					<Binary class="h-16 w-16 rounded-lg border-2 p-3" />
				</div>
				<h1 class="mb-4 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
					MSPByte
				</h1>
				<p class="mb-8 text-xl text-muted-foreground">
					The All-in-One Integration Platform for MSPs and Tech Administrators
				</p>
				<div class="mb-6 flex items-center justify-center gap-2">
					<Badge variant="outline" class="text-sm">
						Currently in Development
					</Badge>
				</div>
				<p class="mx-auto mb-8 max-w-2xl text-muted-foreground">
					A unified platform designed to streamline your managed service operations,
					integrate your tools, and provide comprehensive oversight of your infrastructure.
				</p>
				{#if !data.isAuthenticated}
					<div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
						<Button href="/auth/login" size="lg" class="gap-2">
							<LogIn class="h-4 w-4" />
							Get Started
						</Button>
					</div>
				{:else}
					<Button href="/home" size="lg">
						Go to Dashboard
					</Button>
				{/if}
			</div>
		</section>

		<!-- Features Section -->
		<section class="border-t bg-muted/30 py-16">
			<div class="container mx-auto px-4">
				<div class="mb-12 text-center">
					<h2 class="mb-3 text-3xl font-bold">Planned Features</h2>
					<p class="text-muted-foreground">Building a comprehensive platform for modern MSP operations</p>
				</div>

				<div class="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
					<!-- Feature 1 -->
					<div class="rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
						<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
							<GitBranch class="h-6 w-6 text-primary" />
						</div>
						<h3 class="mb-2 text-lg font-semibold">Unified Integrations</h3>
						<p class="text-sm text-muted-foreground">
							Connect all your MSP tools in one place. HaloPSA, Sophos, Microsoft 365, and more.
						</p>
					</div>

					<!-- Feature 2 -->
					<div class="rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
						<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
							<Database class="h-6 w-6 text-primary" />
						</div>
						<h3 class="mb-2 text-lg font-semibold">Centralized Data</h3>
						<p class="text-sm text-muted-foreground">
							Access all your client data, sites, and infrastructure information from a single dashboard.
						</p>
					</div>

					<!-- Feature 3 -->
					<div class="rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
						<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
							<Shield class="h-6 w-6 text-primary" />
						</div>
						<h3 class="mb-2 text-lg font-semibold">Security Management</h3>
						<p class="text-sm text-muted-foreground">
							Monitor security across all clients with integrated threat detection and compliance tracking.
						</p>
					</div>

					<!-- Feature 4 -->
					<div class="rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
						<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
							<Zap class="h-6 w-6 text-primary" />
						</div>
						<h3 class="mb-2 text-lg font-semibold">Automated Workflows</h3>
						<p class="text-sm text-muted-foreground">
							Streamline repetitive tasks with intelligent automation and synchronization.
						</p>
					</div>

					<!-- Feature 5 -->
					<div class="rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
						<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
							<Users class="h-6 w-6 text-primary" />
						</div>
						<h3 class="mb-2 text-lg font-semibold">User Management</h3>
						<p class="text-sm text-muted-foreground">
							Comprehensive role-based access control and user administration across your organization.
						</p>
					</div>

					<!-- Feature 6 -->
					<div class="rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
						<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
							<Binary class="h-6 w-6 text-primary" />
						</div>
						<h3 class="mb-2 text-lg font-semibold">Site Mapping</h3>
						<p class="text-sm text-muted-foreground">
							Intelligent site mapping across different platforms to keep your data synchronized.
						</p>
					</div>
				</div>
			</div>
		</section>

		<!-- Footer -->
		<footer class="border-t py-8">
			<div class="container mx-auto px-4">
				<div class="flex flex-col items-center justify-between gap-4 sm:flex-row">
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<Binary class="h-4 w-4" />
						<span>MSPByte v0.0.1</span>
					</div>
					<p class="text-sm text-muted-foreground">
						Work in Progress - Coming Soon
					</p>
				</div>
			</div>
		</footer>
	</main>
</div>
