"use server";

import { getRows, updateRow } from "@/lib/supabase/orm";
import { revalidatePath } from "next/cache";

export async function disableIntegration(integrationId: string): Promise<{
  success: boolean;
  error?: string;
  disabledCount?: number;
}> {
  try {
    // First, get all active data_sources for this integration
    const { data: dataSources, error: fetchError } = await getRows("data_sources", {
      filters: [
        ["integration_id", "eq", integrationId],
        ["status", "neq", "disabled"], // Only get non-disabled sources
      ],
    });

    if (fetchError) {
      return { success: false, error: "Failed to fetch data sources" };
    }

    if (!dataSources?.rows || dataSources.rows.length === 0) {
      return { success: false, error: "No active data sources found to disable" };
    }

    // Update each data source status to 'disabled'
    const updatePromises = dataSources.rows.map((dataSource: any) =>
      updateRow("data_sources", {
        id: dataSource.id,
        row: {
          ...dataSource,
          status: "disabled",
          updated_at: new Date().toISOString(),
        }
      })
    );

    const updateResults = await Promise.allSettled(updatePromises);

    // Check if any updates failed
    const failedUpdates = updateResults.filter(result =>
      result.status === 'rejected' ||
      (result.status === 'fulfilled' && result.value.error)
    );

    if (failedUpdates.length > 0) {
      return {
        success: false,
        error: `Failed to disable ${failedUpdates.length} data sources`
      };
    }

    // Revalidate the integration page
    revalidatePath(`/integrations/${integrationId}`);

    return {
      success: true,
      disabledCount: dataSources.rows.length,
    };
  } catch (error) {
    console.error("Error disabling integration:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function getDataSourcesCount(integrationId: string): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> {
  try {
    const { data: dataSources, error } = await getRows("data_sources", {
      filters: [
        ["integration_id", "eq", integrationId],
        ["status", "neq", "disabled"], // Only count active sources
      ],
    });

    if (error) {
      return { success: false, error: "Failed to count data sources" };
    }

    return {
      success: true,
      count: dataSources?.total || 0,
    };
  } catch (error) {
    console.error("Error counting data sources:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}