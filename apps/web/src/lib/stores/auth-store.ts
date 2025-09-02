import { localEventBus } from "@workspace/events/bus/Buses";
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

localEventBus.on("auth.login", (user) => {
  useAuthStore.getState().setUser(user);
});

localEventBus.on("auth.logout", () => {
  useAuthStore.getState().setUser(null);
});
