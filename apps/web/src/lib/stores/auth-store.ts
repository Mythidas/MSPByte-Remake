import { localEventBus } from "@/lib/utils/LocalEventBus";
import { AUTH_EVENTS } from "@workspace/events/auth";
import { create } from "zustand";

type User = { id: string; username: string };

interface AuthState {
  user: User | null;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));

localEventBus.on(AUTH_EVENTS.LOGIN, (user) => {
  useAuthStore.getState().setUser(user);
});

localEventBus.on(AUTH_EVENTS.LOGOUT, () => {
  useAuthStore.getState().setUser(null);
});
