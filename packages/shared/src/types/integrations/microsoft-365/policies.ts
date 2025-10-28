export type MSGraphConditionalAccessPolicy = {
    id: string;
    state: 'enabled' | 'disabled' | 'enabledForReportingButNotEnforced';
    displayName: string;
    templateId?: string;
    createdDateTime: string;
    modifiedDateTime?: string;
    conditions: {
        users?: {
            includeUsers: string[];
            excludeUsers: string[];
            includeGroups: string[];
            excludeGroups: string[];
            includeRoles: string[];
            excludeRoles: string[];
        };
        applications?: {
            includeApplications: string[];
            excludeApplications: string[];
        };
        platforms?: {
            includePlatforms?: string[];
        };
        locations?: {
            includeLocations?: string[];
            excludeLocations?: string[];
        };
        clientAppTypes?: string[];
        userRiskLevels?: string[];
        signInRiskLevels?: string[];
    };
    grantControls?: {
        operator: 'AND' | 'OR';
        builtInControls?: string[];
        termsOfUse?: string[];
        customAuthenticationFactors?: string[];
    };
    sessionControls?: {
        applicationEnforcedRestrictions?: any;
        cloudAppSecurity?: any;
        signInFrequency?: any;
        persistentBrowser?: any;
    };
};
