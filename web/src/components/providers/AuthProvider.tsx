"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { getCurrentUser } from "@/lib/actions/auth";

export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser?: { id: string; username: string };
  children: React.ReactNode;
}) {
  const { setUser } = useAuthStore((s) => s);

  useEffect(() => {
    if (initialUser) setUser(initialUser);
    else
      getCurrentUser().then((u) => {
        if (u.data)
          setUser({ id: u.data.id, username: u.data.email || "Unknown" });
      });
  }, [initialUser]);

  return <>{children}</>;
}
