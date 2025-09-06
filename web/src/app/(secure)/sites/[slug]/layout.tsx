import SitesSidebar from "@/components/layout/SitesSidebar";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function Layout({ children }: Props) {
  return (
    <div className="flex size-full gap-2">
      <SitesSidebar site={undefined}>{children}</SitesSidebar>
    </div>
  );
}
