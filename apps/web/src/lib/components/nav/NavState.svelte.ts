import { getContext, setContext } from 'svelte';

interface NavState {
	currentPath: string;
	registerGroup: (name: string) => void;
	registerRoute: (href: string, group?: string) => void;
	isRouteActive: (href: string) => boolean;
	isGroupActive: (groupName: string) => boolean;
}

class NavStateClass implements NavState {
	currentPath = $state('');
	private groups = $state<Map<string, Set<string>>>(new Map());
	private routes = $state<Map<string, string | undefined>>(new Map());

	registerGroup(name: string) {
		if (!this.groups.has(name)) {
			this.groups.set(name, new Set());
		}
	}

	registerRoute(href: string, group?: string) {
		this.routes.set(href, group);
		if (group) {
			const groupRoutes = this.groups.get(group);
			if (groupRoutes) {
				groupRoutes.add(href);
			}
		}
	}

	isRouteActive(href: string): boolean {
		if (href === '/') {
			return this.currentPath === '/';
		}
		return this.currentPath.startsWith(href);
	}

	isGroupActive(groupName: string): boolean {
		const routes = Array.from(this.routes);
		return routes.some(([route, group]) => {
			if (group !== groupName) return false;
			return this.isRouteActive(route);
		});
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
