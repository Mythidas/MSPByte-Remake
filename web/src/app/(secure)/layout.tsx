import RootNavbar from "@/components/layout/RootNavbar";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { getCurrentUser } from "@/lib/actions/auth";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default async function Layout({ children }: Props) {
  const user = await getCurrentUser();

  return (
    <SidebarProvider>
      <AuthProvider
        initialUser={
          user.data && {
            id: user.data.id,
            username: user.data.email || "Uknown",
          }
        }
      >
        <div className="flex flex-col size-full">
          <RootNavbar />
          <div className="flex flex-col size-full">{children}</div>
        </div>
      </AuthProvider>
    </SidebarProvider>
  );
}
