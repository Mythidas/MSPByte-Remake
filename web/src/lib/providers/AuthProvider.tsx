"use client";

import { useEffect } from "react";
import { getCurrentUser } from "@/lib/actions/auth";
import { Tables } from "@workspace/shared/types/database";
import { useAuthStore } from "@/lib/stores/auth";

export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser?: Tables<"users_view">;
  children: React.ReactNode;
}) {
  const { setUser } = useAuthStore((s) => s);

  useEffect(() => {
    if (initialUser) setUser(initialUser);
    else
      getCurrentUser().then((u) => {
        if (u.data) setUser(u.data);
      });
  }, [initialUser]);

  return <>{children}</>;
}
