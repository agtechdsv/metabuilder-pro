import { AppAST } from '../ast'

export function generateRoutes(ast: AppAST, files: Map<string, string>) {
  for (const route of ast.routes) {
    const model = ast.models.find(m => m.id === route.modelId)
    if (!model) continue
    
    // O path da rota costuma vir com '/' (ex: /usuarios), então anexamos à pasta app/(protected)
    const routeDir = `app/(protected)${route.path}`
    const visibleCols = route.components.filter(c => c.isVisible)
    
    // ==========================================
    // 1. PAGE.TSX (LISTAGEM)
    // ==========================================
    if (route.type === 'list') {
      const pageContent = `import Link from 'next/link'
import { get${model.name}List } from '@/app/actions/${model.name.toLowerCase()}'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Filter, Download, Zap, Eye, Pencil, Trash2, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react'

export default async function ${model.name}ListPage() {
  const data = await get${model.name}List()

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Cabeçalho Premium */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
             <div className="text-xl font-bold text-primary">{String('${model.name}').charAt(0)}</div>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              ${route.title}
              <span className="px-2 py-0.5 rounded-full bg-secondary text-[10px] font-semibold text-muted-foreground border border-input tracking-wider">
                {data.length} REGISTRO{data.length !== 1 ? 'S' : ''}
              </span>
            </h1>
            <p className="text-xs font-black tracking-widest text-muted-foreground mt-1 uppercase">SISTEMA METABUILDER</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="bg-background border-border text-foreground hover:text-foreground hover:bg-secondary hidden sm:flex">
            <Zap className="w-4 h-4 mr-2 text-primary" /> Automações
          </Button>
          <Button variant="outline" className="bg-background border-border text-foreground hover:text-foreground hover:bg-secondary hidden sm:flex">
            <Download className="w-4 h-4 mr-2" /> Exportar
          </Button>
          <Link href="${route.path}/new">
            <Button className="bg-primary hover:bg-primary/90 text-foreground shadow-lg shadow-primary/20 px-6 font-semibold tracking-wide">
              + Novo Registro
            </Button>
          </Link>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="p-5 bg-card border border-border rounded-2xl shadow-inner flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black tracking-widest text-muted-foreground uppercase ml-1">Pesquisa Rápida</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar registros..." className="pl-9 bg-background border-border text-foreground focus-visible:ring-primary" />
            </div>
          </div>
          <div className="space-y-1.5 hidden md:block">
            <label className="text-[10px] font-black tracking-widest text-muted-foreground uppercase ml-1">Status</label>
            <select className="flex h-10 w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background">
              <option value="">Todos os status</option>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button className="bg-secondary hover:bg-secondary/80 text-foreground flex-1 md:flex-none">
            Pesquisar
          </Button>
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground flex-1 md:flex-none">
            Limpar
          </Button>
        </div>
      </div>

      {/* Tabela Premium */}
      {/* Tabela Premium (ViewListRenderer style) */}
      <div className="bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] overflow-hidden shadow-xl dark:shadow-none backdrop-blur-sm flex flex-col w-full transition-opacity duration-300">
        <div className="overflow-x-auto overflow-y-auto max-h-[600px] custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead className="sticky top-0 z-20">
              <tr className="bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
                <th className="sticky left-0 z-30 bg-neutral-100 dark:bg-neutral-900 px-4 py-4 w-[60px] border-r border-neutral-200/50 dark:border-neutral-700/50 shadow-[4px_0_10px_rgba(0,0,0,0.03)]">
                  <input type="checkbox" className="rounded-md bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-indigo-600 focus:ring-indigo-500 transition-all" />
                </th>
                ${visibleCols.map(c => `
                <th
                  className="px-6 py-4 text-[10px] font-black text-neutral-400 dark:text-neutral-500 tracking-[0.15em] whitespace-nowrap cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-800 group/th transition-colors"
                  style={{
                    color: '${c.config?.label?.color || ''}' || undefined,
                    fontWeight: ${c.config?.label?.bold ? "'bold'" : "undefined"},
                    fontStyle: ${c.config?.label?.italic ? "'italic'" : "undefined"},
                    textTransform: ${c.config?.label?.uppercase ? "'uppercase'" : "undefined"},
                  }}
                >
                  <div className="flex items-center gap-2">
                    ${c.label}
                    <div className="opacity-0 group-hover/th:opacity-100 transition-opacity">
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </div>
                </th>`).join('\n                ')}
                <th className="sticky right-0 z-30 bg-neutral-100 dark:bg-neutral-900 px-4 py-4 text-right text-[10px] font-black text-neutral-400 dark:text-neutral-500 tracking-[0.15em] border-l border-neutral-200/50 dark:border-neutral-700/50 shadow-[-4px_0_10px_rgba(0,0,0,0.03)]">
                  AÇÕES
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
              {data.map((item: any, rowIndex: number) => {
                const getInitials = () => {
                  const val = String(item.${visibleCols[0]?.field || 'id'} || '??');
                  return val.substring(0, 2).toUpperCase();
                };
                return (
                  <tr key={item.id} className="group border-b border-neutral-100 dark:border-neutral-800/50 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className={\`sticky left-0 z-10 px-4 py-4 whitespace-nowrap w-[60px] text-center border-r border-neutral-200/50 dark:border-neutral-700/50 shadow-[4px_0_10px_rgba(0,0,0,0.03)] transition-colors \${rowIndex % 2 === 0 ? "bg-white dark:bg-neutral-900" : "bg-neutral-100/90 dark:bg-neutral-800"}\`}>
                       <input type="checkbox" className="rounded-md bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-indigo-600 focus:ring-indigo-500 opacity-50 group-hover:opacity-100 transition-all" />
                    </td>
                    ${visibleCols.map((c, idx) => {
                      if (c.field.toLowerCase().includes('status') || c.field.toLowerCase().includes('ativo') || c.field.toLowerCase().includes('state')) {
                        return `<td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800/50">
                            {String(item.${c.field} ?? '-')}
                          </span>
                        </td>`
                      }
                      return `<td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                        {String(item.${c.field} ?? '-')}
                      </td>`
                    }).join('\n                    ')}
                    <td className={\`sticky right-0 z-10 px-4 py-4 text-right border-l border-neutral-200/50 dark:border-neutral-700/50 shadow-[-4px_0_10px_rgba(0,0,0,0.03)] transition-colors \${rowIndex % 2 === 0 ? "bg-white dark:bg-neutral-900" : "bg-neutral-100/90 dark:bg-neutral-800"}\`}>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={\`${route.path}/\${item.id}\`}>
                          <Button variant="ghost" size="icon" className="w-8 h-8 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Link href={\`${route.path}/\${item.id}\`}>
                          <Button variant="ghost" size="icon" className="w-8 h-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-full">
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="icon" className="w-8 h-8 text-red-600 hover:text-red-700 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30 rounded-full">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {data.length === 0 && (
                <tr>
                  <td colSpan={${visibleCols.length + 2}} className="h-48 text-center text-neutral-500">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-2">
                        <Search className="w-5 h-5 opacity-40" />
                      </div>
                      <span className="font-semibold text-neutral-900 dark:text-white">Nenhum registro encontrado</span>
                      <span className="text-sm">Tente ajustar seus filtros ou cadastre um novo registro.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer Paginação */}
        <div className="px-8 py-4 bg-neutral-50/50 dark:bg-neutral-900/50 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-4 text-[11px] font-bold text-neutral-500 uppercase tracking-widest">
            <span className="opacity-60">Exibir</span>
            <select className="bg-transparent border-none outline-none text-indigo-600 focus:ring-0 cursor-pointer">
              <option value={10}>10 linhas</option>
              <option value={50}>50 linhas</option>
            </select>
            <span className="mx-2 opacity-20">|</span>
            <span className="opacity-60">Total: <span className="text-neutral-900 dark:text-white">{data.length}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all border-none bg-transparent shadow-none"><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all border-none bg-transparent shadow-none"><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>
    </div>
  )
}
`
      files.set(`${routeDir}/page.tsx`, pageContent)
    }
    
    // ==========================================
    // 2. DETALHE E FORMULÁRIO (GERADO PARA TODAS AS ROTAS)
    // ==========================================
    const hasRelations = route.relations && route.relations.length > 0
    const layoutConfig = route.layoutConfig || {}
    const customSlots = layoutConfig.custom_slots || []
    const byocComponents = customSlots.map((s: any) => s.component).filter(Boolean)
    
    let importsStr = [
      `import Link from 'next/link'`,
      `import { get${model.name}ById } from '@/app/actions/${model.name.toLowerCase()}'`,
      hasRelations ? `import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'` : '',
      hasRelations ? `import {\n  Table,\n  TableBody,\n  TableCell,\n  TableHead,\n  TableHeader,\n  TableRow,\n} from '@/components/ui/table'` : '',
      `import { Input } from '@/components/ui/input'`,
      `import { Label } from '@/components/ui/label'`,
      `import { Button } from '@/components/ui/button'`,
      `import { ArrowLeft, Save, CheckCircle2 } from 'lucide-react'`
    ]
    
    if (byocComponents.length > 0) {
      const uniqueByoc = Array.from(new Set(byocComponents))
      importsStr.push(...uniqueByoc.map((c: any) => `import ${c} from '@/components/byoc/${c}'`))
    }
    
    const importsFinal = importsStr.filter(Boolean).join('\n')

    // Top BYOC slots
    const topSlots = customSlots.filter((s: any) => s.placement === 'top' || !s.placement).map((s: any) => `
        <div className="mb-6">
          <${s.component} data={data} config={${JSON.stringify(s.config || {})}} />
        </div>
    `).join('\\n')

    // Bottom BYOC slots
    const bottomSlots = customSlots.filter((s: any) => s.placement === 'bottom').map((s: any) => `
        <div className="mt-6">
          <${s.component} data={data} config={${JSON.stringify(s.config || {})}} />
        </div>
    `).join('\\n')

    const formContent = `
      <form className="space-y-8">
        ${topSlots}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
          ${(route.components || []).filter(c => c.isVisible !== false).map(c => `
          <div className="space-y-2">
            <Label htmlFor="${c.field}" className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">${c.label}</Label>
            <Input 
              id="${c.field}"
              type="${c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text'}" 
              name="${c.field}"
              defaultValue={data?.${c.field} ?? ''}
              disabled={!isNew}
              className="bg-background border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-primary rounded-xl h-11"
            />
          </div>`).join('\n          ')}
        </div>
        ${bottomSlots}
        
        {isNew && (
          <div className="flex justify-end pt-6 border-t border-border">
            <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 px-8 h-11 text-sm font-semibold tracking-wide rounded-xl">
              <Save className="w-4 h-4 mr-2" />
              Salvar ${route.title}
            </Button>
          </div>
        )}
      </form>
    `

    let pageBody = ''
    let dataFetchers = `const data = isNew ? null : await get${model.name}ById(params.id)\n`

    if (hasRelations) {
      let tabsTriggers = ''
      let tabsContents = ''

      for (const r of route.relations) {
        const relModel = ast.models.find(m => m.id === r.modelId)
        if (!relModel) continue

        dataFetchers += `  const relData_${relModel.name} = isNew ? [] : await get${relModel.name}ByField('${r.targetColumn}', data?.${r.sourceColumn})\n`

        tabsTriggers += `\n          <TabsTrigger value="rel_${r.modelId}" className="px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground font-semibold text-sm rounded-lg transition-all">${relModel.name}</TabsTrigger>`
        
        const relVisibleCols = relModel.fields.slice(0, 4)

        tabsContents += `
      <TabsContent value="rel_${r.modelId}" className="mt-6">
        <div className="bg-card rounded-2xl border border-border shadow-xl overflow-hidden">
          {/* Sub-header relation */}
          <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
             <h3 className="text-sm font-bold text-foreground">\${relModel.name} Associados</h3>
             <Button variant="outline" size="sm" className="bg-background border-input text-xs text-foreground">
               + Adicionar Item
             </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border bg-muted/50 hover:bg-muted/50">
                  ${relVisibleCols.map(f => `<TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest px-5 py-3 whitespace-nowrap">${f.name}</TableHead>`).join('\n                  ')}
                </TableRow>
              </TableHeader>
              <TableBody>
                {relData_${relModel.name}.map((item: any) => (
                  <TableRow key={item.id || Math.random()} className="border-border hover:bg-white/5 transition-colors">
                    ${relVisibleCols.map(f => `<TableCell className="px-5 py-3 text-sm text-[var(--foreground)]">{String(item.${f.dbColumn} ?? '-')}</TableCell>`).join('\n                    ')}
                  </TableRow>
                ))}
                {relData_${relModel.name}.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={${relVisibleCols.length}} className="h-32 text-center text-muted-foreground">
                      Nenhum registro de ${relModel.name} encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </TabsContent>`
      }

      pageBody = `
    <Tabs defaultValue="geral" className="w-full">
      <TabsList className="w-full justify-start h-auto p-1.5 bg-muted/50 border border-border rounded-xl overflow-x-auto mb-2 inline-flex">
        <TabsTrigger value="geral" className="px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-foreground text-muted-foreground font-semibold text-sm rounded-lg transition-all">Dados Gerais</TabsTrigger>${tabsTriggers}
      </TabsList>
      
      <TabsContent value="geral" className="mt-6">
        <div className="bg-card rounded-3xl border border-border p-8 shadow-2xl relative overflow-hidden">
          {/* Decorativo de fundo */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] pointer-events-none rounded-full" />
          <div className="relative z-10">
            ${formContent}
          </div>
        </div>
      </TabsContent>
      ${tabsContents}
    </Tabs>`
    } else {
      pageBody = `
    <div className="bg-card rounded-3xl border border-border p-8 shadow-2xl relative overflow-hidden mt-6">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] pointer-events-none rounded-full" />
      <div className="relative z-10">
        ${formContent}
      </div>
    </div>`
    }

    const detailPageContent = `${importsFinal}

export default async function ${model.name}DetailPage({ params }: { params: { id: string } }) {
  const isNew = params.id === 'new'
  ${dataFetchers}
  if (!isNew && !data) {
    return (
      <div className="p-8 max-w-5xl mx-auto text-center mt-20">
        <h2 className="text-2xl font-bold text-foreground mb-2">Registro não encontrado</h2>
        <p className="text-muted-foreground mb-6">O registro solicitado não existe ou foi removido.</p>
        <Link href="${route.path}">
          <Button className="bg-primary hover:bg-primary/90">Voltar para listagem</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-[1200px] mx-auto pb-24">
      {/* Header Contexto */}
      <div className="mb-8">
        <Link href="${route.path}" className="inline-flex items-center text-xs font-bold text-muted-foreground hover:text-foreground transition-colors mb-4 uppercase tracking-widest">
          <ArrowLeft className="w-3 h-3 mr-1.5" />
          Voltar para ${route.title}
        </Link>
        <div className="flex items-end justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center">
              <span className="text-xl font-bold text-primary">{isNew ? '+' : String(data?.id || 'ID').substring(0,2).toUpperCase()}</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">
                {isNew ? 'Novo Registro' : \`\${route.title} #\${data?.id || params.id}\`}
              </h1>
              <p className="text-sm text-muted-foreground">Preencha os dados abaixo para salvar no banco de dados.</p>
            </div>
          </div>
          
          {/* Exemplo de Stepper de Jornada Fake p/ Visual Rico */}
          {!isNew && (
            <div className="hidden lg:flex items-center gap-2">
              {['Novo', 'Análise', 'Concluído'].map((step, idx) => (
                <div key={step} className="flex items-center gap-2">
                  <div className={\`flex items-center justify-center px-3 py-1.5 rounded-full text-xs font-bold border \${idx === 0 ? 'bg-indigo-500/20 text-primary border-indigo-500/30' : 'bg-secondary text-muted-foreground border-input'}\`}>
                    {idx === 0 && <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                    {step}
                  </div>
                  {idx < 2 && <div className="w-8 h-[2px] bg-secondary rounded-full" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      ${pageBody}
    </div>
  )
}
`
    // Dynamic route [id] gerada independentemente se a view mãe é list ou form/detail
    files.set(`${routeDir}/[id]/page.tsx`, detailPageContent)
  }
}


