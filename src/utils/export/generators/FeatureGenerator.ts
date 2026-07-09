import JSZip from 'jszip'

export function generateFeatures(zip: JSZip, models: any[], dbType: string = 'supabase') {
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
      
      // Generate Table Headers and Cells based on fields
      const visibleFields = fields.filter((f: any) => f.list_visible !== false).slice(0, 5) // Show up to 5 columns
      
      const tableHeaders = visibleFields.map((f: any) => 
        `            <TableHead>${f.label}</TableHead>`
      ).join('\n')

      const tableCells = visibleFields.map((f: any) => 
        `              <TableCell>{item.${f.column_name}}</TableCell>`
      ).join('\n')

      // List Component
      componentsFolder.file(`${modelName}List.tsx`, `'use client'

import React, { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { delete${modelName} } from '../actions'
import { ${modelName}Form } from './${modelName}Form'

export function ${modelName}List({ initialData }: { initialData: any[] }) {
  const [isFormOpen, setIsFormOpen] = useState(false)

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir?')) {
      await delete${modelName}(id)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setIsFormOpen(!isFormOpen)}>
          {isFormOpen ? 'Cancelar' : 'Novo Registro'}
        </Button>
      </div>

      {isFormOpen && (
        <div className="p-6 bg-neutral-50 rounded-lg border mb-6">
          <h3 className="font-semibold mb-4">Criar novo registro</h3>
          <${modelName}Form onSuccess={() => setIsFormOpen(false)} />
        </div>
      )}

      <div className="border rounded-md bg-white">
        <Table>
          <TableHeader>
            <TableRow>
${tableHeaders}
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialData.length === 0 && (
              <TableRow>
                <TableCell colSpan={${visibleFields.length + 1}} className="text-center text-neutral-500 py-8">Nenhum registro encontrado.</TableCell>
              </TableRow>
            )}
            {initialData.map((item) => (
              <TableRow key={item.id}>
${tableCells}
                <TableCell className="text-right space-x-2">
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)}>Excluir</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
`)

      // Form Component
      const formInputs = fields.filter((f: any) => f.form_visible !== false && f.column_name !== 'id' && f.column_name !== 'created_at').map((f: any) => {
        let inputType = 'text'
        if (f.field_type === 'number') inputType = 'number'
        if (f.field_type === 'date') inputType = 'date'
        
        return `        <div className="space-y-2">
          <label htmlFor="${f.column_name}" className="text-sm font-medium leading-none">${f.label}</label>
          <Input id="${f.column_name}" name="${f.column_name}" type="${inputType}" required={${f.required ? 'true' : 'false'}} />
        </div>`
      }).join('\n')

      const view = model.ui_views?.[0]
      const layoutConfig = view?.draft_config?.layout_config || {}
      const byocFields = [...(layoutConfig.form_fields || []), ...(layoutConfig.grid_fields || []), ...(layoutConfig.filter_fields || [])]
        .filter((fid: string) => fid.startsWith('byoc_'))
      const uniqueByocNames = Array.from(new Set(byocFields.map((fid: string) => fid.split('_').slice(2).join('_'))))
      const byocImports = uniqueByocNames.map(name => `import ${name} from '@/components/custom/${name}'`).join('\n')
      const byocComponentsJSX = uniqueByocNames.map(name => `      <div className="my-6">\n        <${name} />\n      </div>`).join('\n')

      componentsFolder.file(`${modelName}Form.tsx`, `'use client'

import React, { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { create${modelName} } from '../actions'
${byocImports}

export function ${modelName}Form({ onSuccess }: { onSuccess?: () => void }) {
  const formRef = useRef<HTMLFormElement>(null)

  const handleSubmit = async (formData: FormData) => {
    await create${modelName}(formData)
    formRef.current?.reset()
    if (onSuccess) onSuccess()
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
${byocComponentsJSX}
${formInputs}
      <div className="flex justify-end space-x-2">
        <Button type="submit">Salvar Registro</Button>
      </div>
    </form>
  )
}
`)
    }
  })
}
