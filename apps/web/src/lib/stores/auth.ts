import { localEventBus } from "@workspace/shared/lib/bus/Buses";
import { Tables } from "@workspace/shared/types/database";
import { create } from "zustand";

type User = Tables<"users_view">;

interface AuthState {
  user: User | null;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));

localEventBus.on("auth.login", (user: User) => {
  useAuthStore.getState().setUser(user);
});

localEventBus.on("auth.logout", () => {
  useAuthStore.getState().setUser(null);
});
