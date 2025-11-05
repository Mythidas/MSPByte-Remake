<script lang="ts">
	import { api, type Doc } from '$lib/convex';
	import { useQuery } from 'convex-svelte';
	import { getAppState } from '$lib/state/Application.svelte.js';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import { type DataTableCell, type TableView } from '$lib/components/table/types.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { type Identity } from '@workspace/database/convex/types/normalized.js';
	import { CircleCheck, CircleX, CircleAlert, ShieldAlert, Ban, Clock, Lock, AlertCircle } from 'lucide-svelte';

	const { dataSourceId }: { dataSourceId: string } = $props();
	const appState = getAppState();

	let filters = $state<any>(undefined);

	// Predefined identity views
	const identityViews: TableView[] = [
		{
			name: 'no-mfa',
			label: 'Users without MFA',
			description: 'Members without Multi-Factor Authentication enabled',
			icon: ShieldAlert,
			filters: [
				{ field: 'normalizedData.tags', operator: 'nin', value: ['MFA'] },
				{ field: 'normalizedData.type', operator: 'eq', value: 'member' },
				{ field: 'normalizedData.enabled', operator: 'eq', value: true }
			]
		},
		{
			name: 'admins',
			label: 'Admin Users',
			description: 'Users with administrative privileges',
			icon: Lock,
			filters: [{ field: 'normalizedData.tags', operator: 'in', value: ['Admin'] }]
		},
		{
			name: 'stale',
			label: 'Stale Accounts',
			description: 'Users with inactive accounts not accessed recently',
			icon: Clock,
			filters: [
				{ field: 'normalizedData.tags', operator: 'in', value: ['Stale'] },
				{ field: 'normalizedData.enabled', operator: 'eq', value: true }
			]
		},
		{
			name: 'disabled',
			label: 'Disabled Accounts',
			description: 'Inactive user accounts',
			icon: Ban,
			filters: [{ field: 'normalizedData.enabled', operator: 'eq', value: false }]
		},
		{
			name: 'critical',
			label: 'Critical State',
			description: 'Users with critical security issues requiring attention',
			icon: AlertCircle,
			filters: [{ field: 'normalizedData.state', operator: 'eq', value: 'critical' }]
		}
	];

	const identitiesQuery = useQuery(api.helpers.orm.list, () => ({
		tableName: 'entities' as const,
		filters: filters,
		index: {
			name: 'by_site_type',
			params: {
				siteId: appState.getSite()?._id!,
				entityType: 'identities'
			}
		}
	}));
</script>

{#snippet stateSnip({ row }: DataTableCell<Doc<'entities'>>)}
	{@const identity = row.normalizedData as Identity}
	{@const state = identity.state || 'normal'}

	{#if state === 'normal'}
		<CircleCheck class="text-chart-1 h-4 w-4" />
	{:else if state === 'critical'}
		<CircleX class="text-destructive h-4 w-4" />
	{:else}
		<CircleAlert class="h-4 w-4 text-amber-500" />
	{/if}
{/snippet}

{#snippet tagsSnip({ row }: DataTableCell<Doc<'entities'>>)}
	{@const identity = row.normalizedData as Identity}
	{@const tags = identity.tags || []}
	<div class="flex flex-wrap gap-1">
		{#each tags as tag}
			{#if tag === 'MFA'}
				<Badge variant="default" class="bg-chart-1 text-xs">MFA</Badge>
			{:else if tag === 'Admin'}
				<Badge variant="destructive" class="text-xs">Admin</Badge>
			{:else if tag === 'Stale'}
				<Badge variant="secondary" class="text-xs">Stale</Badge>
			{:else if tag === 'Guest'}
				<Badge variant="outline" class="text-xs">Guest</Badge>
			{:else}
				<Badge variant="outline" class="text-xs">{tag}</Badge>
			{/if}
		{/each}
	</div>
{/snippet}

<DataTable
	rows={identitiesQuery.data || []}
	isLoading={identitiesQuery.isLoading}
	bind:filters
	views={identityViews}
	columns={[
		{
			key: 'normalizedData.state',
			title: '',
			sortable: true,
			cell: stateSnip,
			width: '48px',
			filter: {
				label: 'State',
				component: 'select',
				operators: ['eq', 'ne'],
				defaultOperator: 'eq',
				options: [
					{ label: 'Normal', value: 'normal' },
					{ label: 'Warning', value: 'warn' },
					{ label: 'Critical', value: 'critical' }
				],
				placeholder: 'Filter by state'
			}
		},
		{
			key: 'normalizedData.name',
			title: 'Name',
			searchable: true,
			sortable: true,
			render: ({ row }) => (row.normalizedData as Identity).name
		},
		{
			key: 'normalizedData.email',
			title: 'Email',
			searchable: true,
			sortable: true,
			render: ({ row }) => (row.normalizedData as Identity).email
		},
		{
			key: 'normalizedData.enabled',
			title: 'Active',
			render: ({ row }) => ((row.normalizedData as Identity).enabled ? 'Active' : 'Inactive'),
			sortable: true,
			filter: {
				label: 'Active',
				component: 'select',
				operators: ['eq', 'ne'],
				defaultOperator: 'eq',
				options: [
					{ label: 'Active', value: 'true' },
					{ label: 'Inactive', value: 'false' }
				],
				placeholder: 'Select active'
			}
		},
		{
			key: 'normalizedData.type',
			title: 'Type',
			sortable: true,
			render: ({ row }) => {
				const type = (row.normalizedData as Identity).type;
				return type.charAt(0).toUpperCase() + type.slice(1);
			},
			filter: {
				label: 'Type',
				component: 'select',
				operators: ['eq', 'ne'],
				defaultOperator: 'eq',
				options: [
					{ label: 'Member', value: 'member' },
					{ label: 'Guest', value: 'guest' }
				],
				placeholder: 'Select type'
			}
		},
		{
			key: 'normalizedData.tags',
			title: 'Tags',
			cell: tagsSnip,
			width: '200px',
			filter: {
				label: 'Tags',
				component: 'select',
				operators: ['in', 'nin'],
				defaultOperator: 'in',
				options: [
					{ label: 'MFA', value: 'MFA' },
					{ label: 'Guest', value: 'Guest' },
					{ label: 'Disabled', value: 'Disabled' },
					{ label: 'Admin', value: 'Admin' },
					{ label: 'Stale', value: 'Stale' }
				],
				placeholder: 'Select tag'
			}
		},
		{
			key: 'normalizedData.licenses',
			title: 'Licenses',
			sortable: true,
			render: ({ row }) => {
				const licenses = (row.normalizedData as Identity).licenses || [];
				return licenses.length.toString();
			}
		},
		{
			key: 'normalizedData.last_login_at',
			title: 'Last Login',
			sortable: true,
			render: ({ row }) => {
				const lastLogin = (row.normalizedData as Identity).last_login_at;
				return lastLogin ? new Date(lastLogin).toLocaleString() : 'Never';
			}
		}
	]}
/>
