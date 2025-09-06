"use client";

import React, { useState } from "react";
import {
  Building2,
  Users,
  Shield,
  Monitor,
  Mail,
  Ticket,
  FileText,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  DollarSign,
  BarChart3,
  Settings,
  Search,
  Bell,
  ChevronDown,
  Eye,
  ExternalLink,
  Wifi,
  WifiOff,
  Calendar,
  Clock,
  Plug,
  Filter,
  Plus,
  Globe,
  Server,
  Key,
  Heart,
  Target,
  Link,
} from "lucide-react";

const MSPDashboard = () => {
  const [activeView, setActiveView] = useState("overview");
  const [selectedClient, setSelectedClient] = useState("acme-corp");

  // Mock integration configurations
  const globalIntegrations = {
    m365: {
      name: "Microsoft 365",
      icon: Mail,
      enabled: true,
      category: "email",
    },
    google: {
      name: "Google Workspace",
      icon: Mail,
      enabled: true,
      category: "email",
    },
    datto: { name: "Datto RMM", icon: Monitor, enabled: true, category: "rmm" },
    sophos: {
      name: "Sophos Central",
      icon: Shield,
      enabled: true,
      category: "security",
    },
    autotask: {
      name: "AutoTask",
      icon: Ticket,
      enabled: true,
      category: "psa",
    },
    connectwise: {
      name: "ConnectWise",
      icon: Ticket,
      enabled: false,
      category: "psa",
    },
    sentinel: {
      name: "SentinelOne",
      icon: Shield,
      enabled: false,
      category: "security",
    },
  };

  // Mock client-specific integration mappings
  const clientIntegrations = {
    "acme-corp": {
      m365: {
        enabled: true,
        tenantId: "acme-tenant",
        dataTypes: ["users", "licenses", "security"],
      },
      datto: {
        enabled: true,
        siteId: "datto-123",
        dataTypes: ["endpoints", "monitoring"],
      },
      sophos: {
        enabled: true,
        tenantId: "sophos-acme",
        dataTypes: ["endpoints", "firewalls", "licenses"],
      },
      autotask: {
        enabled: true,
        contractId: "AT-001",
        dataTypes: ["tickets", "contracts", "billing"],
      },
    },
    "tech-solutions": {
      google: {
        enabled: true,
        domain: "techsolutions.com",
        dataTypes: ["users", "licenses"],
      },
      datto: {
        enabled: true,
        siteId: "datto-456",
        dataTypes: ["endpoints", "monitoring"],
      },
      autotask: {
        enabled: true,
        contractId: "AT-002",
        dataTypes: ["tickets", "contracts"],
      },
    },
  };

  const clients = [
    {
      id: "acme-corp",
      name: "Acme Corporation",
      integrations: Object.keys(clientIntegrations["acme-corp"] || {}),
      endpoints: 45,
      issues: 3,
    },
    {
      id: "tech-solutions",
      name: "Tech Solutions Inc",
      integrations: Object.keys(clientIntegrations["tech-solutions"] || {}),
      endpoints: 23,
      issues: 1,
    },
  ];

  const currentClient = clients.find((c) => c.id === selectedClient);
  const currentClientIntegrations = clientIntegrations[selectedClient] || {};

  // Dynamic view generation based on available integrations and data types
  const generateViews = () => {
    const views = [
      { id: "overview", icon: BarChart3, label: "Overview", alwaysShow: true },
    ];
    const dataTypeViews = new Map();

    // Aggregate data types from all client integrations
    Object.entries(currentClientIntegrations).forEach(
      ([integrationKey, config]) => {
        if (!config.enabled) return;

        config.dataTypes.forEach((dataType) => {
          if (!dataTypeViews.has(dataType)) {
            dataTypeViews.set(dataType, {
              id: dataType,
              integrations: [],
              getIcon: () => {
                switch (dataType) {
                  case "endpoints":
                    return Monitor;
                  case "users":
                    return Users;
                  case "security":
                    return Shield;
                  case "licenses":
                    return Key;
                  case "tickets":
                    return Ticket;
                  case "contracts":
                    return FileText;
                  case "billing":
                    return DollarSign;
                  case "firewalls":
                    return Server;
                  case "monitoring":
                    return Activity;
                  default:
                    return Globe;
                }
              },
              getLabel: () => {
                switch (dataType) {
                  case "endpoints":
                    return "Assets";
                  case "users":
                    return "Identity";
                  case "security":
                    return "Security";
                  case "licenses":
                    return "Licensing";
                  case "tickets":
                    return "Tickets";
                  case "contracts":
                    return "Contracts";
                  case "billing":
                    return "Billing";
                  case "firewalls":
                    return "Network";
                  case "monitoring":
                    return "Monitoring";
                  default:
                    return dataType.charAt(0).toUpperCase() + dataType.slice(1);
                }
              },
            });
          }
          dataTypeViews.get(dataType).integrations.push(integrationKey);
        });
      }
    );

    // Convert to array and add to views
    dataTypeViews.forEach((viewConfig, dataType) => {
      views.push({
        id: dataType,
        icon: viewConfig.getIcon(),
        label: viewConfig.getLabel(),
        integrations: viewConfig.integrations,
        count: viewConfig.integrations.length,
      });
    });

    return views;
  };

  const dynamicViews = generateViews();

  // Mock data with integration source tracking
  const mockData = {
    overview: {
      totalEndpoints: 45,
      onlineEndpoints: 42,
      criticalAlerts: 3,
      openTickets: 7,
      monthlyRevenue: 8500,
      integrationHealth: Object.entries(currentClientIntegrations).map(
        ([key, config]) => ({
          integration: key,
          name: globalIntegrations[key]?.name,
          status: "healthy",
          lastSync: "2 min ago",
        })
      ),
    },
    endpoints: [
      {
        name: "ACME-DC01",
        type: "Server",
        status: "online",
        lastSeen: "2 min ago",
        sources: {
          datto: { online: true, monitoring: true, backup: "success" },
          sophos: { protected: true, threats: 0, policy: "compliant" },
        },
        os: "Windows Server 2022",
      },
      {
        name: "ACME-WS001",
        type: "Workstation",
        status: "online",
        lastSeen: "5 min ago",
        sources: {
          datto: { online: true, monitoring: true, backup: "warning" },
          sophos: { protected: true, threats: 1, policy: "compliant" },
        },
        os: "Windows 11 Pro",
      },
      {
        name: "ACME-WS002",
        type: "Workstation",
        status: "offline",
        lastSeen: "2 hours ago",
        sources: {
          datto: { online: false, monitoring: false, backup: "failed" },
        },
        os: "Windows 10 Pro",
      },
    ],
    users: {
      m365: [
        {
          name: "John Smith",
          email: "john@acme.com",
          mfaEnabled: true,
          roles: ["Global Admin"],
          source: "m365",
        },
        {
          name: "Sarah Johnson",
          email: "sarah@acme.com",
          mfaEnabled: true,
          roles: ["User"],
          source: "m365",
        },
      ],
    },
    security: {
      sophos: {
        threats: { total: 5, blocked: 4, resolved: 1 },
        policies: { compliant: 42, nonCompliant: 3 },
        firewalls: [
          {
            name: "ACME-FW01",
            model: "XG 230",
            status: "healthy",
            threats: 12,
          },
        ],
      },
      m365: {
        securityDefaults: true,
        conditionalAccess: 5,
        riskUsers: 2,
      },
    },
  };

  const IntegrationBadge = ({ integrationKey, small = false }) => {
    const integration = globalIntegrations[integrationKey];
    if (!integration) return null;

    const Icon = integration.icon;
    return (
      <div
        className={`flex items-center ${small ? "text-xs" : "text-sm"} bg-gray-100 text-gray-700 px-2 py-1 rounded`}
      >
        <Icon className={`${small ? "h-3 w-3" : "h-4 w-4"} mr-1`} />
        {integration.name}
      </div>
    );
  };

  const DataSourceIndicator = ({ sources, dataType }) => {
    const availableIntegrations = currentClientIntegrations;

    return (
      <div className="flex flex-wrap gap-1">
        {Object.entries(availableIntegrations).map(
          ([integrationKey, config]) => {
            if (!config.dataTypes.includes(dataType)) return null;

            const hasData = sources && sources[integrationKey];
            const integration = globalIntegrations[integrationKey];

            return (
              <span
                key={integrationKey}
                className={`px-2 py-1 text-xs rounded flex items-center ${
                  hasData
                    ? "bg-green-100 text-green-800"
                    : "bg-yellow-100 text-yellow-800"
                }`}
                title={
                  hasData
                    ? `Data available from ${integration.name}`
                    : `No data from ${integration.name}`
                }
              >
                <integration.icon className="h-3 w-3 mr-1" />
                {hasData ? "✓" : "?"}
              </span>
            );
          }
        )}
      </div>
    );
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Assets</p>
              <p className="text-3xl font-bold text-gray-900">
                {mockData.overview.totalEndpoints}
              </p>
            </div>
            <Monitor className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Online Now</p>
              <p className="text-3xl font-bold text-green-600">
                {mockData.overview.onlineEndpoints}
              </p>
            </div>
            <Wifi className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Integrations</p>
              <p className="text-3xl font-bold text-blue-600">
                {Object.keys(currentClientIntegrations).length}
              </p>
            </div>
            <Plug className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Monthly Revenue</p>
              <p className="text-3xl font-bold text-gray-900">
                ${mockData.overview.monthlyRevenue.toLocaleString()}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Integration Health</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockData.overview.integrationHealth.map((integration) => (
              <div
                key={integration.integration}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {integration.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      Last sync: {integration.lastSync}
                    </p>
                  </div>
                </div>
                <Heart className="h-5 w-5 text-green-500" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Asset Coverage Matrix</h3>
            <p className="text-sm text-gray-500 mt-1">
              Cross-reference between monitoring tools
            </p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="text-sm font-medium">
                  Full Coverage (All Tools)
                </span>
                <span className="text-lg font-bold text-green-600">40</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                <span className="text-sm font-medium">Partial Coverage</span>
                <span className="text-lg font-bold text-yellow-600">3</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                <span className="text-sm font-medium">Coverage Gaps</span>
                <span className="text-lg font-bold text-red-600">2</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Available Data Types</h3>
            <p className="text-sm text-gray-500 mt-1">
              What information is accessible for this client
            </p>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-2">
              {dynamicViews
                .filter((view) => !view.alwaysShow)
                .map((view) => (
                  <div
                    key={view.id}
                    className="flex items-center bg-blue-50 text-blue-700 px-3 py-2 rounded-lg"
                  >
                    <view.icon className="h-4 w-4 mr-2" />
                    <span className="text-sm font-medium">{view.label}</span>
                    <span className="ml-2 bg-blue-200 text-blue-800 text-xs px-2 py-1 rounded-full">
                      {view.count}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderEndpoints = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Assets</h2>
          <p className="text-sm text-gray-500 mt-1">
            Data from:{" "}
            {dynamicViews
              .find((v) => v.id === "endpoints")
              ?.integrations.map((i) => globalIntegrations[i]?.name)
              .join(", ")}
          </p>
        </div>
        <div className="flex space-x-2">
          <button className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 flex items-center">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </button>
          <button className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Sync All
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Asset
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data Sources
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  OS
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Seen
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mockData.endpoints.map((endpoint, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Monitor className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {endpoint.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {endpoint.type}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {endpoint.status === "online" ? (
                        <Wifi className="h-4 w-4 text-green-500 mr-2" />
                      ) : (
                        <WifiOff className="h-4 w-4 text-red-500 mr-2" />
                      )}
                      <span
                        className={`text-sm ${endpoint.status === "online" ? "text-green-600" : "text-red-600"}`}
                      >
                        {endpoint.status.charAt(0).toUpperCase() +
                          endpoint.status.slice(1)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <DataSourceIndicator
                      sources={endpoint.sources}
                      dataType="endpoints"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {endpoint.os}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {endpoint.lastSeen}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900 mr-3">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button className="text-gray-600 hover:text-gray-900">
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderSecurity = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Security</h2>
          <p className="text-sm text-gray-500 mt-1">
            Data from:{" "}
            {dynamicViews
              .find((v) => v.id === "security")
              ?.integrations.map((i) => globalIntegrations[i]?.name)
              .join(", ")}
          </p>
        </div>
      </div>

      {currentClientIntegrations.sophos && (
        <div className="bg-white rounded-lg border">
          <div className="p-6 border-b flex items-center justify-between">
            <div className="flex items-center">
              <Shield className="h-5 w-5 text-orange-600 mr-2" />
              <h3 className="text-lg font-semibold">Sophos Central</h3>
            </div>
            <IntegrationBadge integrationKey="sophos" />
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">
                  {mockData.security.sophos.threats.blocked}
                </div>
                <div className="text-sm text-gray-600">Threats Blocked</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">
                  {mockData.security.sophos.policies.compliant}
                </div>
                <div className="text-sm text-gray-600">Compliant Devices</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">
                  {mockData.security.sophos.firewalls.length}
                </div>
                <div className="text-sm text-gray-600">Firewalls</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentClientIntegrations.m365 && (
        <div className="bg-white rounded-lg border">
          <div className="p-6 border-b flex items-center justify-between">
            <div className="flex items-center">
              <Shield className="h-5 w-5 text-blue-600 mr-2" />
              <h3 className="text-lg font-semibold">Microsoft 365 Security</h3>
            </div>
            <IntegrationBadge integrationKey="m365" />
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">
                  {mockData.security.m365.conditionalAccess}
                </div>
                <div className="text-sm text-gray-600">
                  Conditional Access Policies
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">
                  {mockData.security.m365.riskUsers}
                </div>
                <div className="text-sm text-gray-600">Risky Users</div>
              </div>
              <div className="text-center">
                {mockData.security.m365.securityDefaults ? (
                  <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
                ) : (
                  <XCircle className="h-8 w-8 text-red-500 mx-auto" />
                )}
                <div className="text-sm text-gray-600 mt-2">
                  Security Defaults
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderGenericView = (viewId) => {
    const view = dynamicViews.find((v) => v.id === viewId);
    if (!view) return null;

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{view.label}</h2>
            <p className="text-sm text-gray-500 mt-1">
              Data from:{" "}
              {view.integrations
                ?.map((i) => globalIntegrations[i]?.name)
                .join(", ")}
            </p>
          </div>
          <div className="flex space-x-2">
            {view.integrations?.map((integrationKey) => (
              <IntegrationBadge
                key={integrationKey}
                integrationKey={integrationKey}
              />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border p-8">
          <div className="text-center">
            <view.icon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {view.label} Management
            </h3>
            <p className="text-gray-500 mb-6">
              This section aggregates {view.label.toLowerCase()} data from{" "}
              {view.integrations?.length} integration
              {view.integrations?.length !== 1 ? "s" : ""}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {view.integrations?.map((integrationKey) => (
                <div
                  key={integrationKey}
                  className="flex items-center bg-gray-100 px-3 py-2 rounded-lg"
                >
                  <span className="text-sm">
                    {globalIntegrations[integrationKey].name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeView) {
      case "overview":
        return renderOverview();
      case "endpoints":
        return renderEndpoints();
      case "security":
        return renderSecurity();
      default:
        return renderGenericView(activeView);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">MSP Portal</h1>
        </div>

        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full p-2 text-sm border rounded-lg appearance-none bg-white"
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {currentClient?.integrations.length} integrations •{" "}
            {currentClient?.endpoints} assets
          </div>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {dynamicViews.map((view) => (
              <li key={view.id}>
                <button
                  onClick={() => setActiveView(view.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${
                    activeView === view.id
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center">
                    <view.icon className="h-5 w-5 mr-3" />
                    {view.label}
                  </div>
                  {view.count && (
                    <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full">
                      {view.count}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => setActiveView("integrations")}
            className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <Settings className="h-5 w-5 mr-3" />
            Manage Integrations
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-2xl font-bold text-gray-900">
                {currentClient?.name}
              </h2>
              <div className="flex items-center text-sm text-gray-500">
                <Activity className="h-4 w-4 mr-1" />
                Last sync: 5 minutes ago
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button className="p-2 text-gray-400 hover:text-gray-600">
                <Bell className="h-5 w-5" />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600">
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">{renderContent()}</main>
      </div>
    </div>
  );
};

export default MSPDashboard;
