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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, Filter, Download, Zap, Eye, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'

export default async function ${model.name}ListPage() {
  const data = await get${model.name}List()

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Cabeçalho Premium */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/10 flex items-center justify-center ring-1 ring-indigo-500/20">
             <div className="text-xl font-bold text-indigo-500">{String('${model.name}').charAt(0)}</div>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              ${route.title}
              <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-[10px] font-semibold text-neutral-400 border border-neutral-700 tracking-wider">
                {data.length} REGISTRO{data.length !== 1 ? 'S' : ''}
              </span>
            </h1>
            <p className="text-xs font-black tracking-widest text-[var(--muted)] mt-1 uppercase">SISTEMA METABUILDER</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-800 hidden sm:flex">
            <Zap className="w-4 h-4 mr-2 text-indigo-400" /> Automações
          </Button>
          <Button variant="outline" className="bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-800 hidden sm:flex">
            <Download className="w-4 h-4 mr-2" /> Exportar
          </Button>
          <Link href="${route.path}/new">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 px-6 font-semibold tracking-wide">
              + Novo Registro
            </Button>
          </Link>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="p-5 bg-neutral-900/40 border border-neutral-800 rounded-2xl shadow-inner flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black tracking-widest text-neutral-400 uppercase ml-1">Pesquisa Rápida</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <Input placeholder="Buscar registros..." className="pl-9 bg-neutral-900 border-neutral-800 text-neutral-200 focus-visible:ring-indigo-500" />
            </div>
          </div>
          <div className="space-y-1.5 hidden md:block">
            <label className="text-[10px] font-black tracking-widest text-neutral-400 uppercase ml-1">Status</label>
            <select className="flex h-10 w-full items-center justify-between rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-background">
              <option value="">Todos os status</option>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button className="bg-neutral-800 hover:bg-neutral-700 text-white flex-1 md:flex-none">
            Pesquisar
          </Button>
          <Button variant="ghost" className="text-neutral-400 hover:text-white flex-1 md:flex-none">
            Limpar
          </Button>
        </div>
      </div>

      {/* Tabela Premium */}
      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--card-border)] bg-neutral-900/50 hover:bg-neutral-900/50">
                <TableHead className="w-12 px-4 py-4 text-center">
                  <input type="checkbox" className="rounded border-neutral-700 bg-neutral-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-neutral-900" />
                </TableHead>
                <TableHead className="w-14"></TableHead>
                ${visibleCols.map(c => `<TableHead className="text-[var(--muted)] font-bold uppercase text-[10px] tracking-widest px-4 py-4 whitespace-nowrap">${c.label}</TableHead>`).join('\n                ')}
                <TableHead className="text-[var(--muted)] font-bold uppercase text-[10px] tracking-widest px-4 py-4 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item: any) => {
                const getInitials = () => {
                  const val = String(item.${visibleCols[0]?.field || 'id'} || '??');
                  return val.substring(0, 2).toUpperCase();
                };
                return (
                  <TableRow key={item.id} className="border-[var(--card-border)] hover:bg-white/[0.02] transition-colors group">
                    <TableCell className="px-4 py-4 text-center">
                      <input type="checkbox" className="rounded border-neutral-700 bg-neutral-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-neutral-900 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center">
                        <span className="text-xs font-bold text-indigo-400">{getInitials()}</span>
                      </div>
                    </TableCell>
                    ${visibleCols.map((c, idx) => {
                      // Se for campo de status comum, vamos colocar um badge colorido, senão apenas texto
                      if (c.field.toLowerCase().includes('status') || c.field.toLowerCase().includes('ativo') || c.field.toLowerCase().includes('state')) {
                        return `<TableCell className="px-4 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {String(item.${c.field} ?? '-')}
                          </span>
                        </TableCell>`
                      }
                      return `<TableCell className="px-4 py-4 text-sm text-[var(--foreground)] \${idx === 0 ? 'font-medium' : ''} whitespace-nowrap">
                        {String(item.${c.field} ?? '-')}
                      </TableCell>`
                    }).join('\n                    ')}
                    <TableCell className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={\`${route.path}/\${item.id}\`}>
                          <Button variant="ghost" size="icon" className="w-8 h-8 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-full">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Link href={\`${route.path}/\${item.id}\`}>
                          <Button variant="ghost" size="icon" className="w-8 h-8 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-full">
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="icon" className="w-8 h-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-full">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={${visibleCols.length + 3}} className="h-48 text-center text-[var(--muted)]">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-neutral-900 flex items-center justify-center mb-2">
                        <Search className="w-5 h-5 opacity-40" />
                      </div>
                      <span className="font-semibold text-neutral-300">Nenhum registro encontrado</span>
                      <span className="text-sm">Tente ajustar seus filtros ou cadastre um novo registro.</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Footer Paginação */}
        <div className="p-4 border-t border-[var(--card-border)] bg-neutral-900/30 flex items-center justify-between">
          <p className="text-xs text-neutral-500 font-medium">Exibindo <strong className="text-neutral-300">1</strong> a <strong className="text-neutral-300">{data.length}</strong> de <strong className="text-neutral-300">{data.length}</strong> resultados</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="bg-neutral-900 border-neutral-800 text-neutral-400" disabled><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" className="bg-neutral-900 border-neutral-800 text-neutral-400" disabled><ChevronRight className="w-4 h-4" /></Button>
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
    
    let importsStr = [
      `import Link from 'next/link'`,
      `import { get${model.name}ById } from '@/app/actions/${model.name.toLowerCase()}'`,
      hasRelations ? `import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'` : '',
      hasRelations ? `import {\n  Table,\n  TableBody,\n  TableCell,\n  TableHead,\n  TableHeader,\n  TableRow,\n} from '@/components/ui/table'` : '',
      `import { Input } from '@/components/ui/input'`,
      `import { Label } from '@/components/ui/label'`,
      `import { Button } from '@/components/ui/button'`,
      `import { ArrowLeft, Save, CheckCircle2 } from 'lucide-react'`
    ].filter(Boolean).join('\n')

    const formContent = `
      <form className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
          ${route.components.filter(c => c.isVisible).map(c => `
          <div className="space-y-2">
            <Label htmlFor="${c.field}" className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest">${c.label}</Label>
            <Input 
              id="${c.field}"
              type="${c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text'}" 
              name="${c.field}"
              defaultValue={data?.${c.field} ?? ''}
              disabled={!isNew}
              className="bg-neutral-900/50 border-neutral-800 text-white placeholder:text-neutral-600 focus-visible:ring-indigo-500 rounded-xl h-11"
            />
          </div>`).join('\n          ')}
        </div>
        
        {isNew && (
          <div className="flex justify-end pt-6 border-t border-[var(--card-border)]">
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 px-8 h-11 text-sm font-semibold tracking-wide rounded-xl">
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

        importsStr += `\nimport { get${relModel.name}ByField } from '@/app/actions/${relModel.name.toLowerCase()}'`
        
        dataFetchers += `  const relData_${relModel.name} = isNew ? [] : await get${relModel.name}ByField('${r.targetColumn}', data?.${r.sourceColumn})\n`

        tabsTriggers += `\n          <TabsTrigger value="rel_${r.modelId}" className="px-6 py-2.5 data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-neutral-400 font-semibold text-sm rounded-lg transition-all">${relModel.name}</TabsTrigger>`
        
        const relVisibleCols = relModel.fields.slice(0, 4)

        tabsContents += `
      <TabsContent value="rel_${r.modelId}" className="mt-6">
        <div className="bg-[var(--card)] rounded-2xl border border-[var(--card-border)] shadow-xl overflow-hidden">
          {/* Sub-header relation */}
          <div className="p-4 border-b border-[var(--card-border)] bg-neutral-900/30 flex justify-between items-center">
             <h3 className="text-sm font-bold text-white">${relModel.name} Associados</h3>
             <Button variant="outline" size="sm" className="bg-neutral-900 border-neutral-700 text-xs text-white">
               + Adicionar Item
             </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--card-border)] bg-neutral-900/50 hover:bg-neutral-900/50">
                  ${relVisibleCols.map(f => `<TableHead className="text-[var(--muted)] font-bold uppercase text-[10px] tracking-widest px-5 py-3 whitespace-nowrap">${f.name}</TableHead>`).join('\n                  ')}
                </TableRow>
              </TableHeader>
              <TableBody>
                {relData_${relModel.name}.map((item: any) => (
                  <TableRow key={item.id || Math.random()} className="border-[var(--card-border)] hover:bg-white/5 transition-colors">
                    ${relVisibleCols.map(f => `<TableCell className="px-5 py-3 text-sm text-[var(--foreground)]">{String(item.${f.dbColumn} ?? '-')}</TableCell>`).join('\n                    ')}
                  </TableRow>
                ))}
                {relData_${relModel.name}.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={${relVisibleCols.length}} className="h-32 text-center text-[var(--muted)]">
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
      <TabsList className="w-full justify-start h-auto p-1.5 bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-x-auto mb-2 inline-flex">
        <TabsTrigger value="geral" className="px-6 py-2.5 data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-neutral-400 font-semibold text-sm rounded-lg transition-all">Dados Gerais</TabsTrigger>${tabsTriggers}
      </TabsList>
      
      <TabsContent value="geral" className="mt-6">
        <div className="bg-[var(--card)] rounded-3xl border border-[var(--card-border)] p-8 shadow-2xl relative overflow-hidden">
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
    <div className="bg-[var(--card)] rounded-3xl border border-[var(--card-border)] p-8 shadow-2xl relative overflow-hidden mt-6">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] pointer-events-none rounded-full" />
      <div className="relative z-10">
        ${formContent}
      </div>
    </div>`
    }

    const detailPageContent = `${importsStr}

export default async function ${model.name}DetailPage({ params }: { params: { id: string } }) {
  const isNew = params.id === 'new'
  ${dataFetchers}
  if (!isNew && !data) {
    return (
      <div className="p-8 max-w-5xl mx-auto text-center mt-20">
        <h2 className="text-2xl font-bold text-white mb-2">Registro não encontrado</h2>
        <p className="text-neutral-400 mb-6">O registro solicitado não existe ou foi removido.</p>
        <Link href="${route.path}">
          <Button className="bg-indigo-600 hover:bg-indigo-700">Voltar para listagem</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-[1200px] mx-auto pb-24">
      {/* Header Contexto */}
      <div className="mb-8">
        <Link href="${route.path}" className="inline-flex items-center text-xs font-bold text-neutral-400 hover:text-white transition-colors mb-4 uppercase tracking-widest">
          <ArrowLeft className="w-3 h-3 mr-1.5" />
          Voltar para ${route.title}
        </Link>
        <div className="flex items-end justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center">
              <span className="text-xl font-bold text-indigo-400">{isNew ? '+' : String(data?.id || 'ID').substring(0,2).toUpperCase()}</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white mb-1">
                {isNew ? 'Novo Registro' : \`\${route.title} #\${data?.id || params.id}\`}
              </h1>
              <p className="text-sm text-neutral-400">Preencha os dados abaixo para salvar no banco de dados.</p>
            </div>
          </div>
          
          {/* Exemplo de Stepper de Jornada Fake p/ Visual Rico */}
          {!isNew && (
            <div className="hidden lg:flex items-center gap-2">
              {['Novo', 'Análise', 'Concluído'].map((step, idx) => (
                <div key={step} className="flex items-center gap-2">
                  <div className={\`flex items-center justify-center px-3 py-1.5 rounded-full text-xs font-bold border \${idx === 0 ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-neutral-800 text-neutral-500 border-neutral-700'}\`}>
                    {idx === 0 && <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                    {step}
                  </div>
                  {idx < 2 && <div className="w-8 h-[2px] bg-neutral-800 rounded-full" />}
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
