"use client";

import { createContext, useContext, ReactNode } from "react";
import { Doc } from "@/lib/api";

type IntegrationContextType = {
    integration: Doc<'integrations'>;
};

const IntegrationContext = createContext<IntegrationContextType | null>(null);

export function IntegrationProvider({
    integration,
    children
}: {
    integration: Doc<'integrations'>;
    children: ReactNode;
}) {
    return (
        <IntegrationContext.Provider value={{ integration }}>
            {children}
        </IntegrationContext.Provider>
    );
}

export function useIntegration() {
    const context = useContext(IntegrationContext);
    if (!context) {
        throw new Error("useIntegration must be used within IntegrationProvider");
    }
    return context.integration;
}
