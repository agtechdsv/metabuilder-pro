'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

/**
 * Tabela de login do projeto (a de usuários do app) e as colunas dela: é de onde vêm os dados do usuário que as regras de
 * acesso por linha e a auditoria usam. `table` é undefined enquanto carrega e null se o login não está configurado.
 */
export function useAuthTable(project: any, models: any[]) {
  const [table, setTable] = useState<string | null | undefined>(undefined)
  const [columns, setColumns] = useState<string[]>([])

  useEffect(() => {
    let alive = true
    const supabase = createClient()
    ;(async () => {
      const { data } = await supabase.from('project_auth_config').select('db_table_name').eq('project_id', project.id).maybeSingle()
      const name = (data as any)?.db_table_name || null
      if (!alive) return
      setTable(name)
      if (!name) return
      const model = models.find(m => String(m.db_table_name).toLowerCase() === String(name).toLowerCase())
      if (!model) return
      const { data: fields } = await supabase.from('fields').select('db_column_name').eq('model_id', model.id)
      if (alive) setColumns(((fields as any[]) || []).map(f => String(f.db_column_name)).filter(Boolean).sort())
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  return { table, columns }
}
