const fs = require('fs');

let content = fs.readFileSync('src/components/workspace/ProjectManager.tsx', 'utf8');

// 1. Add workspaceThemeConfig to ProjectManagerProps
content = content.replace(
  'showTeamSettings?: boolean',
  'showTeamSettings?: boolean\n  workspaceThemeConfig?: any'
);

// 2. Add theme_config to Project interface
content = content.replace(
  'can_delete?: boolean\n}',
  'can_delete?: boolean\n  theme_config?: any\n}'
);

// 3. Add workspaceThemeConfig to destructured props
content = content.replace(
  '  showTeamSettings = true\n}: ProjectManagerProps) {',
  '  showTeamSettings = true,\n  workspaceThemeConfig = {}\n}: ProjectManagerProps) {'
);

// 4. Add state for workspace portal toggle
content = content.replace(
  'const [navigatingSlug, setNavigatingSlug] = useState<string | null>(null)',
  `const [navigatingSlug, setNavigatingSlug] = useState<string | null>(null)
  const [portalEnabled, setPortalEnabled] = useState(workspaceThemeConfig?.portal_enabled || false)
  const [isTogglingPortal, setIsTogglingPortal] = useState(false)`
);

// 5. Update formData state
content = content.replace(
  "const [formData, setFormData] = useState({ name: '', slug: '', description: '', icon: '', is_active: true })",
  "const [formData, setFormData] = useState({ name: '', slug: '', description: '', icon: '', is_active: true, show_in_portal: false, login_logo_url: '', login_banner_url: '' })"
);

// 6. Update openDrawer and closeDrawer
content = content.replace(
  /setFormData\(project\s*\?\s*\{\s*name: project\.name,[\s\S]*?is_active: project\.is_active\s*\}\s*:\s*\{ name: '', slug: '', description: '', icon: '', is_active: true \}\s*\)/m,
  `setFormData(project
      ? {
        name: project.name,
        slug: project.slug,
        description: project.description || '',
        icon: project.icon || '',
        is_active: project.is_active,
        show_in_portal: project.theme_config?.show_in_portal || false,
        login_logo_url: project.theme_config?.login_logo_url || '',
        login_banner_url: project.theme_config?.login_banner_url || ''
      }
      : { name: '', slug: '', description: '', icon: '', is_active: true, show_in_portal: false, login_logo_url: '', login_banner_url: '' }
    )`
);

content = content.replace(
  "setFormData({ name: '', slug: '', description: '', icon: '', is_active: true })",
  "setFormData({ name: '', slug: '', description: '', icon: '', is_active: true, show_in_portal: false, login_logo_url: '', login_banner_url: '' })"
);

// 7. Update handleSave to save theme_config
content = content.replace(
  /is_active: formData\.is_active\s*\}\)/g,
  `is_active: formData.is_active,
            theme_config: { ...(selectedProject ? selectedProject.theme_config : { enable_downloads: true }), show_in_portal: formData.show_in_portal, login_logo_url: formData.login_logo_url, login_banner_url: formData.login_banner_url }
          })`
);

content = content.replace(
  /is_active: true,\s*theme_config: \{ enable_downloads: true \}/g,
  `is_active: true,
            theme_config: { enable_downloads: true, show_in_portal: formData.show_in_portal, login_logo_url: formData.login_logo_url, login_banner_url: formData.login_banner_url }`
);

// 8. Add workspace portal toggle handler
const toggleWorkspacePortalCode = `
  const toggleWorkspacePortal = async () => {
    setIsTogglingPortal(true)
    const newStatus = !portalEnabled
    try {
      const { error } = await supabase
        .from('workspaces')
        .update({ theme_config: { ...workspaceThemeConfig, portal_enabled: newStatus } })
        .eq('id', workspaceId)

      if (error) throw error
      setPortalEnabled(newStatus)
      toast(newStatus ? 'Portal de Aplicações ativado' : 'Portal de Aplicações desativado', 'success')
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast(err.message || 'Erro ao alterar portal da workspace', 'error')
    } finally {
      setIsTogglingPortal(false)
    }
  }

  const toggleProjectPortal = async (project: Project) => {
    const newStatus = !(project.theme_config?.show_in_portal)
    const newThemeConfig = { ...(project.theme_config || {}), show_in_portal: newStatus }
    try {
      const { error } = await supabase
        .from('projects')
        .update({ theme_config: newThemeConfig })
        .eq('id', project.id)

      if (error) throw error
      setProjects(projects.map(p => p.id === project.id ? { ...p, theme_config: newThemeConfig } : p))
      toast(newStatus ? 'Projeto adicionado ao Portal' : 'Projeto removido do Portal', 'success')
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast(err.message || 'Erro ao atualizar projeto', 'error')
    }
  }
`;
content = content.replace('  const toggleActive = async (project: Project) => {', toggleWorkspacePortalCode + '\n  const toggleActive = async (project: Project) => {');

// 9. UI: Add Workspace toggle
content = content.replace(
  /<button\s*onClick=\{handleRefresh\}/,
  `{canCreate && (
              <div className="flex items-center gap-3 mr-4 border-r dark:border-neutral-800 pr-4">
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest hidden sm:block">Portal de Aplicações</span>
                <button
                  onClick={toggleWorkspacePortal}
                  disabled={isTogglingPortal}
                  className={\`w-12 h-6 rounded-full transition-all relative \${portalEnabled ? 'bg-indigo-600' : 'bg-neutral-300 dark:bg-neutral-800'} \${isTogglingPortal ? 'opacity-50 cursor-not-allowed' : ''}\`}
                  title={portalEnabled ? 'Desativar Portal' : 'Ativar Portal'}
                >
                  <div className={\`absolute top-1 w-4 h-4 bg-white rounded-full transition-all \${portalEnabled ? 'right-1' : 'left-1'}\`} />
                </button>
              </div>
            )}
            <button
              onClick={handleRefresh}`
);

// 10. UI: Add Quick Toggle Icon to Project Card
content = content.replace(
  /\{project\.can_edit && \(/,
  `{portalEnabled && (
                            <button
                              onClick={(e) => { e.preventDefault(); toggleProjectPortal(project); }}
                              className={\`p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors \${project.theme_config?.show_in_portal ? 'text-indigo-500 hover:text-indigo-600' : 'text-neutral-400 hover:text-indigo-400'}\`}
                              title={project.theme_config?.show_in_portal ? 'Remover do Portal' : 'Adicionar ao Portal'}
                            >
                              <Database className="w-4 h-4" />
                            </button>
                          )}
                          {project.can_edit && (`
);

// 11. UI: Add Drawer section for Branding
const drawerBrandingCode = `
            {portalEnabled && (
              <div className="pt-6 border-t border-neutral-100 dark:border-neutral-800 space-y-6">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Portal & Branding</h4>
                  <p className="text-xs text-neutral-500">Configure a exibição deste projeto no Portal de Aplicações e a personalização da tela de login.</p>
                </div>

                <div className="flex items-center gap-3 bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/20 p-4 rounded-xl">
                  <input
                    type="checkbox"
                    id="showInPortal"
                    checked={formData.show_in_portal}
                    onChange={(e) => setFormData({ ...formData, show_in_portal: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-neutral-300 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="showInPortal" className="text-sm font-medium text-neutral-900 dark:text-white cursor-pointer select-none">
                    Exibir no Portal de Aplicações
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">URL da Logo (Opcional)</label>
                  <input
                    type="url"
                    value={formData.login_logo_url}
                    onChange={e => setFormData({ ...formData, login_logo_url: e.target.value })}
                    placeholder="https://sua-empresa.com/logo.png"
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all text-neutral-900 dark:text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">URL do Banner (Opcional)</label>
                  <input
                    type="url"
                    value={formData.login_banner_url}
                    onChange={e => setFormData({ ...formData, login_banner_url: e.target.value })}
                    placeholder="https://sua-empresa.com/banner.jpg"
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all text-neutral-900 dark:text-white"
                  />
                  <p className="text-[10px] text-neutral-500 dark:text-neutral-600">Recomendado: Imagem vertical ou padrão geométrico.</p>
                </div>
              </div>
            )}
`;
content = content.replace(
  /\{selectedProject && \(\s*<div className="pt-4 flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-950 rounded-xl border border-neutral-200 dark:border-neutral-800">/,
  drawerBrandingCode + '\n            {selectedProject && (\n              <div className="pt-4 flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-950 rounded-xl border border-neutral-200 dark:border-neutral-800">'
);

fs.writeFileSync('src/components/workspace/ProjectManager.tsx', content);
console.log('ProjectManager.tsx updated.');
