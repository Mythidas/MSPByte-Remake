"use client";

import { Table } from "@tanstack/react-table";
import { Settings2 } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";

interface DataTableColumnToggleProps<TData> {
    table: Table<TData>;
}

export function DataTableColumnToggle<TData>({ table }: DataTableColumnToggleProps<TData>) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-2">
                    <Settings2 className="h-4 w-4" />
                    View
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[180px]">
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {table
                    .getAllColumns()
                    .filter((column) => typeof column.accessorFn !== "undefined" && column.getCanHide())
                    .map((column) => {
                        return (
                            <DropdownMenuCheckboxItem
                                key={column.id}
                                className="capitalize"
                                checked={column.getIsVisible()}
                                onCheckedChange={(value) => column.toggleVisibility(!!value)}
                            >
                                {column.id}
                            </DropdownMenuCheckboxItem>
                        );
                    })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
