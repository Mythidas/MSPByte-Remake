import { getSystemInfo, SystemInfo } from "@/lib/agent.ts";
import Loader from "@workspace/ui/components/Loader.tsx";
import { useEffect, useState } from "react";

export default function About() {
  const [settings, setSettings] = useState<SystemInfo | undefined>(undefined);

  useEffect(() => {
    const load = async () => {
      const settings = await getSystemInfo();
      setSettings(settings.data);
    };

    load();
  }, []);

  const itemClass =
    "flex w-full justify-between border bg-card shadow px-2 py-1";

  if (!settings) {
    return <Loader />;
  }

  return (
    <div className="flex flex-col gap-2 size-full p-2 items-center">
      <h1 className="text-2xl font-bold">About</h1>
      <div className="grid gap-1 w-full">
        <div className={itemClass}>
          <span>PC Name</span>
          <span>{settings.hostname}</span>
        </div>
        <div className={itemClass}>
          <span>Username</span>
          <span>{settings.username || "N/A"}</span>
        </div>
        <div className={itemClass}>
          <span>IP (LAN)</span>
          <span>{settings.ip_address || "N/A"}</span>
        </div>
        <div className={itemClass}>
          <span>IP (WAN)</span>
          <span>{settings.ext_address || "N/A"}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1 items-center mt-auto text-sm text-muted-foreground">
        <span>App Ver {settings.version || "N/A"}</span>
      </div>
    </div>
  );
}
