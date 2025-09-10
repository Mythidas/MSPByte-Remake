"use client";

import { Tables } from "@workspace/shared/types/database";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LazyTabContent } from "@/components/LazyTabContent";
import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ShieldEllipsis } from "lucide-react";
import Microsoft365MappingTab from "@/modules/integrations/microsoft-365/components/Microsoft365MappingTab";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

type Props = {
  integration: Tables<"integrations">;
  dataSource?: Tables<"data_sources">;
};

const REQUIRED_PERMISSIONS = [
  "AuditLog.Read.All",
  "Directory.Read.All",
  "LicenseAssignment.Read.All",
  "MailboxSettings.Read",
  "Organization.Read.All",
  "Policy.Read.All",
  "Reports.Read.All",
  "User-PasswordProfile.ReadWrite.All",
  "User.ManageIdentities.All",
  "User.Read.All",
  "User.RevokeSessions.All",
  "UserAuthenticationMethod.ReadWrite.All",
];

export default function Microsoft365Page({ integration }: Props) {
  const [tab, setTab] = useState("1");
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const success = searchParams.get("success");
  const tenant = searchParams.get("tenant");

  useEffect(() => {
    if (error) {
      toast.error(`Admin consent failed: ${error}`);
    }

    if (success && tenant) {
      toast.info(`Admin consent successful: ${tenant}`);
    }
  }, [error, success, tenant]);

  return (
    <div className="grid gap-4">
      <span className="text-2xl font-semibold">Instructions</span>
      <div className="grid gap-2">
        <p className="flex gap-2">
          <Badge variant="default">Step 1</Badge>
          <span>
            Create Microsoft 365 Tenant App Registration in target tenant
          </span>
        </p>
        <p className="flex gap-2 items-center">
          <Badge variant="default">Step 2</Badge>
          <span className="flex gap-2">
            <span>Add and Consent required permissions</span>
            <Dialog>
              <DialogTrigger>
                <ShieldEllipsis className="w-4 hover:text-primary hover:cursor-pointer" />
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Required Permissions</DialogTitle>
                  <DialogDescription>
                    Required permissions for MSP Byte to perform actions and
                    read data
                  </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[40vh] rounded">
                  <div className="grid gap-2 bg-input/50 rounded p-2">
                    {REQUIRED_PERMISSIONS.map((perm) => (
                      <code key={perm}>{perm}</code>
                    ))}
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </span>
        </p>
        <p className="flex gap-2">
          <Badge variant="default">Step 3</Badge>
          <span>Provide Client ID, Tenant ID and Client Secret</span>
        </p>
        <p className="flex gap-2">
          <Badge variant="default">Step 4</Badge>
          <span>Configure M365 global settings and templates</span>
        </p>
      </div>
      <Tabs defaultValue="1" onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="1">
            <Badge className="rounded-full bg-primary w-6 h-6">1</Badge>
            Map Sites
          </TabsTrigger>
        </TabsList>

        <LazyTabContent value="1" tab={tab}>
          <Microsoft365MappingTab integration={integration} />
        </LazyTabContent>
      </Tabs>
    </div>
  );
}
