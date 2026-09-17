/**
 * Helper to safely resolve database schema names across any project model/table.
 * Supports case-insensitive table matching (crucial for Oracle/Postgres parity).
 * Avoids falling back to project slug which breaks tunnel queries.
 */

export function getModelSchemaName(
  project: any,
  tableNameOrModelName?: string,
  defaultFallback: string = 'public'
): string {
  if (!project) return defaultFallback;

  const models: any[] = Array.isArray(project.models) ? project.models : [];

  if (tableNameOrModelName && models.length > 0) {
    const target = String(tableNameOrModelName).trim().toLowerCase();
    const matchedModel = models.find((m: any) => {
      const dbTable = String(m.db_table_name || '').trim().toLowerCase();
      const modelName = String(m.name || '').trim().toLowerCase();
      const modelId = String(m.id || '').trim();
      return dbTable === target || modelName === target || modelId === String(tableNameOrModelName).trim();
    });

    if (matchedModel?.db_schema_name && String(matchedModel.db_schema_name).trim() !== '') {
      return matchedModel.db_schema_name;
    }
  }

  // Fallback 1: check if ANY model in this project has a valid db_schema_name
  const anyModelWithSchema = models.find((m: any) => m.db_schema_name && String(m.db_schema_name).trim() !== '');
  if (anyModelWithSchema?.db_schema_name) {
    return anyModelWithSchema.db_schema_name;
  }

  return defaultFallback;
}
