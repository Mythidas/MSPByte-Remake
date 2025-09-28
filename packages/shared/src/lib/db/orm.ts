import { createPrivelagedClient } from "@workspace/shared/lib/db/client.js";
import {
  internalGetRow,
  internalGetRows,
  internalGetRowsCount,
  internalInsertRows,
  internalUpdateRow,
  internalUpsertRows,
  internalDeleteRows,
} from "@workspace/shared/lib/db/orm-internal.js";
import {
  TableOrView,
  GetRowConfig,
  GetRowCountConfig,
  Table,
  InsertRowConfig,
  UpdateRowConfig,
  UpsertRowConfig,
  DeleteRowConfig,
} from "@workspace/shared/types/database/index.js";

export async function getRow<T extends TableOrView>(
  table: T,
  config?: GetRowConfig<T>
) {
  const supabase = createPrivelagedClient();
  return internalGetRow(supabase, table, config);
}

export async function getRows<T extends TableOrView>(
  table: T,
  config?: GetRowConfig<T>
) {
  const supabase = createPrivelagedClient();
  return internalGetRows(supabase, table, config);
}

export async function getRowsCount<T extends TableOrView>(
  table: T,
  config?: GetRowCountConfig<T>
) {
  const supabase = createPrivelagedClient();
  return internalGetRowsCount(supabase, table, config);
}

export async function insertRows<T extends Table>(
  table: T,
  config: InsertRowConfig<T>
) {
  const supabase = createPrivelagedClient();
  return internalInsertRows(supabase, table, config);
}

export async function updateRow<T extends Table>(
  table: T,
  config: UpdateRowConfig<T>
) {
  const supabase = createPrivelagedClient();
  return internalUpdateRow(supabase, table, config);
}

export async function upsertRows<T extends Table>(
  table: T,
  config: UpsertRowConfig<T>
) {
  const supabase = createPrivelagedClient();
  return internalUpsertRows(supabase, table, config);
}

export async function deleteRows<T extends Table>(
  table: T,
  config: DeleteRowConfig<T>
) {
  const supabase = createPrivelagedClient();
  return internalDeleteRows(supabase, table, config);
}
