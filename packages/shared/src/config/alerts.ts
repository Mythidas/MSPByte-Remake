export type AlertMetadataField = {
  label: string;
  key: string;
  icon?: string;
  highlight?: boolean | ((value: any) => boolean);
  format?: (value: any) => string;
};

export type AlertDescriptionConfig = {
  title: string;
  icon: string; // Icon name as string (e.g., "ShieldAlert", "Clock")
  bestPractice: string;
  metadata: AlertMetadataField[];
  futureActions?: string[];
};

export const ALERT_DESCRIPTIONS: Record<string, AlertDescriptionConfig> = {
  mfa_not_enforced: {
    title: "MFA Not Enforced",
    icon: "ShieldAlert",
    bestPractice:
      "Multi-factor authentication adds a critical security layer by requiring users to verify their identity through a second method beyond just a password. Admin accounts without MFA are high-value targets for attackers.",
    metadata: [
      { label: "Email", key: "email", icon: "Mail" },
      {
        label: "Admin Account",
        key: "isAdmin",
        icon: "User",
        highlight: (val) => val === true,
        format: (val) => (val ? "Yes" : "No"),
      },
      {
        label: "Security Defaults",
        key: "securityDefaultsEnabled",
        icon: "Info",
        format: (val) => (val ? "Enabled" : "Disabled"),
      },
    ],
    futureActions: ["Enable MFA for User", "View Conditional Access Policies"],
  },

  mfa_partial_enforced: {
    title: "Partial MFA Enforcement",
    icon: "ShieldAlert",
    bestPractice:
      "This user has partial MFA coverage, meaning some applications or scenarios may not require multi-factor authentication. Partial MFA can occur when Security Defaults are enabled (which only protects admins) or when Conditional Access policies don't cover all applications. Ensure comprehensive MFA coverage for all critical accounts.",
    metadata: [
      { label: "Email", key: "email", icon: "Mail" },
      {
        label: "Admin Account",
        key: "isAdmin",
        icon: "User",
        highlight: (val) => val === true,
        format: (val) => (val ? "Yes" : "No"),
      },
      {
        label: "Security Defaults",
        key: "securityDefaultsEnabled",
        icon: "Info",
        format: (val) => (val ? "Enabled" : "Disabled"),
      },
      {
        label: "Reason",
        key: "reason",
        icon: "AlertTriangle",
        highlight: true,
      },
    ],
    futureActions: [
      "Review Conditional Access Policies",
      "Upgrade to Full MFA",
    ],
  },

  stale_user: {
    title: "Stale User Account",
    icon: "Clock",
    bestPractice:
      "Inactive accounts pose a security risk as they may have outdated access rights and could be compromised without detection. Consider disabling accounts inactive for 90+ days, especially if they consume licenses or have admin privileges.",
    metadata: [
      { label: "Email", key: "email", icon: "Mail" },
      {
        label: "Days Inactive",
        key: "daysInactive",
        icon: "Clock",
        highlight: true,
      },
      {
        label: "Last Login",
        key: "lastLogin",
        icon: "Info",
        format: (val) => new Date(val).toLocaleString(),
      },
      {
        label: "Has Licenses",
        key: "hasLicenses",
        icon: "Key",
        highlight: (val) => val === true,
        format: (val) => (val ? "Yes" : "No"),
      },
      {
        label: "Admin Account",
        key: "isAdmin",
        icon: "User",
        highlight: (val) => val === true,
        format: (val) => (val ? "Yes" : "No"),
      },
    ],
    futureActions: ["Disable User", "Remove Licenses", "View Sign-in Activity"],
  },

  license_waste: {
    title: "License Waste",
    icon: "Key",
    bestPractice:
      "Licenses assigned to disabled or inactive users represent unnecessary costs. Regular license auditing ensures you're only paying for actively used services.",
    metadata: [
      { label: "Email", key: "email", icon: "Mail" },
      { label: "License", key: "licenseName", icon: "Key", highlight: true },
      {
        label: "Reason",
        key: "reason",
        icon: "AlertTriangle",
        highlight: true,
        format: (val) => (val === "disabled" ? "User Disabled" : "User Stale"),
      },
      {
        label: "User Enabled",
        key: "userEnabled",
        icon: "User",
        format: (val) => (val ? "Yes" : "No"),
      },
      {
        label: "User Stale",
        key: "userStale",
        icon: "Clock",
        format: (val) => (val ? "Yes" : "No"),
      },
    ],
    futureActions: ["Remove License", "Enable User", "View All User Licenses"],
  },

  license_overuse: {
    title: "License Overuse",
    icon: "AlertTriangle",
    bestPractice:
      "Consuming more licenses than purchased indicates a compliance violation and potential billing issues. This typically occurs when more users are assigned licenses than your organization has purchased, which may result in service interruptions or additional charges.",
    metadata: [
      { label: "License", key: "licenseName", icon: "Key", highlight: true },
      {
        label: "Consumed",
        key: "consumedUnits",
        icon: "TrendingUp",
        highlight: true,
      },
      { label: "Total Available", key: "totalUnits", icon: "Package" },
      {
        label: "Overage",
        key: "overage",
        icon: "AlertTriangle",
        highlight: true,
      },
    ],
    futureActions: [
      "Purchase Additional Licenses",
      "Review Assignments",
      "Contact Licensing",
    ],
  },

  policy_gap: {
    title: "Policy Coverage Gap",
    icon: "ShieldAlert",
    bestPractice:
      "Users not covered by any security policy may lack basic protections like MFA requirements, device compliance checks, or conditional access controls. This is especially critical for admin accounts.",
    metadata: [
      { label: "Email", key: "email", icon: "Mail" },
      {
        label: "Admin Account",
        key: "isAdmin",
        icon: "User",
        highlight: (val) => val === true,
        format: (val) => (val ? "Yes" : "No"),
      },
      {
        label: "Security Defaults",
        key: "securityDefaultsEnabled",
        icon: "Info",
        format: (val) => (val ? "Enabled" : "Disabled"),
      },
      {
        label: "Enabled Policies",
        key: "enabledPolicyCount",
        icon: "ShieldAlert",
      },
    ],
    futureActions: [
      "Add to Policy",
      "Enable Security Defaults",
      "View All Policies",
    ],
  },
};
