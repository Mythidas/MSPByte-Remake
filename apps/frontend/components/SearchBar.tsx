'use client';

import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Input } from '@workspace/ui/components/input';
import { cn } from '@workspace/ui/lib/utils';
import { ClassValue } from 'clsx';
import { useEffect, useState } from 'react';

type Props = {
    delay?: number;
    onSearch?: (query: string) => void;
    lead?: React.ReactNode;
    leadClass?: ClassValue;
    placeholder?: string;
} & React.ComponentProps<typeof Input>;

export default function SearchBar({
    delay = 0,
    onSearch,
    lead,
    placeholder,
    leadClass,
    className,
    ...props
}: Props) {
    const [query, setQuery] = useState('');
    const debouncedQuery = useDebouncedValue(query, delay);

    useEffect(() => {
        onSearch?.(debouncedQuery); // ← no dependency on onSearch
    }, [debouncedQuery]); // ← this is key

    return (
        <div className={cn("relative flex w-full")}>
            {lead && (
                <div className={cn(leadClass, "absolute left-2.5 top-1.5 h-4 w-4 text-muted-foreground")}>
                    {lead}
                </div>
            )}
            <Input
                type="search"
                placeholder={placeholder || 'Search...'}
                className={cn(className, !!lead && 'pl-10', "rounded")}
                onChange={(e) => setQuery(e.target.value)}
                {...props}
            />
        </div>
    );
}
