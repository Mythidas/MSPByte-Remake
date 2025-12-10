"use client";

import { Badge } from "@workspace/ui/components/badge";
import { cn } from "@workspace/ui/lib/utils";
import { Link as LinkIcon, CheckCircle } from "lucide-react";

type CompanyMappingCardProps = {
  company: {
    _id: string;
    name?: string;
    externalId: string;
    externalParentId?: string;
    isLinked: boolean;
    linkedId?: string;
    linkedSlug?: string;
    linkedName?: string;
  };
  isSelected?: boolean;
  onClick?: () => void;
};

export function CompanyMappingCard({
  company,
  isSelected,
  onClick,
}: CompanyMappingCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card/30 border rounded p-4 cursor-pointer transition-all hover:bg-card/50",
        isSelected && "border-primary bg-primary/5",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-wrap">
                {company.name || "Unnamed Company"}
              </h3>
              {company.isLinked && (
                <Badge className="bg-green-500/50 text-xs">Linked</Badge>
              )}
            </div>
            <div className="flex gap-2 items-center">
              <p className="text-xs text-muted-foreground">
                ID: {company.externalId}
              </p>
              {company.externalParentId && (
                <p className="text-xs text-muted-foreground">
                  Parent: {company.externalParentId}
                </p>
              )}

              {company.isLinked && company.linkedName && (
                <div className="flex items-center gap-1 text-xs">
                  <LinkIcon className="w-3 h-3 text-green-400" />
                  <span className="text-green-400">{company.linkedName}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {isSelected && (
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-4 h-4 text-primary-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
