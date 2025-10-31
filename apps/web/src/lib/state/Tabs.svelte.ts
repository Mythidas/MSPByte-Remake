import { getContext, setContext } from 'svelte';

type TabStateConfig = {
    tab: string;
};

interface TabState {
    getTab: () => string;
    setTab: (tab: string) => void;
}

class TabStateClass implements TabState {
    private tab: string;

    constructor(config: TabStateConfig) {
        this.tab = $state(config.tab);
    }

    getTab() {
        return this.tab;
    }

    setTab(tab: string) {
        this.tab = tab;
    }
}

const TAB_STATE_KEY = Symbol('tab-state');

export const getTabState = (): TabState => {
    return getContext<TabState>(TAB_STATE_KEY);
};

export const setTabState = (config: TabStateConfig): TabState => {
    const state = new TabStateClass(config);
    setContext<TabState>(TAB_STATE_KEY, state);
    return state;
};
