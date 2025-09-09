"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { getCurrentUser } from "@/lib/actions/auth";
import { Tables } from "@workspace/shared/types/database";

export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser?: Tables<"users_with_role">;
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
