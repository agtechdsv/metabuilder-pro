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

    // 1.5 Obter targetSchema dos models existentes para não hardcodar como 'public'
    const { data: existingModelSchema } = await supabase
      .from('models')
      .select('db_schema_name')
      .eq('project_id', projectId)
      .limit(1)
      .single();

    const targetSchema = existingModelSchema?.db_schema_name || 'public';

    // 1.8 CAPTURAR NOMES ANTIGOS ANTES DA ATUALIZAÇÃO
    const oldTableNames: Record<string, string> = {}
    if (mappedTables && Object.keys(mappedTables).length > 0) {
      const { data: mData } = await supabase.from('models').select('id, db_table_name').in('id', Object.keys(mappedTables));
      if (mData) mData.forEach(m => oldTableNames[m.id] = m.db_table_name);
    }

    const oldFieldNames: Record<string, { modelId: string, table: string, col: string }> = {}
    if (mappedFields && Object.keys(mappedFields).length > 0) {
      const { data: fData } = await supabase.from('fields').select('id, db_column_name, model_id').in('id', Object.keys(mappedFields));
      if (fData && fData.length > 0) {
        const { data: modelsForF } = await supabase.from('models').select('id, db_table_name').in('id', fData.map(f => f.model_id));
        const modelLookup: Record<string, string> = {};
        if (modelsForF) modelsForF.forEach(m => modelLookup[m.id] = m.db_table_name);

        fData.forEach(f => {
          oldFieldNames[f.id] = { modelId: f.model_id, table: modelLookup[f.model_id] || '', col: f.db_column_name };
        });
      }
    }

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
                relation_type: relationType,
                source: 'cli'
              })
          }
        }
      }
    }

    // 4.4 Atualizar Views que usavam os nomes antigos
    if (Object.keys(mappedTables).length > 0 || Object.keys(mappedFields).length > 0) {
      
      const updateBpmTextVariables = (text: string) => {
        if (!text || typeof text !== 'string') return text;
        let newText = text;
        Object.entries(mappedTables).forEach(([modelId, newTableName]) => {
           const oldTableName = oldTableNames[modelId];
           if (oldTableName) {
             const regex = new RegExp(`\\{\\{${oldTableName}\\.`, 'g');
             newText = newText.replace(regex, `{{${newTableName}.`);
           }
        });
        Object.entries(mappedFields).forEach(([fieldId, newColName]) => {
           const oldField = oldFieldNames[fieldId];
           if (oldField) {
             const currentTableName = mappedTables[oldField.modelId] || oldField.table;
             const regex = new RegExp(`\\{\\{${currentTableName}\\.${oldField.col}\\}\\}`, 'g');
             newText = newText.replace(regex, `{{${currentTableName}.${newColName}}}`);
           }
        });
        return newText;
      };

      const updateNodes = (nodes: any[]) => {
        let hasNodeChanges = false;
        nodes.forEach((node: any) => {
           if (!node.data) return;
           let nodeChanged = false;

           const replaceColName = (modelId: string, col: string) => {
              let newName = col;
              Object.entries(mappedFields).forEach(([fieldId, newColName]) => {
                 const oldField = oldFieldNames[fieldId];
                 // Use rule's modelId if it exists, otherwise fall back to trigger/action modelId
                 if (oldField && oldField.col === col && (!modelId || modelId === oldField.modelId)) {
                    newName = newColName as string;
                    nodeChanged = true;
                 }
              });
              return newName;
           };

           if (node.data.actionEmailField) {
              node.data.actionEmailField = replaceColName(node.data.actionModelId, node.data.actionEmailField);
           }

           if (node.data.actionFilters && Array.isArray(node.data.actionFilters)) {
              node.data.actionFilters.forEach((filter: any) => {
                 if (filter.field) filter.field = replaceColName(node.data.actionModelId, filter.field);
                 if (typeof filter.value === 'string') filter.value = updateBpmTextVariables(filter.value);
              });
           }

           if (node.data.actionFields && Array.isArray(node.data.actionFields)) {
              node.data.actionFields.forEach((field: any) => {
                 if (field.field) field.field = replaceColName(node.data.actionModelId, field.field);
                 if (typeof field.value === 'string') field.value = updateBpmTextVariables(field.value);
              });
           }

           if (node.data.conditionGroups && Array.isArray(node.data.conditionGroups)) {
              node.data.conditionGroups.forEach((group: any) => {
                 if (group.rules && Array.isArray(group.rules)) {
                    group.rules.forEach((rule: any) => {
                       // A regra de condição salva seu próprio modelId
                       if (rule.field) rule.field = replaceColName(rule.modelId || node.data.triggerModelId, rule.field);
                    });
                 }
              });
           }

           const textKeys = ['actionSubject', 'actionBody', 'customEmailField', 'webhookUrl', 'webhookHeaders', 'webhookBody', 'emailSpecificUsers'];
           textKeys.forEach(key => {
              if (node.data[key] && typeof node.data[key] === 'string') {
                 const updated = updateBpmTextVariables(node.data[key]);
                 if (updated !== node.data[key]) {
                    node.data[key] = updated;
                    nodeChanged = true;
                 }
              }
           });

           if (nodeChanged) hasNodeChanges = true;
        });
        return hasNodeChanges;
      };

      const updateComponentBlock = (component: any) => {
        if (!component || !component.rel_table) return false;
        let blockChanged = false;
        
        Object.entries(mappedTables).forEach(([modelId, newTableName]) => {
          const oldTableName = oldTableNames[modelId];
          if (component.rel_table === oldTableName) {
            component.rel_table = newTableName;
            blockChanged = true;
          }
        });
        
        Object.entries(mappedFields).forEach(([fieldId, newColName]) => {
          const oldField = oldFieldNames[fieldId];
          if (!oldField) return;
          const newTableNameForThisField = mappedTables[oldField.modelId] || oldField.table;
          
          if (component.rel_table === oldField.table || component.rel_table === newTableNameForThisField) {
            if (component.rel_label === oldField.col) {
              component.rel_label = newColName;
              blockChanged = true;
            }
            if (component.rel_value === oldField.col) {
              component.rel_value = newColName;
              blockChanged = true;
            }
          }
        });
        return blockChanged;
      };

      // Buscar as views do projeto e alterar
      const { data: uiViews } = await supabase.from('ui_views').select('id, layout_config').eq('project_id', projectId);
      
      if (uiViews && uiViews.length > 0) {
        for (const view of uiViews) {
          if (!view.layout_config) continue;
          let hasChanges = false;
          let newConfig = typeof view.layout_config === 'object' ? { ...view.layout_config } : {};
          
          if (newConfig.joins && Array.isArray(newConfig.joins)) {
            newConfig.joins.forEach((join: any) => {
               // Update tables
               Object.entries(mappedTables).forEach(([modelId, newTableName]) => {
                  const oldTableName = oldTableNames[modelId];
                  if (join.from === oldTableName) { join.from = newTableName; hasChanges = true; }
                  if (join.to === oldTableName) { join.to = newTableName; hasChanges = true; }
               });
               
               // Update columns
               Object.entries(mappedFields).forEach(([fieldId, newColName]) => {
                  const oldField = oldFieldNames[fieldId];
                  if (!oldField) return;
                  const newTableNameForThisField = mappedTables[oldField.modelId] || oldField.table;
                  
                  if ((join.from === oldField.table || join.from === newTableNameForThisField) && join.localKey === oldField.col) {
                     join.localKey = newColName;
                     hasChanges = true;
                  }
                  if ((join.to === oldField.table || join.to === newTableNameForThisField) && join.foreignKey === oldField.col) {
                     join.foreignKey = newColName;
                     hasChanges = true;
                  }
               });
            });
          }

          if (newConfig.custom_actions && Array.isArray(newConfig.custom_actions)) {
            newConfig.custom_actions.forEach((act: any) => {
               if (act.usecase_selected_fields && Array.isArray(act.usecase_selected_fields)) {
                  act.usecase_selected_fields = act.usecase_selected_fields.map((f: any) => {
                     if (typeof f === 'string') {
                       let newName = f;
                       Object.entries(mappedFields).forEach(([fieldId, newColName]) => {
                          const oldField = oldFieldNames[fieldId];
                          if (oldField && oldField.col === f) { newName = newColName as string; hasChanges = true; }
                       });
                       return newName;
                     } else if (f && typeof f === 'object' && f.source && f.target) {
                       let newSource = f.source;
                       let newTarget = f.target;
                       Object.entries(mappedFields).forEach(([fieldId, newColName]) => {
                          const oldField = oldFieldNames[fieldId];
                          if (oldField && oldField.col === f.source) { newSource = newColName as string; hasChanges = true; }
                          // Note: target usually belongs to the DESTINATION usecase, so we might not be able to map it here directly unless it's the same project. We will map it anyway just in case.
                          if (oldField && oldField.col === f.target) { newTarget = newColName as string; hasChanges = true; }
                       });
                       return { ...f, source: newSource, target: newTarget };
                     }
                     return f;
                  });
               }
            });
          }

          if (newConfig.nodes && Array.isArray(newConfig.nodes)) {
             if (updateNodes(newConfig.nodes)) {
                 hasChanges = true;
             }
          }

          if (newConfig.fields_metadata) {
            Object.values(newConfig.fields_metadata).forEach((meta: any) => {
              if (updateComponentBlock(meta.component)) {
                hasChanges = true;
              }
            });
          }
          
          if (hasChanges) {
             await supabase.from('ui_views').update({ layout_config: newConfig }).eq('id', view.id);
          }
        }
      }

      // Atualizar também a tabela desnormalizada ui_components
      const viewIds = uiViews?.map(v => v.id) || [];
      if (viewIds.length > 0) {
        const { data: uiComponents } = await supabase.from('ui_components').select('id, config').in('view_id', viewIds);
        
        if (uiComponents && uiComponents.length > 0) {
          for (const comp of uiComponents) {
            if (!comp.config) continue;
            let compHasChanges = false;
            let newConfig = typeof comp.config === 'object' ? { ...comp.config } : {};
            
            if (updateComponentBlock(newConfig.component)) compHasChanges = true;
            if (newConfig.form_config && updateComponentBlock(newConfig.form_config.component)) compHasChanges = true;
            if (newConfig.grid_config && updateComponentBlock(newConfig.grid_config.component)) compHasChanges = true;
            if (newConfig.filter_config && updateComponentBlock(newConfig.filter_config.component)) compHasChanges = true;

            if (compHasChanges) {
              await supabase.from('ui_components').update({ config: newConfig }).eq('id', comp.id);
            }
          }
        }
      }

      // Atualizar também fluxos BPM que usam campos e tabelas (Tabela bpm_workflows)
      const { data: bpmWorkflows } = await supabase.from('bpm_workflows').select('id, flow_data, draft_flow_data').eq('project_id', projectId);
      if (bpmWorkflows && bpmWorkflows.length > 0) {
         for (const wf of bpmWorkflows) {
            let wfHasChanges = false;
            const updatePayload: any = {};

            if (wf.flow_data && wf.flow_data.nodes && Array.isArray(wf.flow_data.nodes)) {
               const clonedNodes = JSON.parse(JSON.stringify(wf.flow_data.nodes)); // deep copy safely
               if (updateNodes(clonedNodes)) {
                  updatePayload.flow_data = { ...wf.flow_data, nodes: clonedNodes };
                  wfHasChanges = true;
               }
            }

            if (wf.draft_flow_data && wf.draft_flow_data.nodes && Array.isArray(wf.draft_flow_data.nodes)) {
               const clonedNodes = JSON.parse(JSON.stringify(wf.draft_flow_data.nodes));
               if (updateNodes(clonedNodes)) {
                  updatePayload.draft_flow_data = { ...wf.draft_flow_data, nodes: clonedNodes };
                  wfHasChanges = true;
               }
            }

            if (wfHasChanges) {
               await supabase.from('bpm_workflows').update(updatePayload).eq('id', wf.id);
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
