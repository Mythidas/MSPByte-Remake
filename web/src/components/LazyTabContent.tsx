"use client";

import { TabsContent } from "@/components/ui/tabs";
import { useRef } from "react";

type Props = { tab: string } & React.ComponentProps<typeof TabsContent>;

export function LazyTabContent({ value, children, tab, ...props }: Props) {
  const rendered = useRef(false);

  if (value === tab) {
    rendered.current = true;
  }

  if (!rendered.current) return null;

  return (
    <TabsContent value={value} {...props} className="space-y-6">
      {children}
    </TabsContent>
  );
}
