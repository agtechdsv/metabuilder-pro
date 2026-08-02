import React from 'react';
import DynamicIcon from '@/components/runtime/DynamicIcon';

// Helper para obter valores de forma insensível a maiúsculas/minúsculas e tolerante a prefixos
export const getCaseInsensitiveValue = (data: any, path: string) => {
  if (!data || !path) return undefined

  // 1. Tentar busca exata no caminho
  if (data[path] !== undefined && data[path] !== null) {
    return data[path]
  }

  // 2. Tentar busca exata no baseName (ex: "data_inicio" de "agenda_compromissos.data_inicio")
  const baseName = path.split('.').pop()
  if (baseName && data[baseName] !== undefined && data[baseName] !== null) {
    return data[baseName]
  }

  // 3. Busca case-insensitive
  const lowerPath = path.toLowerCase()
  const lowerBase = baseName ? baseName.toLowerCase() : ''

  for (const key of Object.keys(data)) {
    const lowerKey = key.toLowerCase()
    if (lowerKey === lowerPath) return data[key]
    
    const keyBase = key.split('.').pop()?.toLowerCase()
    if (keyBase && (keyBase === lowerPath || (lowerBase && keyBase === lowerBase))) return data[key]
  }

  return undefined
}

export const getActionIcon = (iconName: string, className?: string) => {
  return <DynamicIcon icon={iconName} className={className || "w-4 h-4"} />
}

export const getFontFamily = (font?: string) => {
  if (!font) return undefined;
  const cleanFont = font.replace(' (Padrão)', '');
  if (cleanFont.includes('Mono')) return `"${cleanFont}", monospace`;
  return `"${cleanFont}", sans-serif`;
}

export const getFontSize = (size?: string) => {
  if (!size) return undefined;
  if (!isNaN(Number(size))) return `${size}px`;
  return size;
}

// Helper para aplicar máscara a valores (apenas para exibição)
export const applyMask = (value: any, mask: string) => {
  if (!mask || value === null || value === undefined || value === '') return value

  if (mask === '0.000') {
    const num = Number(value)
    if (!isNaN(num)) return num.toLocaleString('pt-BR')
    return value
  }

  if (mask === '0.000,00') {
    const num = Number(value)
    if (!isNaN(num)) return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return value
  }

  // Máscaras de string convencionais (ex: 000.000.000-00)
  const strVal = String(value)
  const numbers = strVal.replace(/\D/g, '')
  let maskedValue = ''
  let numberIndex = 0

  for (let i = 0; i < mask.length; i++) {
    if (numberIndex >= numbers.length) break

    if (mask[i] === '0') {
      maskedValue += numbers[numberIndex]
      numberIndex++
    } else {
      maskedValue += mask[i]
    }
  }
  return maskedValue
}

export const parseMaskedNumber = (value: string, mask: string) => {
  if (!value) return ''
  const numbers = value.replace(/\D/g, '')
  if (!numbers) return ''

  if (mask === '0.000,00') {
    return parseInt(numbers, 10) / 100
  }
  if (mask === '0.000') {
    return parseInt(numbers, 10)
  }
  return value
}

export const getActionColorClasses = (color: string) => {
  const normalized = color?.toLowerCase() || 'indigo'
  switch (normalized) {
    case 'emerald':
      return {
        text: 'text-emerald-650 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-950/30',
        border: 'border-emerald-200 dark:border-emerald-800/50',
        hover: 'hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-300'
      }
    case 'amber':
      return {
        text: 'text-amber-650 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-950/30',
        border: 'border-amber-200 dark:border-amber-800/50',
        hover: 'hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-700 dark:hover:text-amber-305'
      }
    case 'red':
      return {
        text: 'text-red-655 dark:text-red-405',
        bg: 'bg-red-50 dark:bg-red-950/30',
        border: 'border-red-200 dark:border-red-800/50',
        hover: 'hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-305'
      }
    case 'blue':
      return {
        text: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-950/30',
        border: 'border-blue-200 dark:border-blue-800/50',
        hover: 'hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-350'
      }
    case 'violet':
      return {
        text: 'text-violet-650 dark:text-violet-400',
        bg: 'bg-violet-50 dark:bg-violet-950/30',
        border: 'border-violet-200 dark:border-violet-800/50',
        hover: 'hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-700 dark:hover:text-violet-305'
      }
    case 'pink':
      return {
        text: 'text-pink-655 dark:text-pink-400',
        bg: 'bg-pink-50 dark:bg-pink-950/30',
        border: 'border-pink-200 dark:border-pink-800/50',
        hover: 'hover:bg-pink-100 dark:hover:bg-pink-900/30 hover:text-pink-700 dark:hover:text-pink-305'
      }
    case 'rose':
      return {
        text: 'text-rose-600 dark:text-rose-400',
        bg: 'bg-rose-50 dark:bg-rose-950/30',
        border: 'border-rose-200 dark:border-rose-800/50',
        hover: 'hover:bg-rose-100 dark:hover:bg-rose-900/30 hover:text-rose-700 dark:hover:text-rose-350'
      }
    case 'neutral':
    case 'gray':
      return {
        text: 'text-neutral-600 dark:text-neutral-400',
        bg: 'bg-neutral-50 dark:bg-neutral-950/30',
        border: 'border-neutral-200 dark:border-neutral-800/50',
        hover: 'hover:bg-neutral-100 dark:hover:bg-neutral-900/30 hover:text-neutral-700 dark:hover:text-neutral-300'
      }
    case 'indigo':
    default:
      return {
        text: 'text-indigo-650 dark:text-indigo-400',
        bg: 'bg-indigo-50 dark:bg-indigo-950/30',
        border: 'border-indigo-200 dark:border-indigo-800/50',
        hover: 'hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-305'
      }
  }
}

export const getBulkActionClasses = (color: string) => {
  const normalized = color?.toLowerCase() || 'indigo'
  switch (normalized) {
    case 'emerald':
      return 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
    case 'amber':
      return 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-500/20'
    case 'red':
      return 'bg-red-655 hover:bg-red-500 text-white shadow-red-500/20'
    case 'blue':
      return 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
    case 'violet':
      return 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-500/20'
    case 'pink':
      return 'bg-pink-655 hover:bg-pink-500 text-white shadow-pink-500/20'
    case 'rose':
      return 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/20'
    case 'neutral':
    case 'gray':
      return 'bg-neutral-600 hover:bg-neutral-500 text-white shadow-neutral-500/20'
    case 'indigo':
    default:
      return 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
  }
}

export const parseFixedOptions = (str: string) => {
  if (!str) return [];
  return str.split(',').map(pair => {
    if (!pair.includes(':')) return { label: pair.trim(), value: pair.trim() };
    const [label, value] = pair.split(':').map(s => s.trim());
    return { label: label || value, value: value || label };
  });
};

export const calculateEffectiveJoins = (joins: any[], projectRelations: any[], project: any, parentModel: string) => {
  let effectiveJoins = joins || [];
  if (effectiveJoins.length === 0 && projectRelations && project?.models) {
    const parentModelDef = project.models.find((m: any) => m.db_table_name?.toLowerCase() === parentModel?.toLowerCase());
    if (parentModelDef) {
      const related = projectRelations.filter((rel: any) => rel.to_model_id === parentModelDef.id || rel.master_model_id === parentModelDef.id);
      const auto = related.map((rel: any) => {
        const fromModelId = rel.from_model_id || rel.detail_model_id;
        const toModelId = rel.to_model_id || rel.master_model_id;
        const fromFieldId = rel.from_field_id || rel.foreign_column_id;
        const toFieldId = rel.to_field_id || rel.referenced_column_id;
        const childModel = project.models.find((m: any) => m.id === fromModelId);
        const childField = childModel?.fields?.find((f: any) => f.id === fromFieldId);
        const parentField = parentModelDef.fields?.find((f: any) => f.id === toFieldId);
        if (childModel && childField && parentField) {
          return {
            from: parentModelDef.db_table_name,
            localKey: parentField.db_column_name,
            to: childModel.db_table_name,
            foreignKey: childField.db_column_name
          };
        }
        return null;
      }).filter(Boolean);
      if (auto.length > 0) effectiveJoins = auto;
    }
  }
  if (effectiveJoins.length === 0 && project?.models) {
    const parentModelDef = project.models.find((m: any) => m.db_table_name?.toLowerCase() === parentModel?.toLowerCase());
    if (parentModelDef) {
      const heuristicJoins: any[] = [];
      for (const childModel of project.models) {
        if (childModel.id === parentModelDef.id) continue;
        const fkField = childModel.fields?.find((f: any) => {
          const fName = (f.db_column_name || '').toLowerCase();
          const pName = (parentModelDef.db_table_name || '').toLowerCase();
          const fTbl = (f.foreign_key_table || '').toLowerCase();
          const isFkTblMatch = fTbl === pName;
          const isFNameExact = fName === `_id`;
          const isFNameS = (pName.endsWith('s') && fName === `_id`);
          const isFNameEs = (pName.endsWith('es') && fName === `_id`);
          return isFkTblMatch || isFNameExact || isFNameS || isFNameEs;
        });
        const pkField = parentModelDef.fields?.find((f: any) => (f.db_column_name || '').toLowerCase() === 'id') || parentModelDef.fields?.[0];
        if (fkField && pkField) {
          heuristicJoins.push({
            from: parentModelDef.db_table_name,
            localKey: pkField.db_column_name,
            to: childModel.db_table_name,
            foreignKey: fkField.db_column_name
          });
        }
      }
      if (heuristicJoins.length > 0) effectiveJoins = heuristicJoins;
    }
  }
  return effectiveJoins;
};
