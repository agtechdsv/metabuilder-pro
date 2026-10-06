/**
 * Módulos que o código de componente gerado pela IA pode importar (o "require" do sandbox do AIGeneratedViewRenderer).
 * Fica separado do componente React para ser testado: um módulo que some daqui faz o componente gerado quebrar com
 * "React error #130" (objeto no lugar do componente), como já aconteceu com o Modal.
 */
export interface SandboxModules {
  React: any
  lucide: any
  Modal: any
  /** cliente de dados do sandbox (estável entre renderizações) */
  client: any
  /** { toast, addToast } estável entre renderizações */
  toast: any
  /** { t } estável entre renderizações */
  i18n: any
}

export function createSandboxRequire(m: SandboxModules) {
  const supabaseClient = { createClient: () => m.client }
  const toastModule = { useToast: () => m.toast }
  const modalModule = { __esModule: true, default: m.Modal, Modal: m.Modal }
  const i18nModule = { useI18n: () => m.i18n }
  return (modName: string): any => {
    if (modName === 'react') return m.React
    if (modName === 'lucide-react') return m.lucide
    if (modName === '@/utils/supabase/client') return supabaseClient
    if (modName === '@/components/ui/Toast') return toastModule
    if (modName === '@/components/ui/Modal') return modalModule
    if (modName.includes('i18n')) return i18nModule
    return {}
  }
}
