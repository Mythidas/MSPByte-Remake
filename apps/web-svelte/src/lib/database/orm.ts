'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
	internalDeleteRows,
	internalGetRow,
	internalGetRows,
	internalGetRowsCount,
	internalInsertRows,
	internalUpdateRow,
	internalUpsertRows
} from '$shared/lib/db/orm-internal.js';
import type { Database } from '$shared/types/database/import.js';
import type {
	Table,
	TableOrView,
	GetRowConfig,
	GetRowCountConfig,
	InsertRowConfig,
	UpdateRowConfig,
	UpsertRowConfig,
	DeleteRowConfig,
	Tables
} from '$shared/types/database/index.js';
import type { APIResponse } from '$shared/types/api.js';

export class ORM {
	constructor(private supabase: SupabaseClient<Database>) {}

	async getRow<T extends TableOrView>(
		table: T,
		config?: GetRowConfig<T>
	): Promise<APIResponse<Tables<T>>> {
		return internalGetRow(this.supabase, table, config);
	}

	async getRows<T extends TableOrView>(table: T, config?: GetRowConfig<T>) {
		return internalGetRows(this.supabase, table, config);
	}

	async getRowsCount<T extends TableOrView>(table: T, config?: GetRowCountConfig<T>) {
		return internalGetRowsCount(this.supabase, table, config);
	}

	async insertRows<T extends Table>(table: T, config: InsertRowConfig<T>) {
		return internalInsertRows(this.supabase, table, config);
	}

	async updateRow<T extends Table>(table: T, config: UpdateRowConfig<T>) {
		return internalUpdateRow(this.supabase, table, config);
	}

	async upsertRows<T extends Table>(table: T, config: UpsertRowConfig<T>) {
		return internalUpsertRows(this.supabase, table, config);
	}

	async deleteRows<T extends Table>(table: T, config: DeleteRowConfig<T>) {
		return internalDeleteRows(this.supabase, table, config);
	}
}
