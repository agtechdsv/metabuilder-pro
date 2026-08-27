import { AppAST } from '../ast'

export function generateRoutes(ast: AppAST, files: Map<string, string>) {
  for (const route of ast.routes) {
    const model = ast.models.find(m => m.id === route.modelId)
    if (!model) continue
    
    // O path da rota costuma vir com '/' (ex: /usuarios), então anexamos à pasta app/(protected)
    const routeDir = `app/(protected)${route.path}`
    
    if (route.type === 'list') {
      const visibleCols = route.components.filter(c => c.isVisible)
      
      const pageContent = `import Link from 'next/link'
import { get${model.name}List } from '@/app/actions/${model.name.toLowerCase()}'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default async function ${model.name}ListPage() {
  const data = await get${model.name}List()

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">${route.title}</h1>
          <p className="text-sm text-[var(--muted)] mt-1">{data.length} registro{data.length !== 1 ? 's' : ''} encontrado{data.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="${route.path}/new">
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
            + Novo Registro
          </Button>
        </Link>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--card-border)] hover:bg-transparent">
              ${visibleCols.map(c => `<TableHead className="text-[var(--muted)] font-semibold uppercase text-xs tracking-wider px-4 py-3">${c.label}</TableHead>`).join('\n              ')}
              <TableHead className="text-[var(--muted)] font-semibold uppercase text-xs tracking-wider px-4 py-3 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item: any) => (
              <TableRow key={item.id} className="border-[var(--card-border)] hover:bg-white/5 transition-colors">
                ${visibleCols.map(c => `<TableCell className="px-4 py-3 text-sm text-[var(--foreground)]">{String(item.${c.field} ?? '-')}</TableCell>`).join('\n                ')}
                <TableCell className="px-4 py-3 text-right">
                  <Link
                    href={\`${route.path}/\${item.id}\`}
                    className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Ver detalhes →
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={${visibleCols.length + 1}} className="h-32 text-center text-[var(--muted)]">
                  <div className="flex flex-col items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
                    <span>Nenhum registro encontrado</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
`
      files.set(`${routeDir}/page.tsx`, pageContent)
    }
    
    // Detalhe / Formulário / Master-Detail
    if (route.type === 'detail' || route.type === 'form') {
      const hasRelations = route.relations && route.relations.length > 0
      const imports = [
        `import Link from 'next/link'`,
        `import { get${model.name}ById } from '@/app/actions/${model.name.toLowerCase()}'`,
        hasRelations ? `import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'` : '',
        `import { Input } from '@/components/ui/input'`,
        `import { Label } from '@/components/ui/label'`,
        `import { Button } from '@/components/ui/button'`
      ].filter(Boolean).join('\n')

      const formContent = `
        <form className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            ${route.components.filter(c => c.isVisible).map(c => `
            <div className="space-y-2">
              <Label htmlFor="${c.field}">${c.label}</Label>
              <Input 
                id="${c.field}"
                type="${c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text'}" 
                name="${c.field}"
                defaultValue={data?.${c.field} ?? ''}
                disabled={!isNew}
                className="bg-[var(--background)] border-[var(--card-border)] text-[var(--foreground)]"
              />
            </div>`).join('\n            ')}
          </div>
          
          {isNew && (
            <div className="flex justify-end pt-4 border-t border-[var(--card-border)] mt-6">
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                Salvar Registro
              </Button>
            </div>
          )}
        </form>
      `

      let pageBody = ''

      if (hasRelations) {
        // Gera o Master-Detail com Abas
        pageBody = `
      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="mb-6 w-full justify-start h-auto p-1 bg-[var(--card)] border border-[var(--card-border)] rounded-xl">
          <TabsTrigger value="geral" className="px-5 py-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-[var(--muted)] rounded-lg">Geral</TabsTrigger>
          ${route.relations.map(r => `<TabsTrigger value="rel_${r.modelId}" className="px-5 py-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-[var(--muted)] rounded-lg">${r.modelId}</TabsTrigger>`).join('\n          ')}
        </TabsList>
        
        <TabsContent value="geral" className="bg-[var(--card)] rounded-xl border border-[var(--card-border)] p-6">
          ${formContent}
        </TabsContent>

        ${route.relations.map(r => `
        <TabsContent value="rel_${r.modelId}" className="bg-[var(--card)] rounded-xl border border-[var(--card-border)] p-6">
          <p className="text-sm text-[var(--muted)]">Registros relacionados de ${r.modelId} aparecerão aqui.</p>
        </TabsContent>
        `).join('\n        ')}
      </Tabs>
        `
      } else {
        pageBody = `
      <div className="bg-[var(--card)] rounded-xl border border-[var(--card-border)] p-6">
        ${formContent}
      </div>
        `
      }

      const pageContent = `${imports}

export default async function ${model.name}DetailPage({ params }: { params: { id: string } }) {
  const isNew = params.id === 'new'
  const data = isNew ? null : await get${model.name}ById(params.id)

  if (!isNew && !data) {
    return <div className="p-8 text-red-500">Registro não encontrado.</div>
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <Link href="${route.path}" className="text-sm font-medium text-[var(--muted)] hover:text-white transition-colors bg-[var(--card)] border border-[var(--card-border)] hover:border-indigo-500 px-3 py-1.5 rounded-md">
          ← Voltar
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          {isNew ? 'Novo Registro' : \`Detalhes de \${data?.id}\`}
        </h1>
      </div>

      ${pageBody}
    </div>
  )
}
`
      // Dynamic route [id] for forms/details
      files.set(`${routeDir}/[id]/page.tsx`, pageContent)
    }
  }
}
