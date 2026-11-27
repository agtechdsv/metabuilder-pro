/**
 * O que de um fluxo BPM vai no app exportado (Node + PostgreSQL/Oracle; ver docs/bpm-exportacao-desenho.md).
 * Regra pura, usada pelo selo "Vai no app exportado" do Studio.
 */

/** Gatilhos que o app exportado executa. */
export const EXPORTED_TRIGGER_TYPES = ['INSERT', 'UPDATE', 'DELETE', 'BEFORE_INSERT', 'BEFORE_UPDATE', 'BEFORE_DELETE', 'SCHEDULED', 'WEBHOOK'] as const

export type ExportLevel = 'full' | 'partial' | 'none'

export interface ExportSupport {
  level: ExportLevel
  /** gatilhos que o app exportado executa */
  supported: string[]
  /** gatilhos que ficam de fora (ex.: ON_LOAD) */
  unsupported: string[]
  /** avisos sobre partes do fluxo que se comportam diferente no app exportado */
  warnings: Array<'email_system_recipients' | 'approval' | 'download'>
}

const typesOf = (node: any): string[] => {
  const raw = node?.data?.triggerType
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((t: any) => String(t).toUpperCase())
}

export function bpmExportSupport(nodes: any[] | null | undefined): ExportSupport {
  const supported = new Set<string>()
  const unsupported = new Set<string>()
  const warnings = new Set<'email_system_recipients' | 'approval' | 'download'>()
  for (const node of nodes || []) {
    if (node?.type === 'trigger') {
      for (const t of typesOf(node)) ((EXPORTED_TRIGGER_TYPES as readonly string[]).includes(t) ? supported : unsupported).add(t)
    }
    // "Aguardar aprovação" e "Download" só existem no Agente CLI (tarefas e Central de Downloads): no app exportado o fluxo para nesse passo, com aviso
    if (node?.type === 'approval') warnings.add('approval')
    if (node?.type === 'action' && node.data?.actionType === 'download') warnings.add('download')
    if (node?.type === 'action' && node.data?.actionType === 'email' && (node.data.emailRecipientType || 'system') === 'system') warnings.add('email_system_recipients')
  }
  const level: ExportLevel = supported.size === 0 ? 'none' : unsupported.size > 0 ? 'partial' : 'full'
  return { level, supported: [...supported].sort(), unsupported: [...unsupported].sort(), warnings: [...warnings] }
}
