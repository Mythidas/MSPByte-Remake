import { getContext, setContext } from 'svelte';

interface NavState {
	currentPath: string;
	registerGroup: (name: string, parent?: string) => void;
	registerRoute: (href: string, group?: string) => void;
	isRouteActive: (href: string, exact?: boolean) => boolean;
	isGroupActive: (groupName: string) => boolean;
}

class NavStateClass implements NavState {
	currentPath = $state('');
	private groups = $state<Map<string, Set<string>>>(new Map());
	private routes = $state<Map<string, string | undefined>>(new Map());
	private groupParents = $state<Map<string, string | undefined>>(new Map());
	private groupChildren = $state<Map<string, Set<string>>>(new Map());

	registerGroup(name: string, parent?: string) {
		if (!this.groups.has(name)) {
			this.groups.set(name, new Set());
		}

		this.groupParents.set(name, parent);

		if (parent) {
			if (!this.groupChildren.has(parent)) {
				this.groupChildren.set(parent, new Set());
			}
			this.groupChildren.get(parent)!.add(name);
		}
	}

	registerRoute(href: string, group?: string) {
		this.routes.set(href, group);
		if (group) {
			// Add route to the immediate group
			const groupRoutes = this.groups.get(group);
			if (groupRoutes) {
				groupRoutes.add(href);
			}

			// Also add route to all parent groups
			let currentParent = this.groupParents.get(group);
			while (currentParent) {
				const parentRoutes = this.groups.get(currentParent);
				if (parentRoutes) {
					parentRoutes.add(href);
				}
				currentParent = this.groupParents.get(currentParent);
			}
		}
	}

	isRouteActive(href: string, exact?: boolean): boolean {
		if (href === '/' || exact) {
			return this.currentPath === href;
		}
		return this.currentPath.startsWith(href);
	}

	isGroupActive(groupName: string): boolean {
		const routes = Array.from(this.routes);
		const hasActiveRoute = routes.some(([route, group]) => {
			if (group !== groupName) return false;
			return this.isRouteActive(route);
		});

		if (hasActiveRoute) return true;

		// Check if any child groups are active
		const children = this.groupChildren.get(groupName);
		if (children) {
			return Array.from(children).some(child => this.isGroupActive(child));
		}

		return false;
	}
}

const NAV_STATE_KEY = Symbol('nav-state');

export const getNavState = (): NavState => {
	return getContext<NavState>(NAV_STATE_KEY);
};

export const setNavState = (): NavState => {
	const state = new NavStateClass();
	setContext<NavState>(NAV_STATE_KEY, state);
	return state;
};
