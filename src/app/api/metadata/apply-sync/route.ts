import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

// Esta rota é chamada pelo dashboard web, então usamos auth do usuário
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, mappedTables, mappedFields, deletedModels, deletedFields } = body

    if (!projectId) {
      return NextResponse.json({ error: 'ID do projeto obrigatório' }, { status: 400 })
    }

    // 1. Validar Acesso ao Projeto
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, last_sync_payload')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Projeto não encontrado ou sem acesso' }, { status: 403 })
    }

    const metadata = project.last_sync_payload;
    if (!metadata) {
      return NextResponse.json({ error: 'Nenhum payload de sync pendente encontrado.' }, { status: 400 })
    }

    const targetSchema = 'public'; // Pode ser parametrizado no futuro

    // 2. Aplicar Mapeamentos (RENAMES)
    // Se o usuário disse "O model X virou Y", atualizamos o banco antes de rodar o Upsert
    if (mappedTables && Object.keys(mappedTables).length > 0) {
      for (const [modelId, newTableName] of Object.entries(mappedTables)) {
        await supabase
          .from('models')
          .update({ 
            db_table_name: newTableName as string,
            display_name: newTableName as string,
            is_missing: false 
          })
          .eq('id', modelId);
      }
    }

    if (mappedFields && Object.keys(mappedFields).length > 0) {
      for (const [fieldId, newColumnName] of Object.entries(mappedFields)) {
        await supabase
          .from('fields')
          .update({ 
            db_column_name: newColumnName as string,
            display_name: newColumnName as string,
            is_missing: false 
          })
          .eq('id', fieldId);
      }
    }

    // 3. Aplicar Exclusões Manuais (DELETES)
    // O usuário aceitou que essas tabelas/colunas sumiram e devem ser apagadas em cascata
    if (deletedModels && deletedModels.length > 0) {
      await supabase
        .from('models')
        .delete()
        .in('id', deletedModels);
    }

    if (deletedFields && deletedFields.length > 0) {
      await supabase
        .from('fields')
        .delete()
        .in('id', deletedFields);
    }

    // 4. Executar o FAST-PATH (Atualização e Inserção Segura)
    // Agora que as tabelas antigas foram renomeadas, o nome bate com o payload do metadata!
    const modelIdMap: Record<string, string> = {} 
    const fieldIdMap: Record<string, Record<string, string>> = {} 

    for (const table of metadata) {
      // 4.1. Upsert Model
      const { data: modelData, error: modelError } = await supabase
        .from('models')
        .upsert(
          {
            project_id: projectId,
            db_schema_name: targetSchema,
            db_table_name: table.name,
            display_name: table.name,
            is_missing: false
          },
          { onConflict: 'project_id,db_schema_name,db_table_name' }
        )
        .select()
        .single()

      if (modelError) throw new Error(`Erro ao salvar model ${table.name}: ${modelError.message}`)
      
      const modelId = modelData.id
      modelIdMap[table.name] = modelId
      fieldIdMap[modelId] = {}

      // 4.2. Upsert Fields
      let orderIndex = 0;
      for (const col of table.columns) {
        let uiWidget = 'text_input'
        if (['integer', 'bigint', 'numeric', 'real'].includes(col.type)) uiWidget = 'number_input'
        if (['date', 'timestamp', 'timestamp without time zone'].includes(col.type)) uiWidget = 'date_picker'
        if (col.type === 'boolean') uiWidget = 'checkbox'
        if (col.type === 'uuid') uiWidget = 'uuid_input'

        const { data: fieldData, error: fieldError } = await supabase
          .from('fields')
          .upsert(
            {
              model_id: modelId,
              db_column_name: col.name,
              display_name: col.name,
              data_type: col.type,
              is_primary_key: col.isPrimary,
              is_nullable: col.isNullable,
              default_value: col.defaultValue ? String(col.defaultValue) : null,
              ui_widget: uiWidget,
              order_index: orderIndex++,
              is_missing: false
            },
            { onConflict: 'model_id,db_column_name' }
          )
          .select()
          .single()

        if (fieldError) throw new Error(`Erro ao salvar field ${col.name}: ${fieldError.message}`)
        
        fieldIdMap[modelId][col.name] = fieldData.id
      }
    }

    // 4.3. Processar Relacionamentos Seguros
    for (const table of metadata) {
      if (!table.relations || table.relations.length === 0) continue
      
      const currentModelId = modelIdMap[table.name]

      for (const rel of table.relations) {
        const refModelId = modelIdMap[rel.referencedTable]
        const fromFieldId = fieldIdMap[currentModelId]?.[rel.foreignColumn]
        const toFieldId = fieldIdMap[refModelId]?.[rel.referencedColumn]

        if (refModelId && fromFieldId && toFieldId) {
          const relationType = 'many_to_one'
          const relationName = `fk_${table.name}_${rel.referencedTable}`

          const { data: existingRel } = await supabase
            .from('relations')
            .select('id')
            .eq('project_id', projectId)
            .eq('from_model_id', currentModelId)
            .eq('from_field_id', fromFieldId)
            .single()

          if (!existingRel) {
            await supabase
              .from('relations')
              .insert({
                project_id: projectId,
                name: relationName,
                from_model_id: currentModelId,
                from_field_id: fromFieldId,
                to_model_id: refModelId,
                to_field_id: toFieldId,
                relation_type: relationType
              })
          }
        }
      }
    }

    // 5. Finalizar Limpeza
    // Todas as tabelas que ainda sobraram com is_missing = true e não foram deletadas manualmente, 
    // devem ser deletadas agora (são fantasmas não resolvidos)
    await supabase.from('models').delete().eq('project_id', projectId).eq('is_missing', true);
    // Fields missing de models existentes também:
    // Pega os models desse projeto
    const { data: projModels } = await supabase.from('models').select('id').eq('project_id', projectId);
    if (projModels && projModels.length > 0) {
      await supabase.from('fields').delete().in('model_id', projModels.map(m => m.id)).eq('is_missing', true);
    }

    // Libera o projeto caso estivesse travado
    await supabase
      .from('projects')
      .update({
        sync_status: 'synced',
        last_sync_payload: null
      })
      .eq('id', projectId);

    return NextResponse.json({ 
      success: true, 
      message: `Resolução de conflitos aplicada com sucesso.` 
    })

  } catch (error: any) {
    console.error('Erro ao aplicar resolução de sync:', error)
    return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 })
  }
}
