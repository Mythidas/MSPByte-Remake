"use client";

import { createClient } from "@/lib/supabase/client-browser";
import {
  DeleteRowConfig,
  GetRowConfig,
  GetRowCountConfig,
  InsertRowConfig,
  Table,
  TableOrView,
  UpdateRowConfig,
  UpsertRowConfig,
} from "@workspace/shared/types/database/index";
import {
  internalDeleteRows,
  internalGetRow,
  internalGetRows,
  internalGetRowsCount,
  internalInsertRows,
  internalUpdateRow,
  internalUpsertRows,
} from "@workspace/shared/lib/db/orm-internal";

export async function getRow<T extends TableOrView>(
  table: T,
  config?: GetRowConfig<T>
) {
  const supabase = createClient();
  return internalGetRow(supabase, table, config);
}

export async function getRows<T extends TableOrView>(
  table: T,
  config?: GetRowConfig<T>
) {
  const supabase = createClient();
  return internalGetRows(supabase, table, config);
}

export async function getRowsCount<T extends TableOrView>(
  table: T,
  config?: GetRowCountConfig<T>
) {
  const supabase = createClient();
  return internalGetRowsCount(supabase, table, config);
}

export async function insertRows<T extends Table>(
  table: T,
  config: InsertRowConfig<T>
) {
  const supabase = createClient();
  return internalInsertRows(supabase, table, config);
}

export async function updateRow<T extends Table>(
  table: T,
  config: UpdateRowConfig<T>
) {
  const supabase = createClient();
  return internalUpdateRow(supabase, table, config);
}

export async function upsertRows<T extends Table>(
  table: T,
  config: UpsertRowConfig<T>
) {
  const supabase = createClient();
  return internalUpsertRows(supabase, table, config);
}

export async function deleteRows<T extends Table>(
  table: T,
  config: DeleteRowConfig<T>
) {
  const supabase = createClient();
  return internalDeleteRows(supabase, table, config);
}