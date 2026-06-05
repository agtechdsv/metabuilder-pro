import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// O CLI não é um usuário logado no sentido tradicional.
// Ele é um serviço externo, por isso usamos a Service Role Key para ignorar RLS e validar o token.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token não fornecido' }, { status: 401 })
    }

    const secretToken = authHeader.replace('Bearer ', '')
    const body = await request.json()
    const { projectId, metadata, connectionName } = body

    if (!projectId || !metadata) {
      return NextResponse.json({ error: 'Payload incompleto' }, { status: 400 })
    }

    const targetSchema = connectionName || 'public'

    // 1. Validar Token e Projeto
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, secret_token')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Token secreto inválido ou projeto não encontrado' }, { status: 403 })
    }

    if (project.secret_token && project.secret_token !== secretToken) {
      return NextResponse.json({ error: 'Token secreto inválido' }, { status: 403 })
    }

    // 2. Buscar estado atual para comparar (Introspection Diffing)
    const { data: existingModels, error: fetchModelsError } = await supabase
      .from('models')
      .select('id, db_table_name')
      .eq('project_id', projectId)
      .eq('db_schema_name', targetSchema)

    if (fetchModelsError) throw fetchModelsError

    const existingTableNames = existingModels.map(m => m.db_table_name)
    const incomingTableNames = metadata.map((t: any) => t.name)

    const missingTables = existingTableNames.filter(name => !incomingTableNames.includes(name))
    
    // Comparar colunas das tabelas que NÃO estão missing
    let hasMissingFields = false;
    const missingFieldsMap: Record<string, string[]> = {}; // table -> [field1, field2]

    for (const existingModel of existingModels) {
      if (missingTables.includes(existingModel.db_table_name)) continue;

      const incomingTable = metadata.find((t: any) => t.name === existingModel.db_table_name);
      if (!incomingTable) continue;

      const { data: existingFields } = await supabase
        .from('fields')
        .select('id, db_column_name')
        .eq('model_id', existingModel.id);

      if (existingFields) {
        const existingColNames = existingFields.map(f => f.db_column_name);
        const incomingColNames = incomingTable.columns.map((c: any) => c.name);
        const missingCols = existingColNames.filter(name => !incomingColNames.includes(name));
        
        if (missingCols.length > 0) {
          hasMissingFields = true;
          missingFieldsMap[existingModel.db_table_name] = missingCols;
        }
      }
    }

    // 3. SAFE SYNC DRAFT LOGIC
    // Se houve deleções estruturais, abortamos o Upsert Direto e criamos um Draft!
    if (missingTables.length > 0 || hasMissingFields) {
      console.log(`[Safe Sync] Conflitos detectados no projeto ${projectId}. Tabelas sumidas: ${missingTables.length}. Campos sumidos: ${hasMissingFields}`);
      
      // Salva o payload no projeto e trava o status
      await supabase
        .from('projects')
        .update({
          sync_status: 'draft_pending',
          last_sync_payload: metadata
        })
        .eq('id', projectId);

      // Marca visualmente as tabelas como missing
      if (missingTables.length > 0) {
        await supabase
          .from('models')
          .update({ is_missing: true })
          .eq('project_id', projectId)
          .eq('db_schema_name', targetSchema)
          .in('db_table_name', missingTables);
      }

      // Marca visualmente os campos como missing
      for (const [tableName, cols] of Object.entries(missingFieldsMap)) {
        const modelId = existingModels.find(m => m.db_table_name === tableName)?.id;
        if (modelId && cols.length > 0) {
          await supabase
            .from('fields')
            .update({ is_missing: true })
            .eq('model_id', modelId)
            .in('db_column_name', cols);
        }
      }

      return NextResponse.json({ 
        success: true, 
        draftCreated: true,
        message: 'Divergências detectadas. Draft criado para resolução manual (Match Manual).'
      });
    }

    // 4. FAST-PATH (Somente Adições e Atualizações Seguras)
    // Se chegou aqui, nada foi deletado no banco do cliente. Podemos atualizar em tempo real.
    console.log(`[Safe Sync] Nenhuma exclusão perigosa detectada no projeto ${projectId}. Aplicando Fast-Path...`);

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
            is_missing: false // Garante que não está missing
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
      draftCreated: false,
      message: `${metadata.length} models processados e sincronizados com sucesso (Fast-Path).` 
    })

  } catch (error: any) {
    console.error('Erro na sincronização de metadados:', error)
    return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 })
  }
}
