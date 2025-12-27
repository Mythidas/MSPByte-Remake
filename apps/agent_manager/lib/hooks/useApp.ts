import { useAppStore } from "../stores/AppStore";

export function useApp() {
  const { currentSite } = useAppStore();
  return { site: currentSite };
}
