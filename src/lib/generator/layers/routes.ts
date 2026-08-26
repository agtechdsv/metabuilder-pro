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

export default async function ${model.name}ListPage() {
  const data = await get${model.name}List()

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight">${route.title}</h1>
        <Link 
          href="${route.path}/new" 
          className="bg-zinc-900 text-white px-4 py-2 text-sm font-medium rounded-md hover:bg-zinc-800 transition-colors shadow-sm"
        >
          Novo Registro
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-zinc-200">
        <table className="w-full text-left text-sm text-zinc-500">
          <thead className="text-xs text-zinc-700 uppercase bg-zinc-50/50 border-b border-zinc-200">
            <tr>
              ${visibleCols.map(c => `<th className="px-6 py-3 font-semibold">${c.label}</th>`).join('\n              ')}
              <th className="px-6 py-3 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {data.map((item: any) => (
              <tr key={item.id} className="bg-white hover:bg-zinc-50/50 transition-colors">
                ${visibleCols.map(c => `<td className="px-6 py-4 whitespace-nowrap">{String(item.${c.field} ?? '-')}</td>`).join('\n                ')}
                <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                  <Link href={\`${route.path}/\${item.id}\`} className="text-indigo-600 hover:text-indigo-900 transition-colors">
                    Detalhes
                  </Link>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={${visibleCols.length + 1}} className="px-6 py-8 text-center text-zinc-500">
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
`
      files.set(`${routeDir}/page.tsx`, pageContent)
    }
    
    // Detalhe / Formulário
    if (route.type === 'detail' || route.type === 'form') {
      const pageContent = `import Link from 'next/link'
import { get${model.name}ById } from '@/app/actions/${model.name.toLowerCase()}'

export default async function ${model.name}DetailPage({ params }: { params: { id: string } }) {
  const isNew = params.id === 'new'
  const data = isNew ? null : await get${model.name}ById(params.id)

  if (!isNew && !data) {
    return <div className="p-8 text-red-500">Registro não encontrado.</div>
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="${route.path}" className="text-sm text-zinc-500 hover:text-zinc-900 mb-4 inline-block">
          ← Voltar para ${route.title}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">
          {isNew ? 'Novo Registro' : \`Detalhes de \${data?.id}\`}
        </h1>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-6">
        <form className="space-y-6">
          ${route.components.filter(c => c.isVisible).map(c => `
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">${c.label}</label>
            <input 
              type="${c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text'}" 
              name="${c.field}"
              defaultValue={data?.${c.field} ?? ''}
              className="w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              disabled={!isNew}
            />
          </div>`).join('\n')}
          
          {isNew && (
            <div className="flex justify-end pt-4 border-t border-zinc-100">
              <button type="submit" className="bg-indigo-600 text-white px-4 py-2 text-sm font-medium rounded-md hover:bg-indigo-700 shadow-sm transition-colors">
                Salvar
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
`
      // Dynamic route [id] for forms/details
      files.set(`${routeDir}/[id]/page.tsx`, pageContent)
    }
  }
}
