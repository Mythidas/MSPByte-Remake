<script lang="ts">
	import { api, type Doc } from '$lib/convex';
	import { useConvexClient } from 'convex-svelte';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { prettyText } from '@workspace/shared/lib/utils.js';
	import {
		type Identity,
		type Role,
		type Group,
		type License
	} from '@workspace/database/convex/types/normalized.js';
	import {
		User,
		Mail,
		Calendar,
		Shield,
		Users,
		Key,
		AlertTriangle,
		CheckCircle,
		XCircle,
		AlertCircle,
		Clock,
		Zap,
		Lock,
		Ban,
		ShieldAlert,
		ExternalLink
	} from 'lucide-svelte';

	let {
		identity,
		open = $bindable(false),
		onClose
	}: {
		identity: Doc<'entities'> | null;
		open?: boolean;
		onClose?: () => void;
	} = $props();

	const client = useConvexClient();

	// Local state for fetched data
	let isLoading = $state(false);
	let activeAlerts = $state<Doc<'entity_alerts'>[]>([]);
	let assignedRoles = $state<any[]>([]);
	let assignedGroups = $state<any[]>([]);
	let assignedLicenses = $state<any[]>([]);

	// Derived state
	const identityData = $derived(identity?.normalizedData as Identity | null);

	// Lazy load data when sheet opens
	$effect(() => {
		if (open && identity?._id) {
			loadSheetData();
		}
	});

	async function loadSheetData() {
		if (!identity?._id) return;

		isLoading = true;
		try {
			// Fetch relationships
			const relationships = (await client.query(api.helpers.orm.list, {
				tableName: 'entity_relationships' as const,
				filters: {
					childEntityId: identity._id
				}
			})) as Doc<'entity_relationships'>[];

			// Fetch active alerts
			const alerts = (await client.query(api.helpers.orm.list, {
				tableName: 'entity_alerts' as const,
				filters: {
					entityId: identity._id,
					status: 'active'
				}
			})) as Doc<'entity_alerts'>[];
			activeAlerts = alerts;

			// Extract IDs from relationships
			const roleIds = relationships
				.filter((r) => r.relationshipType === 'assigned_role')
				.map((r) => r.parentEntityId);

			const groupIds = relationships
				.filter((r) => r.relationshipType === 'member_of')
				.map((r) => r.parentEntityId);

			// Fetch roles by ID (only the ones assigned)
			if (roleIds.length > 0) {
				const roles = (await client.query(api.helpers.orm.list, {
					tableName: 'entities' as const,
					filters: {
						_id: { in: roleIds }
					}
				})) as Doc<'entities'>[];

				assignedRoles = relationships
					.filter((r) => r.relationshipType === 'assigned_role')
					.map((rel) => {
						const role = roles.find((r) => r._id === rel.parentEntityId);
						return role ? { ...rel, entity: role, name: (role.normalizedData as Role).name } : null;
					})
					.filter((r) => r !== null);
			} else {
				assignedRoles = [];
			}

			// Fetch groups by ID (only the ones assigned)
			if (groupIds.length > 0) {
				const groups = (await client.query(api.helpers.orm.list, {
					tableName: 'entities' as const,
					filters: {
						_id: { in: groupIds }
					}
				})) as Doc<'entities'>[];

				assignedGroups = relationships
					.filter((r) => r.relationshipType === 'member_of')
					.map((rel) => {
						const group = groups.find((g) => g._id === rel.parentEntityId);
						return group
							? { ...rel, entity: group, name: (group.normalizedData as Group).name }
							: null;
					})
					.filter((g) => g !== null);
			} else {
				assignedGroups = [];
			}

			// Fetch licenses by SKU IDs (only the ones assigned)
			const licenseSkuIds = identityData?.licenses || [];
			if (licenseSkuIds.length > 0) {
				// Query licenses by external ID
				const licenses = (await client.query(api.helpers.orm.list, {
					tableName: 'entities' as const,
					index: {
						name: 'by_data_source_type',
						params: {
							dataSourceId: identity.dataSourceId,
							entityType: 'licenses'
						}
					}
				})) as Doc<'entities'>[];

				assignedLicenses = licenseSkuIds.map((skuId) => {
					const license = licenses.find((l) => {
						const licenseData = l.normalizedData as License;
						return licenseData.externalId === skuId;
					});
					return {
						skuId,
						entity: license || null,
						name: license ? (license.normalizedData as License).name : skuId
					};
				});
			} else {
				assignedLicenses = [];
			}
		} catch (error) {
			console.error('Failed to load sheet data:', error);
		} finally {
			isLoading = false;
		}
	}

	// Helper functions
	function getStateIcon(state: string) {
		switch (state) {
			case 'critical':
				return XCircle;
			case 'warn':
				return AlertCircle;
			case 'normal':
				return CheckCircle;
			default:
				return AlertCircle;
		}
	}

	function getStateColor(state: string) {
		switch (state) {
			case 'critical':
				return 'text-destructive';
			case 'warn':
				return 'text-amber-500';
			case 'normal':
				return 'text-chart-1';
			default:
				return 'text-muted-foreground';
		}
	}

	function getSeverityVariant(severity: string) {
		switch (severity) {
			case 'critical':
				return 'destructive';
			case 'high':
				return 'default';
			case 'medium':
				return 'secondary';
			case 'low':
				return 'outline';
			default:
				return 'outline';
		}
	}

	function formatAlertType(type: string) {
		return type
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	function handleClose() {
		open = false;
		onClose?.();
	}
</script>

{#if identity && identityData}
	<Sheet.Root bind:open onOpenChange={(isOpen) => !isOpen && handleClose()}>
		<Sheet.Content side="right" class="w-full overflow-y-auto pt-6 sm:max-w-[700px]">
			<Sheet.Header>
				<div class="flex items-start gap-3">
					<svelte:component
						this={getStateIcon(identityData.state || 'normal')}
						class={`h-6 w-6 ${getStateColor(identityData.state || 'normal')}`}
					/>
					<div class="flex-1">
						<Sheet.Title class="text-xl">{identityData.name}</Sheet.Title>
						<div class="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
							<Mail class="h-3 w-3" />
							<span>{identityData.email}</span>
						</div>
						<div class="mt-2 flex flex-wrap gap-1">
							{#if identityData.enabled}
								<Badge variant="outline" class="text-xs">
									<CheckCircle class="mr-1 h-3 w-3" />
									Active
								</Badge>
							{:else}
								<Badge variant="secondary" class="text-xs">
									<XCircle class="mr-1 h-3 w-3" />
									Inactive
								</Badge>
							{/if}
							<Badge variant="outline" class="text-xs capitalize">{identityData.type}</Badge>
							{#each identityData.tags || [] as tag}
								{#if tag === 'MFA'}
									<Badge variant="default" class="bg-chart-1 text-xs">
										<Shield class="mr-1 h-3 w-3" />
										MFA
									</Badge>
								{:else if tag === 'Admin'}
									<Badge variant="destructive" class="text-xs">
										<Lock class="mr-1 h-3 w-3" />
										Admin
									</Badge>
								{:else if tag === 'Stale'}
									<Badge variant="secondary" class="text-xs">
										<Clock class="mr-1 h-3 w-3" />
										Stale
									</Badge>
								{:else if tag === 'Guest'}
									<Badge variant="outline" class="text-xs">
										<User class="mr-1 h-3 w-3" />
										Guest
									</Badge>
								{:else if tag === 'Service'}
									<Badge variant="outline" class="text-xs">
										<Zap class="mr-1 h-3 w-3" />
										Service
									</Badge>
								{:else}
									<Badge variant="outline" class="text-xs">{tag}</Badge>
								{/if}
							{/each}
						</div>
					</div>
				</div>
			</Sheet.Header>

			<div class="space-y-4 overflow-y-auto p-6">
				<!-- Identity Overview -->
				<div class="space-y-4">
					<h3 class="text-sm font-semibold">Identity Overview</h3>
					<div class="grid grid-cols-2 gap-4">
						<div>
							<p class="text-muted-foreground text-xs">User Type</p>
							<p class="text-sm font-medium capitalize">{identityData.type}</p>
						</div>
						<div>
							<p class="text-muted-foreground text-xs">Account Status</p>
							<p class="text-sm font-medium">
								{identityData.enabled ? 'Active' : 'Inactive'}
							</p>
						</div>
						<div>
							<p class="text-muted-foreground text-xs">Security State</p>
							<p class="text-sm font-medium capitalize">{identityData.state || 'normal'}</p>
						</div>
						<div>
							<p class="text-muted-foreground text-xs">Last Login</p>
							<p class="text-sm font-medium">
								{identityData.last_login_at &&
								identityData.last_login_at !== new Date(0).toISOString()
									? new Date(identityData.last_login_at).toLocaleString()
									: 'Never'}
							</p>
						</div>
						<div>
							<p class="text-muted-foreground text-xs">External ID</p>
							<p class="font-mono text-sm text-xs font-medium">{identityData.external_id}</p>
						</div>
						<div>
							<p class="text-muted-foreground text-xs">Licenses</p>
							<p class="text-sm font-medium">{identityData.licenses?.length || 0}</p>
						</div>
					</div>
					{#if identityData.aliases && identityData.aliases.length > 0}
						<div>
							<p class="text-muted-foreground text-xs">Email Aliases</p>
							<div class="mt-1 flex flex-wrap gap-1">
								{#each identityData.aliases as alias}
									<Badge variant="outline" class="text-xs">{alias}</Badge>
								{/each}
							</div>
						</div>
					{/if}
				</div>

				<Separator />

				<!-- Assigned Roles -->
				<div class="space-y-3">
					<div class="flex items-center gap-2">
						<Shield class="text-muted-foreground h-4 w-4" />
						<h3 class="text-sm font-semibold">Assigned Roles</h3>
						<Badge variant="secondary" class="ml-auto text-xs">{assignedRoles.length}</Badge>
					</div>
					{#if assignedRoles.length > 0}
						<div class="space-y-2">
							{#each assignedRoles as role}
								<Card.Root>
									<Card.Content class="px-4 py-0">
										<div class="flex items-start justify-between gap-2">
											<div class="flex-1">
												<p class="text-sm font-medium">{role.name}</p>
												<p class="text-muted-foreground text-xs">
													{(role.entity.normalizedData as Role).description ||
														'Administrative role'}
												</p>
											</div>
											<Badge variant="destructive" class="text-xs">Admin</Badge>
										</div>
									</Card.Content>
								</Card.Root>
							{/each}
						</div>
					{:else}
						<div
							class="flex flex-col items-center justify-center rounded-lg border border-dashed p-4 text-center"
						>
							<Shield class="text-muted-foreground mb-2 h-8 w-8" />
							<p class="text-muted-foreground text-sm">No roles assigned</p>
						</div>
					{/if}
				</div>

				<Separator />

				<!-- Group Memberships -->
				<div class="space-y-3">
					<div class="flex items-center gap-2">
						<Users class="text-muted-foreground h-4 w-4" />
						<h3 class="text-sm font-semibold">Group Memberships</h3>
						<Badge variant="secondary" class="ml-auto text-xs">
							{assignedGroups.length}
						</Badge>
					</div>
					{#if assignedGroups.length > 0}
						<div class="space-y-2">
							{#each assignedGroups as group}
								{@const groupData = group.entity.normalizedData as Group}
								<Card.Root>
									<Card.Content class="px-4 py-0">
										<div class="flex items-start justify-between gap-2">
											<div class="flex-1">
												<p class="text-sm font-medium">{group.name}</p>
												<p class="text-muted-foreground text-xs">
													{groupData.description || 'Group membership'}
												</p>
											</div>
											<Badge variant="outline" class="text-xs capitalize">
												{groupData.type || 'Member'}
											</Badge>
										</div>
									</Card.Content>
								</Card.Root>
							{/each}
						</div>
					{:else}
						<div
							class="flex flex-col items-center justify-center rounded-lg border border-dashed p-4 text-center"
						>
							<Users class="text-muted-foreground mb-2 h-8 w-8" />
							<p class="text-muted-foreground text-sm">Not a member of any groups</p>
						</div>
					{/if}
				</div>

				<Separator />

				<!-- Licenses -->
				<div class="space-y-3">
					<div class="flex items-center gap-2">
						<Key class="text-muted-foreground h-4 w-4" />
						<h3 class="text-sm font-semibold">Licenses</h3>
						<Badge variant="secondary" class="ml-auto text-xs">
							{assignedLicenses.length}
						</Badge>
					</div>
					{#if assignedLicenses.length > 0}
						<div class="space-y-2">
							{#each assignedLicenses as license}
								<Card.Root>
									<Card.Content class="px-4 py-0">
										<div class="flex items-start justify-between gap-2">
											<div class="flex-1">
												<p class="text-sm font-medium">{license.name}</p>
												<p class="text-muted-foreground font-mono text-xs">{license.skuId}</p>
											</div>
											<Badge variant="outline" class="text-xs">Assigned</Badge>
										</div>
									</Card.Content>
								</Card.Root>
							{/each}
						</div>
					{:else}
						<div
							class="flex flex-col items-center justify-center rounded-lg border border-dashed p-4 text-center"
						>
							<Key class="text-muted-foreground mb-2 h-8 w-8" />
							<p class="text-muted-foreground text-sm">No licenses assigned</p>
						</div>
					{/if}
				</div>

				<Separator />

				<!-- Active Alerts -->
				<div class="space-y-3">
					<div class="flex items-center gap-2">
						<AlertTriangle class="text-muted-foreground h-4 w-4" />
						<h3 class="text-sm font-semibold">Active Alerts</h3>
						<Badge variant="secondary" class="ml-auto text-xs">{activeAlerts.length}</Badge>
					</div>
					{#if activeAlerts.length > 0}
						<div class="space-y-2">
							{#each activeAlerts as alert}
								<Card.Root>
									<Card.Content class="px-4 py-0">
										<div class="flex items-start gap-3">
											<div class="flex-1">
												<div class="flex items-center gap-2">
													<Badge variant={getSeverityVariant(alert.severity)} class="text-xs">
														{prettyText(alert.severity)}
													</Badge>
													<p class="text-sm font-medium">{formatAlertType(alert.alertType)}</p>
												</div>
												<p class="text-muted-foreground mt-1 text-xs">{alert.message}</p>
												<div class="text-muted-foreground mt-2 flex items-center gap-1 text-xs">
													<Calendar class="h-3 w-3" />
													<span>{new Date(alert._creationTime).toLocaleString()}</span>
												</div>
											</div>
										</div>
									</Card.Content>
								</Card.Root>
							{/each}
						</div>
					{:else}
						<div
							class="flex flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center"
						>
							<CheckCircle class="text-chart-1 mb-2 h-8 w-8" />
							<p class="text-sm font-medium">No active alerts</p>
							<p class="text-muted-foreground text-xs">
								This identity has a clean security posture
							</p>
						</div>
					{/if}
				</div>

				<Separator />

				<!-- Quick Actions -->
				<div class="space-y-3">
					<h3 class="text-sm font-semibold">Quick Actions</h3>
					<div class="grid grid-cols-2 gap-2">
						<Button variant="outline" size="sm" disabled class="text-xs">
							<Ban class="mr-2 h-3 w-3" />
							Disable User
						</Button>
						<Button variant="outline" size="sm" disabled class="text-xs">
							<ShieldAlert class="mr-2 h-3 w-3" />
							Enforce MFA
						</Button>
						<Button variant="outline" size="sm" disabled class="text-xs">
							<Key class="mr-2 h-3 w-3" />
							Reset Password
						</Button>
						<Button variant="outline" size="sm" disabled class="text-xs">
							<ExternalLink class="mr-2 h-3 w-3" />
							View in Azure
						</Button>
					</div>
					<p class="text-muted-foreground text-xs">Quick actions coming soon</p>
				</div>
			</div>

			<Sheet.Footer>
				<Button onclick={handleClose} variant="default" class="w-full">Close</Button>
			</Sheet.Footer>
		</Sheet.Content>
	</Sheet.Root>
{/if}
