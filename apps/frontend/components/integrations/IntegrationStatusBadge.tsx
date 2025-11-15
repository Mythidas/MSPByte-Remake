import { Badge } from "@workspace/ui/components/badge";
import { cn } from "@workspace/ui/lib/utils";

type StatusType = "active" | "inactive" | "error" | "syncing" | "pending" | "idle" | "completed" | "failed";

type IntegrationStatusBadgeProps = {
    status: StatusType | string;
    className?: string;
};

const statusConfig: Record<StatusType, { label: string; className: string }> = {
    active: {
        label: "Active",
        className: "bg-green-500/50 text-green-100 border-green-500/50"
    },
    inactive: {
        label: "Inactive",
        className: "bg-gray-500/50 text-gray-100 border-gray-500/50"
    },
    error: {
        label: "Error",
        className: "bg-red-500/50 text-red-100 border-red-500/50"
    },
    syncing: {
        label: "Syncing",
        className: "bg-blue-500/50 text-blue-100 border-blue-500/50"
    },
    pending: {
        label: "Pending",
        className: "bg-yellow-500/50 text-yellow-100 border-yellow-500/50"
    },
    idle: {
        label: "Idle",
        className: "bg-gray-400/50 text-gray-100 border-gray-400/50"
    },
    completed: {
        label: "Completed",
        className: "bg-green-600/50 text-green-100 border-green-600/50"
    },
    failed: {
        label: "Failed",
        className: "bg-red-600/50 text-red-100 border-red-600/50"
    }
};

export function IntegrationStatusBadge({ status, className }: IntegrationStatusBadgeProps) {
    const normalizedStatus = status.toLowerCase() as StatusType;
    const config = statusConfig[normalizedStatus] || {
        label: status,
        className: "bg-gray-500/50 text-gray-100 border-gray-500/50"
    };

    return (
        <Badge className={cn(config.className, className)}>
            {config.label}
        </Badge>
    );
}
