"use client";

import { Doc } from "@/lib/api";
import { createContext, useContext, ReactNode } from "react";

const IntegrationContext = createContext<Doc<"integrations"> | undefined>(undefined);

export function IntegrationProvider({ integration, children }: { integration: Doc<"integrations">, children: ReactNode }) {
    return (
        <IntegrationContext.Provider value={integration}>
            {children}
        </IntegrationContext.Provider>
    );
}

export function useIntegration() {
    const context = useContext(IntegrationContext);
    if (!context) {
        throw new Error("useIntegration must be used within IntegrationProvider");
    }
    return context;
}
