"use client";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { Building2, Link as LinkIcon, ExternalLink, CheckCircle } from "lucide-react";

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

export function CompanyMappingCard({ company, isSelected, onClick }: CompanyMappingCardProps) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "bg-card/30 border rounded p-4 cursor-pointer transition-all hover:bg-card/50",
                isSelected && "border-primary bg-primary/5"
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                    <div className={cn(
                        "w-10 h-10 rounded border flex items-center justify-center flex-shrink-0",
                        company.isLinked ? "bg-green-500/20 border-green-500/50" : "bg-card/50"
                    )}>
                        {company.isLinked ? (
                            <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                            <Building2 className="w-5 h-5 text-muted-foreground" />
                        )}
                    </div>

                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-medium truncate">{company.name || 'Unnamed Company'}</h3>
                            {company.isLinked && (
                                <Badge className="bg-green-500/50 text-xs">
                                    Linked
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            ID: {company.externalId}
                        </p>
                        {company.externalParentId && (
                            <p className="text-xs text-muted-foreground">
                                Parent: {company.externalParentId}
                            </p>
                        )}

                        {company.isLinked && company.linkedName && (
                            <div className="flex items-center gap-1 mt-2 text-xs">
                                <LinkIcon className="w-3 h-3 text-green-400" />
                                <span className="text-green-400">{company.linkedName}</span>
                            </div>
                        )}
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
