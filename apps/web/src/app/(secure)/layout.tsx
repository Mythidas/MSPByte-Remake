import RootNavbar from "@/components/layout/RootNavbar";
import { SidebarProvider } from "@workspace/ui/components/sidebar";
import { getCurrentUser } from "@/lib/actions/auth";
import { AuthProvider } from "@/lib/providers/AuthProvider";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default async function Layout({ children }: Props) {
  const user = await getCurrentUser();

  return (
    <SidebarProvider>
      <AuthProvider initialUser={user.data}>
        <div className="flex flex-col size-full">
          <RootNavbar />
          <div className="flex flex-1 flex-col size-full overflow-hidden">
            {children}
          </div>
        </div>
      </AuthProvider>
    </SidebarProvider>
  );
}
