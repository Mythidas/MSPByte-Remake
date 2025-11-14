"use client";

import { Button } from "@workspace/ui/components/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { TableView } from "./types";

interface DataTableViewSelectorProps {
    views: TableView[];
    activeView?: TableView;
    onViewChange: (view?: TableView) => void;
}

export function DataTableViewSelector({ views, activeView, onViewChange }: DataTableViewSelectorProps) {
    if (views.length === 0) {
        return null;
    }

    // For small number of views, show as tabs
    if (views.length <= 4) {
        return (
            <div className="flex items-center gap-2">
                <Button
                    variant={!activeView ? "default" : "outline"}
                    size="sm"
                    onClick={() => onViewChange(undefined)}
                >
                    All
                </Button>
                {views.map((view) => (
                    <Button
                        key={view.id}
                        variant={activeView?.id === view.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => onViewChange(view)}
                    >
                        {view.label}
                    </Button>
                ))}
            </div>
        );
    }

    // For many views, use dropdown
    return (
        <Select
            value={activeView?.id || "all"}
            onValueChange={(value) => {
                if (value === "all") {
                    onViewChange(undefined);
                } else {
                    const view = views.find((v) => v.id === value);
                    onViewChange(view);
                }
            }}
        >
            <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select view" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {views.map((view) => (
                    <SelectItem key={view.id} value={view.id}>
                        {view.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
