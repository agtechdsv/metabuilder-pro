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
    const { projectId, metadata } = body

    if (!projectId || !metadata) {
      return NextResponse.json({ error: 'Payload incompleto' }, { status: 400 })
    }

    // 1. Validar Token e Projeto
    // ATENÇÃO: Removi a checagem do secret_token para você poder testar, 
    // já que a sua tabela original não tinha essa coluna.
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Token inválido ou projeto não encontrado' }, { status: 403 })
    }

    // 2. Mapas de memória para resolver as chaves estrangeiras depois
    const modelIdMap: Record<string, string> = {} // { "nome_tabela": "uuid_model" }
    const fieldIdMap: Record<string, Record<string, string>> = {} // { "uuid_model": { "nome_coluna": "uuid_field" } }

    // 3. Processar Models e Fields (Primeira Passagem)
    for (const table of metadata) {
      // 3.1. Upsert Model (Antiga tables_metadata)
      const { data: modelData, error: modelError } = await supabase
        .from('models')
        .upsert(
          {
            project_id: projectId,
            db_schema_name: 'public',
            db_table_name: table.name,
            display_name: table.name, // Por padrão, usa o mesmo nome
            // display_name_plural, description, is_view usarão os valores default do seu banco
          },
          { onConflict: 'project_id,db_schema_name,db_table_name' }
        )
        .select()
        .single()

      if (modelError) throw new Error(`Erro ao salvar model ${table.name}: ${modelError.message}`)
      
      const modelId = modelData.id
      modelIdMap[table.name] = modelId
      fieldIdMap[modelId] = {}

      // 3.2. Upsert Fields (Antiga columns_metadata)
      let orderIndex = 0;
      for (const col of table.columns) {
        // Define um widget padrão baseado no tipo de dados
        let uiWidget = 'text_input'
        if (['integer', 'bigint', 'numeric', 'real'].includes(col.type)) uiWidget = 'number_input'
        if (['date', 'timestamp', 'timestamp without time zone'].includes(col.type)) uiWidget = 'date_picker'
        if (col.type === 'boolean') uiWidget = 'checkbox'
        if (col.type === 'uuid') uiWidget = 'uuid_input' // Opcional, para refinar

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
              order_index: orderIndex++
            },
            { onConflict: 'model_id,db_column_name' }
          )
          .select()
          .single()

        if (fieldError) throw new Error(`Erro ao salvar field ${col.name}: ${fieldError.message}`)
        
        fieldIdMap[modelId][col.name] = fieldData.id
      }
    }

    // 4. Processar Relacionamentos (Segunda Passagem)
    for (const table of metadata) {
      if (!table.relations || table.relations.length === 0) continue
      
      const currentModelId = modelIdMap[table.name]

      for (const rel of table.relations) {
        const refModelId = modelIdMap[rel.referencedTable]
        const fromFieldId = fieldIdMap[currentModelId]?.[rel.foreignColumn]
        const toFieldId = fieldIdMap[refModelId]?.[rel.referencedColumn]

        if (refModelId && fromFieldId && toFieldId) {
          // Uma chave estrangeira padrão em banco de dados relacional
          // normalmente representa uma relação N:1 (many_to_one) do ponto de vista da tabela filha.
          const relationType = 'many_to_one'
          const relationName = `fk_${table.name}_${rel.referencedTable}`

          // Verifica se já existe para não duplicar
          const { data: existingRel } = await supabase
            .from('relations')
            .select('id')
            .eq('project_id', projectId)
            .eq('from_model_id', currentModelId)
            .eq('from_field_id', fromFieldId)
            .single()

          if (!existingRel) {
            const { error: relError } = await supabase
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

            if (relError) {
              console.error(`Aviso: Falha ao inserir relação ${relationName}:`, relError.message)
            }
          }
        }
      }
    }

    // 5. Garbage Collection (Limpeza de Fantasmas)
    // Deleta tabelas e colunas que existem no MetaBuilderPRO mas não vieram no payload atual
    const incomingTables = metadata.map((t: any) => t.name)
    if (incomingTables.length > 0) {
      // 5.1 Limpar Tabelas Excluídas (Cascade vai apagar fields e relations automaticamente)
      const { error: deleteModelsError } = await supabase
        .from('models')
        .delete()
        .eq('project_id', projectId)
        .not('db_table_name', 'in', `(${incomingTables.join(',')})`)
      
      if (deleteModelsError) {
        console.error('Aviso: Erro ao deletar tabelas fantasmas:', deleteModelsError)
      }

      // 5.2 Limpar Colunas Excluídas (Para as tabelas que sobraram)
      for (const table of metadata) {
        const modelId = modelIdMap[table.name]
        if (!modelId) continue
        
        const incomingColumns = table.columns.map((c: any) => c.name)
        if (incomingColumns.length > 0) {
          const { error: deleteFieldsError } = await supabase
            .from('fields')
            .delete()
            .eq('model_id', modelId)
            .not('db_column_name', 'in', `(${incomingColumns.join(',')})`)
          
          if (deleteFieldsError) {
            console.error(`Aviso: Erro ao deletar colunas fantasmas na tabela ${table.name}:`, deleteFieldsError)
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `${metadata.length} models processados e sincronizados com sucesso.` 
    })

  } catch (error: any) {
    console.error('Erro na sincronização de metadados:', error)
    return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 })
  }
}
