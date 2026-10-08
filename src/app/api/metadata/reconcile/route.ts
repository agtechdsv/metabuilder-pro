/**
 * POST /api/metadata/reconcile
 *
 * Aplica correções de paridade diretamente no Supabase (fields.data_type e fields.ui_widget).
 * Chamado por applyParityFixes() em parityAudit.ts após o usuário confirmar no modal.
 *
 * Body:
 *   {
 *     projectId: string,
 *     fixes: Array<{
 *       fieldId: string,
 *       newDataType: string,
 *       newUiWidget: string
 *     }>
 *   }
 *
 * Resposta:
 *   { updated: number, skipped: number, errors: string[] }
 */

import { createClient } from '@supabase/supabase-js'
import { createClient as createSessionClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  try {
    const supabase = createClient(supabaseUrl, serviceKey)

    const body = await request.json()
    const { projectId, fixes } = body as {
      projectId: string
      fixes: Array<{ fieldId: string; newDataType: string; newUiWidget: string }>
    }

    if (!projectId || !Array.isArray(fixes) || fixes.length === 0) {
      return NextResponse.json(
        { error: 'Payload inválido: projectId e fixes[] são obrigatórios.' },
        { status: 400 }
      )
    }

    // Só quem tem acesso ao projeto no MetaBuilder (a política de leitura de "projects" só o devolve a quem tem) altera os campos dele:
    // antes qualquer pessoa, sem login, podia mudar o tipo de qualquer campo conhecendo o id.
    const sessionClient = await createSessionClient()
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    const { data: visible } = await sessionClient.from('projects').select('id').eq('id', projectId).maybeSingle()
    if (!visible) return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 })

    // Verifica se o projeto existe (guard básico)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
    }

    let updated = 0
    let skipped = 0
    const errors: string[] = []

    for (const fix of fixes) {
      const { fieldId, newDataType, newUiWidget } = fix

      if (!fieldId || !newDataType) {
        skipped++
        continue
      }

      // Confirma que o field pertence ao projeto (segurança extra)
      const { data: field, error: fieldError } = await supabase
        .from('fields')
        .select('id, model_id, models!inner(project_id)')
        .eq('id', fieldId)
        .single()

      if (fieldError || !field) {
        errors.push(`Campo ${fieldId} não encontrado.`)
        skipped++
        continue
      }

      const fieldWithModel = field as any
      if (fieldWithModel.models?.project_id !== projectId) {
        errors.push(`Campo ${fieldId} não pertence ao projeto ${projectId}.`)
        skipped++
        continue
      }

      // Aplica a correção
      const { error: updateError } = await supabase
        .from('fields')
        .update({
          data_type: newDataType,
          ...(newUiWidget ? { ui_widget: newUiWidget } : {}),
        })
        .eq('id', fieldId)

      if (updateError) {
        errors.push(`Erro ao atualizar campo ${fieldId}: ${updateError.message}`)
        skipped++
      } else {
        updated++
      }
    }

    return NextResponse.json({ updated, skipped, errors })
  } catch (err: any) {
    console.error('[reconcile] Erro interno:', err)
    return NextResponse.json(
      { error: err.message || 'Erro interno no servidor.' },
      { status: 500 }
    )
  }
}
