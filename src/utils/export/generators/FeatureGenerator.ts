import JSZip from 'jszip'

export function generateFeatures(zip: JSZip, models: any[], uiViews: any[], dbType: string = 'supabase') {
  const featuresFolder = zip.folder('src/features')
  if (!featuresFolder) return

  models.forEach(model => {
    const featFolder = featuresFolder.folder(model.table_name)
    if (!featFolder) return

    const modelName = model.name.replace(/\s/g, '')
    const fields = model.ui_fields || []

    // 1. Server Actions (CRUD)
    let actionsCode = ''
    if (dbType === 'postgres') {
      const hasCreatedAt = fields.some((f: any) => f.column_name === 'created_at')
      const hasCriadoEm = fields.some((f: any) => f.column_name === 'criado_em')
      const orderBy = hasCreatedAt ? ' ORDER BY created_at DESC' : (hasCriadoEm ? ' ORDER BY criado_em DESC' : '')

      const writeableFields = fields.filter((f: any) => f.column_name !== 'id' && f.column_name !== 'created_at' && f.column_name !== 'criado_em')
      const columnNames = writeableFields.map((f: any) => f.column_name)
      const placeholders = columnNames.map((_: any, idx: number) => `$${idx + 1}`)

      actionsCode = `'use server'

import { query } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function fetch${modelName}s() {
  const result = await query('SELECT * FROM ${model.table_name}${orderBy}')
  return result.rows
}

export async function create${modelName}(formData: FormData) {
  const data = Object.fromEntries(formData.entries())
  
  await query(
    \`INSERT INTO ${model.table_name} (${columnNames.join(', ')}) VALUES (${placeholders.join(', ')})\`,
    [
      ${columnNames.map((col: string) => `data.${col} || null`).join(',\n      ')}
    ]
  )
  
  revalidatePath('/${model.table_name}')
}

export async function delete${modelName}(id: string) {
  await query('DELETE FROM ${model.table_name} WHERE id = $1', [id])
  revalidatePath('/${model.table_name}')
}
`
    } else {
      actionsCode = `'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function fetch${modelName}s() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('${model.table_name}').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function create${modelName}(formData: FormData) {
  const supabase = await createClient()
  const data = Object.fromEntries(formData.entries())
  
  const { error } = await supabase.from('${model.table_name}').insert([data])
  if (error) throw new Error(error.message)
  
  revalidatePath('/${model.table_name}')
}

export async function delete${modelName}(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('${model.table_name}').delete().eq('id', id)
  if (error) throw new Error(error.message)
  
  revalidatePath('/${model.table_name}')
}
`
    }
    featFolder.file('actions.ts', actionsCode)

    // 2. Components Folder
    const componentsFolder = featFolder.folder('components')
    if (componentsFolder) {
      
      const view = uiViews.find(v => v.model_id === model.id)
      const layoutConfig = view?.layout_config || view?.draft_config?.layout_config || {}

      // Generate Table Headers and Cells based on fields
      let visibleFields = fields.filter((f: any) => f.list_visible !== false)
      if (layoutConfig.grid_fields && layoutConfig.grid_fields.length > 0) {
        // filter by column name
        visibleFields = fields.filter((f: any) => layoutConfig.grid_fields.includes(f.column_name))
      } else {
        visibleFields = visibleFields.slice(0, 5) // Fallback
      }
      
      const tableHeaders = visibleFields.map((f: any) => 
        `            <TableHead>${f.label}</TableHead>`
      ).join('\n')

      const tableCells = visibleFields.map((f: any) => 
        `              <TableCell>{item.${f.column_name}}</TableCell>`
      ).join('\n')

      componentsFolder.file(`${modelName}List.tsx`, `'use client'

import React, { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Plus, Search, Filter, Database, Trash2, FileText, Inbox } from 'lucide-react'
import { delete${modelName} } from '../actions'
import { ${modelName}Form } from './${modelName}Form'

export function ${modelName}List({ initialData }: { initialData: any[] }) {
  const [isFormOpen, setIsFormOpen] = useState(false)

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir? Esta ação não pode ser desfeita.')) {
      await delete${modelName}(id)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200/60 dark:border-neutral-800 shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input 
              type="text" 
              placeholder="Buscar registros..." 
              className="w-full pl-9 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/60 dark:border-neutral-800 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-neutral-900 dark:text-white"
            />
          </div>
          <Button variant="outline" size="icon" className="shrink-0 rounded-xl border-neutral-200/60 dark:border-neutral-800">
            <Filter className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
          </Button>
        </div>
        
        <Button 
          onClick={() => setIsFormOpen(!isFormOpen)}
          className={\`rounded-xl shadow-lg transition-all \${isFormOpen ? 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/25'}\`}
        >
          {isFormOpen ? 'Cancelar Criação' : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Novo Registro
            </>
          )}
        </Button>
      </div>

      {isFormOpen && (
        <div className="p-6 bg-white dark:bg-neutral-900 rounded-2xl border border-indigo-100 dark:border-indigo-500/20 shadow-xl shadow-indigo-500/5 mb-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-neutral-100 dark:border-neutral-800">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 dark:text-white">Criar novo registro</h3>
              <p className="text-xs text-neutral-500">Preencha os dados abaixo para adicionar um novo item.</p>
            </div>
          </div>
          <${modelName}Form onSuccess={() => setIsFormOpen(false)} />
        </div>
      )}

      {/* Table Area */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 rounded-2xl shadow-sm overflow-hidden">
        {initialData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-20 h-20 bg-neutral-50 dark:bg-neutral-950 rounded-full flex items-center justify-center mb-6 border border-neutral-100 dark:border-neutral-800 shadow-inner">
              <Inbox className="w-8 h-8 text-neutral-400" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Nenhum registro encontrado</h3>
            <p className="text-neutral-500 text-sm max-w-sm mb-8">
              Ainda não há dados cadastrados nesta tabela. Clique no botão abaixo para criar o primeiro registro.
            </p>
            <Button 
              onClick={() => setIsFormOpen(true)}
              className="rounded-full px-8 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/25"
            >
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeiro Registro
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-neutral-50/50 dark:bg-neutral-950/50">
                <TableRow className="border-b-neutral-200/60 dark:border-b-neutral-800">
${tableHeaders}
                  <TableHead className="text-right w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialData.map((item) => (
                  <TableRow key={item.id} className="group border-b-neutral-100 dark:border-b-neutral-800/50 hover:bg-indigo-50/30 dark:hover:bg-indigo-500/5 transition-colors">
${tableCells}
                    <TableCell className="text-right">
                      <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(item.id)}
                          className="text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg w-8 h-8"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
`)

      // Form Component
      let formFieldsList = fields.filter((f: any) => f.form_visible !== false && f.column_name !== 'id' && f.column_name !== 'created_at' && f.column_name !== 'criado_em')
      if (layoutConfig.form_fields && layoutConfig.form_fields.length > 0) {
        formFieldsList = fields.filter((f: any) => layoutConfig.form_fields.includes(f.column_name))
      }

      const formInputs = formFieldsList.map((f: any) => {
        let inputType = 'text'
        if (f.field_type === 'number') inputType = 'number'
        if (f.field_type === 'date') inputType = 'date'
        
        return `        <div className="space-y-2">
          <label htmlFor="${f.column_name}" className="text-sm font-medium leading-none">${f.label}</label>
          <Input id="${f.column_name}" name="${f.column_name}" type="${inputType}" required={${f.required ? 'true' : 'false'}} />
        </div>`
      }).join('\n')

      const byocFields = [...(layoutConfig.form_fields || []), ...(layoutConfig.grid_fields || []), ...(layoutConfig.filter_fields || [])]
        .filter((fid: string) => fid.startsWith('byoc_'))
      const uniqueByocNames = Array.from(new Set(byocFields.map((fid: string) => fid.split('_').slice(2).join('_'))))
      const byocImports = uniqueByocNames.map(name => `import ${name} from '@/components/custom/${name}'`).join('\n')
      const byocComponentsJSX = uniqueByocNames.map(name => `      <div className="my-6">\n        <${name} />\n      </div>`).join('\n')

      componentsFolder.file(`${modelName}Form.tsx`, `'use client'

import React, { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Save, Loader2 } from 'lucide-react'
import { create${modelName} } from '../actions'
${byocImports}

export function ${modelName}Form({ onSuccess }: { onSuccess?: () => void }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true)
    try {
      await create${modelName}(formData)
      formRef.current?.reset()
      if (onSuccess) onSuccess()
    } catch (error) {
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-5">
${byocComponentsJSX}
${formInputs}
      <div className="flex justify-end pt-4 border-t border-neutral-100 dark:border-neutral-800">
        <Button 
          type="submit" 
          disabled={isSubmitting}
          className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/25 px-6"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Salvar Registro
        </Button>
      </div>
    </form>
  )
}
`)
    }
  })
}
