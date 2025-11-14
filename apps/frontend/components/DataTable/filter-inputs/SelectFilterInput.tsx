"use client";

import { Label } from "@workspace/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { FilterOperator, FilterConfig } from "../types";
import { getOperatorLabel } from "../utils/filters";
import { Checkbox } from "@workspace/ui/components/checkbox";

interface SelectFilterInputProps {
    config: FilterConfig;
    operator: FilterOperator;
    value: any;
    onOperatorChange: (operator: FilterOperator) => void;
    onValueChange: (value: any) => void;
}

export function SelectFilterInput({
    config,
    operator,
    value,
    onOperatorChange,
    onValueChange,
}: SelectFilterInputProps) {
    const isMulti = operator === "in" || operator === "nin";
    const selectedValues = isMulti ? (Array.isArray(value) ? value : []) : value;

    const handleMultiChange = (optValue: any, checked: boolean) => {
        const current = Array.isArray(value) ? value : [];
        if (checked) {
            onValueChange([...current, optValue]);
        } else {
            onValueChange(current.filter(v => v !== optValue));
        }
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Operator</Label>
                <Select value={operator} onValueChange={(v) => onOperatorChange(v as FilterOperator)}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {config.operators.map((op) => (
                            <SelectItem key={op} value={op}>
                                {getOperatorLabel(op)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Value</Label>
                {isMulti ? (
                    <div className="space-y-2 border rounded-md p-3">
                        {config.options?.map((option) => (
                            <div key={option.value} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`option-${option.value}`}
                                    checked={selectedValues.includes(option.value)}
                                    onCheckedChange={(checked) => handleMultiChange(option.value, !!checked)}
                                />
                                <label
                                    htmlFor={`option-${option.value}`}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    {option.label}
                                </label>
                            </div>
                        ))}
                    </div>
                ) : (
                    <Select value={String(value)} onValueChange={onValueChange}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select value..." />
                        </SelectTrigger>
                        <SelectContent>
                            {config.options?.map((option) => (
                                <SelectItem key={option.value} value={String(option.value)}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>
        </div>
    );
}
