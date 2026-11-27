/**
 * Item "Automação de processos" do menu e do dashboard do app, calculado na hora (nada é gravado no menu do projeto), como a Central de Ajuda:
 *  - quando o módulo está ativo E o usuário tem a permissão, entra como PRIMEIRO item (e, por isso, primeiro card do dashboard);
 *  - caso contrário, sai, mesmo que alguém o tenha posto à mão no menu.
 */
export const AUTOMATIONS_MENU_LABELS: Record<string, string> = {
  pt: 'Automação de processos',
  en: 'Process Automation',
  es: 'Automatización de procesos',
}

export function withAutomationsMenu(navigation: any[], show: boolean, language?: string): any[] {
  const isAutomations = (i: any) => i?.type === 'view' && String(i.target || '').toLowerCase() === 'automations'
  const strip = (items: any[]): any[] =>
    items.filter(i => !isAutomations(i)).map(i => (Array.isArray(i.children) ? { ...i, children: strip(i.children) } : i))
  const items = Array.isArray(navigation) ? strip(navigation) : []
  if (!show) return items
  const label = AUTOMATIONS_MENU_LABELS[language || ''] || AUTOMATIONS_MENU_LABELS.pt
  return [{ id: 'automations_auto', label, description: '', icon: 'Workflow', type: 'view', target: 'automations', show_dashboard: true }, ...items]
}
