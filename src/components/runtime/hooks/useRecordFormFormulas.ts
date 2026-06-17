import { useEffect } from 'react'
import { evaluateFormula } from '@/lib/formulaEvaluator'

interface UseRecordFormFormulasProps {
  fields: any[]
  formData: any
  setFormData: React.Dispatch<React.SetStateAction<any>>
  masterModelName?: string
  masterModelId?: string
  project?: any
}

export function useRecordFormFormulas({
  fields,
  formData,
  setFormData,
  masterModelName,
  masterModelId,
  project
}: UseRecordFormFormulasProps) {
  useEffect(() => {
    if (!fields) return;

    let hasChanges = false;
    const newFormData = { ...formData };

    // Agrupa os detalhes pela tabela (model_name) para alimentar as funções de agregação (SOMA, etc)
    const detailsData: Record<string, any[]> = {};
    (formData._details || []).forEach((d: any) => {
      const tableName = d.model_name || d.model;
      if (tableName) {
        if (!detailsData[tableName]) detailsData[tableName] = [];
        detailsData[tableName].push(d);
      }
    });

    // Avalia todos os campos que possuem uma fórmula configurada
    fields.forEach(field => {
      const tokens = field.config?.content?.formula_tokens || [];
      if (tokens.length === 0) return;

      const mainModelName = masterModelName || project?.models?.find((m: any) => m.id === masterModelId)?.db_table_name;
      const isMasterZone = !field.model_name || !mainModelName || field.model_name.toLowerCase() === mainModelName.toLowerCase();

      if (isMasterZone) {
        const computedValue = evaluateFormula(tokens, formData, detailsData, formData, mainModelName);
        // Evita loop infinito atualizando apenas se o valor realmente mudou
        if (computedValue !== null && computedValue !== undefined && String(computedValue) !== String(formData[field.db_column_name])) {
          newFormData[field.db_column_name] = computedValue;
          hasChanges = true;
        }
      } else {
        const detailTableName = field.model_name;
        if (newFormData._details) {
          newFormData._details = newFormData._details.map((row: any) => {
            if (row.model_name?.toLowerCase() !== detailTableName?.toLowerCase() && row.model?.toLowerCase() !== detailTableName?.toLowerCase()) return row;

            const mappedRow = { ...formData, ...row };
            Object.keys(row).forEach(k => {
               mappedRow[`${detailTableName}.${k}`] = row[k];
            });

            const computedValue = evaluateFormula(tokens, mappedRow, detailsData, row, detailTableName);
            if (computedValue !== null && computedValue !== undefined && String(computedValue) !== String(row[field.db_column_name])) {
              hasChanges = true;
              return { ...row, [field.db_column_name]: computedValue };
            }
            return row;
          });
        }
      }
    });

    if (hasChanges) {
      setFormData((prev: any) => {
        const next = { ...prev };
        Object.keys(newFormData).forEach(k => {
          if (newFormData[k] !== formData[k]) {
            next[k] = newFormData[k];
          }
        });
        return next;
      });
    }
  }, [formData, fields, masterModelName, masterModelId, project]);
}
