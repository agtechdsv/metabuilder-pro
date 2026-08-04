/**
 * field-resolver.ts
 *
 * Utilitário centralizado para resolver valores e definições de campos a partir de 
 * configurações de view que podem ser strings simples (legacy) ou objetos JSON
 * contendo relacionamentos (relation_path, target_field_id).
 */

export function resolveDynamicFieldDef(
  configValue: string | null | undefined,
  fields: any[],
  tableName?: string
): any | null {
  if (!configValue) return null;

  try {
    // 1. Tentar parsear o config como JSON (The True Ultimate Fallback)
    if (typeof configValue === 'string' && configValue.startsWith('{')) {
      const parsedConfig = JSON.parse(configValue);
      
      let localFieldId = parsedConfig.target_field_id;
      if (parsedConfig.relation_path && parsedConfig.relation_path.length > 0) {
        localFieldId = parsedConfig.relation_path[0].foreign_column_id;
      }

      if (localFieldId) {
        const field = fields.find((f: any) => String(f.id) === String(localFieldId));
        
        // Se houver tableName fornecido, valida se o campo pertence a esta tabela.
        // Se não houver, assume que o array de fields já está escopado para a view atual.
        if (field && tableName) {
          const targetTbl = (tableName || '').toLowerCase().replace(/["']/g, '').split('.').pop();
          const fTbl = (field.model_name || field.table_name || '').toLowerCase().replace(/["']/g, '').split('.').pop();
          
          if (fTbl === targetTbl) {
            return field;
          }
        } else if (field) {
          return field;
        }
      }
    }
  } catch (e) {
    console.warn('[FieldResolver] Erro ao fazer parse da configuração JSON do campo:', e);
  }

  // 2. Fallback antigo: tentar buscar diretamente pelo ID do campo
  // (Caso a config salva seja apenas o UUID do campo)
  const directField = fields.find(f => String(f.id) === configValue);
  if (directField) {
    return directField;
  }

  // 3. Fallback antiquíssimo: string bruta por db_column_name (ex: 'NOME')
  if (typeof configValue === 'string' && !configValue.startsWith('{')) {
      const legacyField = fields.find(f => 
          (f.db_column_name || '').toLowerCase() === configValue.toLowerCase() ||
          (f.db_column_name || '').toLowerCase().split('.').pop() === configValue.toLowerCase()
      );
      if (legacyField) return legacyField;
  }

  return null;
}

export function extractRawValue(
  configValue: string | null | undefined,
  row: any,
  fieldDef: any | null
): any {
  if (!row) return undefined;

  // 1. Especial para o RecordForm: dados relacionais chegam preenchidos na key virt_UUID_DO_CAMPO
  let parsedLabelFallback: string | null = null;
  if (typeof configValue === 'string' && configValue.startsWith('{')) {
    try {
      const parsedConfig = JSON.parse(configValue);
      parsedLabelFallback = parsedConfig.display_label;

      let localFieldId = parsedConfig.target_field_id;
      if (parsedConfig.relation_path && parsedConfig.relation_path.length > 0) {
        localFieldId = parsedConfig.relation_path[0].foreign_column_id;
      }
      
      if (localFieldId && row[`virt_${localFieldId}`] !== undefined) {
        return row[`virt_${localFieldId}`];
      }
    } catch (e) {
      console.warn('[FieldResolver] Erro ao extrair valor virt_:', e);
    }
  }

  // 2. Fallback normal: se conseguimos resolver o fieldDef, usamos o db_column_name, senão tentamos o display_label do JSON
  const rawColName = fieldDef?.db_column_name || parsedLabelFallback;
  if (rawColName) {
    const colName = rawColName.includes('.') ? rawColName.split('.').pop() || rawColName : rawColName;
    return row[colName] ?? row[colName.toUpperCase()] ?? row[colName.toLowerCase()];
  }

  // Fallback: se configValue não for JSON, pode ser o próprio nome da coluna legado
  if (typeof configValue === 'string' && !configValue.startsWith('{')) {
    const getVal = (r: any, key: string) => {
      if (!r) return undefined;
      const lowerKey = key.toLowerCase();
      return r[key] ?? r[key.toUpperCase()] ?? r[key.toLowerCase()] ?? Object.entries(r).find(([k]) => k.toLowerCase() === lowerKey)?.[1];
    };
    
    if (configValue.includes('.')) {
      const parts = configValue.split('.');
      return getVal(row, configValue) ?? getVal(row, parts[1]);
    } else {
      return getVal(row, configValue);
    }
  }

  return undefined;
}
