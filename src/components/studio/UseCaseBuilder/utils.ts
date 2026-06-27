// ─── Pure utility functions shared across wizard steps ──────────────────────
// Previously duplicated 3× inside UseCaseBuilderWizard.tsx (lines 418, 2202, 2936)

import type { Field, FieldMeta, Model } from './types'

/**
 * Converts a raw database column name or display name into a human-readable
 * title-cased label. Also removes trailing "_id" / "Id" suffixes.
 *
 * @example
 * formatLabelText('user_id')     // → 'User'
 * formatLabelText('firstName')   // → 'First Name'
 * formatLabelText('id')          // → 'ID'
 */
export function formatLabelText(text: string): string {
  if (!text) return ''
  if (text.toLowerCase() === 'id') return 'ID'

  // Remove trailing _id / Id
  let formatted = text.replace(/_id$/i, '').replace(/Id$/i, '')
  if (formatted.trim() === '') formatted = text

  // Underscores → spaces
  formatted = formatted.replace(/_/g, ' ')

  // camelCase / PascalCase → spaces
  formatted = formatted.replace(/([a-z])([A-Z])/g, '$1 $2')

  // Title Case
  return formatted
    .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase())
    .trim()
}

/**
 * Looks up a field by its `id` across all loaded models and returns a
 * human-readable name using `formatLabelText`.
 * Falls back to formatting the raw `id` if not found.
 */
export function getFormattedFieldName(id: string, models: Model[]): string {
  for (const m of models) {
    const f = (m.fields ?? []).find((f: Field) => f.id === id)
    if (f) return formatLabelText(f.display_name || f.db_column_name)
  }
  return formatLabelText(id)
}

/**
 * Creates a sensible default `FieldMeta` object for a field that has not been
 * explicitly configured yet. Used when saving/publishing to populate missing
 * metadata entries.
 */
export function createDefaultFieldMeta(fid: string, models: Model[]): FieldMeta {
  let dbDefaults = null

  for (const m of models) {
    const f = (m.fields ?? []).find((f: Field) => f.id === fid)
    if (f && f.widget_options && Object.keys(f.widget_options).length > 0) {
      dbDefaults = f.widget_options
      break
    }
  }

  const baseMeta: FieldMeta = {
    label: {
      text: getFormattedFieldName(fid, models),
      font: 'Inter',
      size: '10px',
      color: ''
    },
    content: {
      font: 'Inter',
      size: '12px',
      color: '',
      mask: '',
      required: false,
      readonly: false
    },
    component: {
      type: 'text',
      rows: 3,
      width: '100%',
      options_type: 'fixed',
      fixed_options: '',
      rel_table: '',
      rel_label: '',
      rel_value: ''
    },
    viacep: {
      enabled: false,
      logradouro: '',
      bairro: '',
      cidade: '',
      uf: ''
    }
  }

  // Se houver defaults salvos no DB, faz o merge profundo (para os níveis principais)
  if (dbDefaults) {
    return {
      ...baseMeta,
      ...dbDefaults,
      label: { ...baseMeta.label, ...(dbDefaults.label || {}) },
      content: { ...baseMeta.content, ...(dbDefaults.content || {}) },
      component: { ...baseMeta.component, ...(dbDefaults.component || {}) },
      viacep: { ...baseMeta.viacep, ...(dbDefaults.viacep || {}) }
    }
  }

  return baseMeta
}

/**
 * Generates a slug-safe string from a human-readable name.
 * Handles accented characters, spaces and special characters.
 *
 * @example
 * slugify('Gestão de Contratos') // → 'gestao-de-contratos'
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

/**
 * Returns the default buttons_config array that is used both when creating
 * a new use case and when merging with an existing one.
 * Accepts a `t` translation function to keep labels i18n-aware.
 */
export function buildDefaultButtonsConfig(
  t: (key: string, fallback?: string) => string
) {
  return [
    { id: 'search', label: t('runtime.search'), labelKey: 'runtime.search', icon: 'search', action: 'search', visible: true },
    { id: 'clear', label: t('runtime.clear'), labelKey: 'runtime.clear', icon: 'refresh-ccw', action: 'clear', visible: true },
    { id: 'view', label: t('runtime.view'), labelKey: 'runtime.view', icon: 'search', action: 'view', visible: true },
    { id: 'add', label: t('runtime.new_record'), labelKey: 'runtime.new_record', icon: 'plus', action: 'create', visible: true },
    { id: 'edit', label: t('runtime.edit'), labelKey: 'runtime.edit', icon: 'pencil', action: 'pencil', action_key: 'update', visible: true },
    { id: 'delete', label: t('runtime.delete'), labelKey: 'runtime.delete', icon: 'trash', action_key: 'delete', visible: true },
    { id: 'export', label: 'Exportar Dados', labelKey: 'runtime.export', icon: 'download', action: 'export', visible: true }
  ]
}

/**
 * Merges an existing `buttons_config` from saved data with the defaults,
 * ensuring all default IDs exist while preserving user-customised states.
 */
export function mergeButtonsConfig(
  savedButtons: any[] | undefined,
  defaults: ReturnType<typeof buildDefaultButtonsConfig>
) {
  if (!savedButtons) return defaults
  return defaults.map(def => {
    const existing = savedButtons.find((b: any) => b.id === def.id)
    return existing ? { ...def, ...existing } : { ...def, visible: def.id === 'export' ? true : false }
  })
}
