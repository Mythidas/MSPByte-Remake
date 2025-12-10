import NavTemplate from "../nav-template";
import { NavItem } from "@/lib/types/navigation";
import { INTEGRATIONS } from "@workspace/shared/types/integrations/config";

type Props = {
  children: React.ReactNode;
};

export default async function Microsoft365Layout({ children }: Props) {
  const navigation: NavItem[] = [
    {
      label: "Overview",
      href: "/secure/default/integrations/microsoft-365",
      isExact: true,
    },
    {
      label: "Setup",
      href: "/secure/default/integrations/microsoft-365/setup",
    },
    {
      label: "Connections",
      href: "/secure/default/integrations/microsoft-365/connections",
    },
  ];

  return (
    <NavTemplate integration={INTEGRATIONS["microsoft-365"]} items={navigation}>
      {children}
    </NavTemplate>
  );
}
