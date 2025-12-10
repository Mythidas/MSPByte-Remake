import NavTemplate from "../nav-template";
import { NavItem } from "@/lib/types/navigation";
import { INTEGRATIONS } from "@workspace/shared/types/integrations/config";

type Props = {
  children: React.ReactNode;
};

export default async function HaloPSALayout({ children }: Props) {
  const integration = INTEGRATIONS["halopsa"];
  const navigation: NavItem[] = [
    {
      label: "Overview",
      href: "/secure/default/integrations/halopsa",
      isExact: true,
    },
    {
      label: "Setup",
      href: "/secure/default/integrations/halopsa/setup",
    },
    {
      label: "Company Mapping",
      href: "/secure/default/integrations/halopsa/companies",
    },
  ];

  return (
    <NavTemplate integration={integration} items={navigation}>
      {children}
    </NavTemplate>
  );
}
