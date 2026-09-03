import { RouteNode } from '../../ast'

export function generateWipPage(route: RouteNode): string {
  return `import type { Metadata } from 'next'

export const metadata: Metadata = { title: '${route.title}' }

export default function ${route.modelName}Page() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
      <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
      </div>
      <h1 className="text-xl font-black text-neutral-900 dark:text-white mb-2">${route.title}</h1>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md">
        Este tipo de visualização (<strong>${route.logicType}</strong>) está em desenvolvimento e será disponibilizado em breve.
      </p>
    </div>
  )
}
`
}
