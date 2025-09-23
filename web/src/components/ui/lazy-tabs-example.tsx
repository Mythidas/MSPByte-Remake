"use client";

import React from "react";
import {
  LazyTabs,
  LazyTabsContent,
  TabsList,
  TabsTrigger,
  useIsTabActive,
  useLoadedTabs,
} from "@/components/ui/lazy-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Example component demonstrating heavy computation
function HeavyComponent({ tabName }: { tabName: string }) {
  // Simulate heavy computation
  const data = React.useMemo(() => {
    console.log(`Loading heavy data for ${tabName}...`);
    return Array.from({ length: 1000 }, (_, i) => `${tabName} Item ${i + 1}`);
  }, [tabName]);

  const isActive = useIsTabActive(tabName);
  const loadedTabs = useLoadedTabs();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tabName} Content</CardTitle>
        <p className="text-sm text-muted-foreground">
          Status: {isActive ? "Active" : "Inactive"} |
          Loaded tabs: {loadedTabs.join(", ")}
        </p>
      </CardHeader>
      <CardContent>
        <p className="mb-4">
          This content was lazily loaded! Check the console to see when it loaded.
        </p>
        <div className="max-h-40 overflow-y-auto">
          {data.slice(0, 50).map((item) => (
            <div key={item} className="p-1 text-sm">
              {item}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Example: Basic lazy tabs
export function BasicLazyTabsExample() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Basic Lazy Tabs</h3>
      <LazyTabs id="basic-example" defaultValue="tab1" urlParam="basic-tab">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          <TabsTrigger value="tab3">Tab 3</TabsTrigger>
        </TabsList>

        <LazyTabsContent value="tab1">
          <HeavyComponent tabName="Tab 1" />
        </LazyTabsContent>

        <LazyTabsContent value="tab2">
          <HeavyComponent tabName="Tab 2" />
        </LazyTabsContent>

        <LazyTabsContent value="tab3">
          <HeavyComponent tabName="Tab 3" />
        </LazyTabsContent>
      </LazyTabs>
    </div>
  );
}

// Example: Non-lazy tabs (all content rendered immediately)
export function NonLazyTabsExample() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Non-Lazy Tabs (All Content Rendered)</h3>
      <LazyTabs id="non-lazy-example" defaultValue="tab1" lazy={false} urlParam="non-lazy-tab">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          <TabsTrigger value="tab3">Tab 3</TabsTrigger>
        </TabsList>

        <LazyTabsContent value="tab1">
          <HeavyComponent tabName="Tab 1 (Non-lazy)" />
        </LazyTabsContent>

        <LazyTabsContent value="tab2">
          <HeavyComponent tabName="Tab 2 (Non-lazy)" />
        </LazyTabsContent>

        <LazyTabsContent value="tab3">
          <HeavyComponent tabName="Tab 3 (Non-lazy)" />
        </LazyTabsContent>
      </LazyTabs>
    </div>
  );
}

// Example: Mixed rendering (some tabs forced to render)
export function MixedRenderingExample() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Mixed Rendering</h3>
      <LazyTabs id="mixed-example" defaultValue="tab1" urlParam="mixed-tab">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1 (Lazy)</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2 (Force Render)</TabsTrigger>
          <TabsTrigger value="tab3">Tab 3 (Lazy)</TabsTrigger>
        </TabsList>

        <LazyTabsContent value="tab1">
          <HeavyComponent tabName="Tab 1 (Lazy)" />
        </LazyTabsContent>

        <LazyTabsContent value="tab2" forceRender>
          <HeavyComponent tabName="Tab 2 (Force Rendered)" />
        </LazyTabsContent>

        <LazyTabsContent value="tab3">
          <HeavyComponent tabName="Tab 3 (Lazy)" />
        </LazyTabsContent>
      </LazyTabs>
    </div>
  );
}

// Complete example with all features
export function CompleteLazyTabsExample() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">Lazy Tabs Examples</h2>
        <p className="text-muted-foreground mb-6">
          These examples demonstrate different lazy loading behaviors.
          Check the browser console to see when components load, and notice how the URL changes.
        </p>
      </div>

      <BasicLazyTabsExample />

      <NonLazyTabsExample />

      <MixedRenderingExample />

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h4 className="font-semibold mb-2">Features:</h4>
        <ul className="text-sm space-y-1 list-disc list-inside">
          <li>✅ URL persistence - share URLs with active tab</li>
          <li>✅ Lazy loading - components only render when needed</li>
          <li>✅ Memory of loaded tabs - once loaded, stays in memory</li>
          <li>✅ Force render option - override lazy behavior per tab</li>
          <li>✅ Disable lazy loading globally per tabs instance</li>
          <li>✅ Custom URL parameter names for multiple tab instances</li>
          <li>✅ TypeScript support with helpful hooks</li>
        </ul>
      </div>
    </div>
  );
}