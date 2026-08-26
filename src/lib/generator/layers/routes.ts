import { AppAST } from '../ast'

export function generateRoutes(ast: AppAST, files: Map<string, string>) {
  for (const route of ast.routes) {
    const model = ast.models.find(m => m.id === route.modelId)
    if (!model) continue
    
    // O path da rota costuma vir com '/' (ex: /usuarios), então anexamos à pasta app
    const routeDir = `app${route.path}`
    
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
} from "@/components/ui/table"

export default async function ${model.name}ListPage() {
  const data = await get${model.name}List()

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">${route.title}</h1>
        <Link href="${route.path}/new">
          <Button>Novo Registro</Button>
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-zinc-50/50">
            <TableRow>
              ${visibleCols.map(c => `<TableHead>${c.label}</TableHead>`).join('\n              ')}
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item: any) => (
              <TableRow key={item.id}>
                ${visibleCols.map(c => `<TableCell>{String(item.${c.field} ?? '-')}</TableCell>`).join('\n                ')}
                <TableCell className="text-right">
                  <Link href={\`${route.path}/\${item.id}\`} className="text-sm font-medium text-indigo-600 hover:text-indigo-900 transition-colors">
                    Detalhes
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={${visibleCols.length + 1}} className="h-24 text-center text-zinc-500">
                  Nenhum registro encontrado.
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
              />
            </div>`).join('\n            ')}
          </div>
          
          {isNew && (
            <div className="flex justify-end pt-4 border-t border-zinc-100 mt-6">
              <Button type="submit">
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
        <TabsList className="mb-6 w-full justify-start h-auto p-1 bg-zinc-100/50">
          <TabsTrigger value="geral" className="px-6 py-2">Geral</TabsTrigger>
          ${route.relations.map(r => `<TabsTrigger value="rel_${r.modelId}" className="px-6 py-2">Relacionado (${r.modelId})</TabsTrigger>`).join('\n          ')}
        </TabsList>
        
        <TabsContent value="geral" className="bg-white rounded-lg shadow-sm border border-zinc-200 p-6">
          ${formContent}
        </TabsContent>

        ${route.relations.map(r => `
        <TabsContent value="rel_${r.modelId}" className="bg-white rounded-lg shadow-sm border border-zinc-200 p-6">
          <h3 className="text-lg font-medium mb-4">Dados Relacionados</h3>
          <p className="text-sm text-zinc-500 mb-6">Lista de dependentes para o modelo ${r.modelId} será renderizada aqui.</p>
          {/* Aqui você pode importar e usar o componente de Listagem (Table) do respectivo modelo */}
        </TabsContent>
        `).join('\n        ')}
      </Tabs>
        `
      } else {
        pageBody = `
      <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-6">
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
        <Link href="${route.path}" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 rounded-md">
          ← Voltar
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
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
