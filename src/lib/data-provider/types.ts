export interface QueryOptions {
  modelName: string;
  filters?: Record<string, any>;
  orderBy?: { column: string; ascending: boolean };
  pagination?: { page: number; limit: number };
  joins?: any[];
}

export interface MutationOptions {
  modelName: string;
  primaryKeyName: string;
  primaryKeyValue?: any;
  data: Record<string, any>;
}

export interface DataProvider {
  /**
   * Identifies the provider type (e.g., 'tunnel', 'supabase-sdk', 'postgres-api')
   */
  type: string;

  /**
   * Fetch data based on query options.
   */
  fetchData: (options: QueryOptions) => Promise<{ data: any[]; total: number }>;

  /**
   * Insert a new record.
   */
  insertData: (options: MutationOptions) => Promise<{ data: any[] }>;

  /**
   * Update an existing record.
   */
  updateData: (options: MutationOptions) => Promise<{ data: any[] }>;

  /**
   * Delete a record.
   */
  deleteData: (options: MutationOptions) => Promise<void>;
}
