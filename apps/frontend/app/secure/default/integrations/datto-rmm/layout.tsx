import NavTemplate from "../nav-template";
import { NavItem } from "@/lib/types/navigation";
import { INTEGRATIONS } from "@workspace/shared/types/integrations/config";

type Props = {
  children: React.ReactNode;
};

export default async function DattoRMMLayout({ children }: Props) {
  const navigation: NavItem[] = [
    {
      label: "Overview",
      href: "/secure/default/integrations/datto-rmm",
      isExact: true,
    },
    {
      label: "Setup",
      href: "/secure/default/integrations/datto-rmm/setup",
    },
    {
      label: "Sync",
      href: "/secure/default/integrations/datto-rmm/sync",
    },
    {
      label: "Site Mapping",
      href: "/secure/default/integrations/datto-rmm/sites",
    },
  ];

  return (
    <NavTemplate integration={INTEGRATIONS["datto-rmm"]} items={navigation}>
      {children}
    </NavTemplate>
  );
}
