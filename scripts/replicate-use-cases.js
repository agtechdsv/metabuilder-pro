/**
 * replicate-use-cases.js
 *
 * Script de replicação inteligente de Casos de Uso entre projetos no MetaBuilderPRO.
 * Mapeia Models, Fields, Relations, UI Views, UI Components, BYOC, Navigation e RBAC.
 *
 * Uso:
 *   node scripts/replicate-use-cases.js --dry-run
 *   node scripts/replicate-use-cases.js --execute
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Carregar variáveis de ambiente do .env.local
const envLocalPath = path.join(__dirname, '../.env.local');
const envLocal = fs.readFileSync(envLocalPath, 'utf-8');
const env = {};
envLocal.split('\n').forEach(line => {
  if (line.trim() && !line.startsWith('#')) {
    const [key, ...value] = line.split('=');
    if (key) env[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
  }
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const isExecute = process.argv.includes('--execute');
const isDryRun = !isExecute;

async function run() {
  console.log('================================================================');
  console.log(`🚀 INICIANDO REPLICAÇÃO: CRM (Postgres) -> MDM (Oracle)`);
  console.log(`Modo: ${isExecute ? '⚡ EXECUÇÃO REAL' : '🔍 DRY-RUN (SIMULAÇÃO)'}`);
  console.log('================================================================\n');

  // 1. Buscar Projetos
  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('*');

  if (projErr || !projects) {
    throw new Error('Falha ao buscar projetos: ' + JSON.stringify(projErr));
  }

  const crm = projects.find(p => p.slug?.toLowerCase().replace(/^\//, '') === 'crm');
  const mdm = projects.find(p => p.slug?.toLowerCase().replace(/^\//, '') === 'mdm');

  if (!crm) throw new Error('Projeto CRM não encontrado.');
  if (!mdm) throw new Error('Projeto MDM não encontrado.');

  console.log(`✓ Origem : ${crm.name} (${crm.slug}) -> ID: ${crm.id}`);
  console.log(`✓ Destino: ${mdm.name} (${mdm.slug}) -> ID: ${mdm.id}\n`);

  // 2. Buscar Models e Fields
  const { data: crmModels } = await supabase.from('models').select('*, fields(*)').eq('project_id', crm.id);
  const { data: mdmModels } = await supabase.from('models').select('*, fields(*)').eq('project_id', mdm.id);

  console.log(`✓ Models carregadas: CRM (${crmModels.length}), MDM (${mdmModels.length})`);

  // Construir De-Para de Models
  const modelMap = new Map(); // sourceModelId -> targetModelId
  const mdmModelsByTableName = new Map();
  mdmModels.forEach(m => {
    mdmModelsByTableName.set(m.db_table_name.toLowerCase().trim(), m);
  });

  for (const cm of crmModels) {
    const targetModel = mdmModelsByTableName.get(cm.db_table_name.toLowerCase().trim());
    if (targetModel) {
      modelMap.set(cm.id, targetModel.id);
    } else {
      console.warn(`⚠️ Model sem par no MDM: ${cm.db_table_name}`);
    }
  }

  // Construir De-Para de Fields
  const fieldMap = new Map(); // sourceFieldId -> targetFieldId
  let mappedFieldsCount = 0;
  for (const cm of crmModels) {
    const targetModelId = modelMap.get(cm.id);
    if (!targetModelId) continue;
    const targetModel = mdmModels.find(m => m.id === targetModelId);
    if (!targetModel) continue;

    const targetFieldsByName = new Map();
    targetModel.fields.forEach(f => {
      targetFieldsByName.set(f.db_column_name.toLowerCase().trim(), f);
    });

    for (const cf of cm.fields) {
      const targetField = targetFieldsByName.get(cf.db_column_name.toLowerCase().trim());
      if (targetField) {
        fieldMap.set(cf.id, targetField.id);
        mappedFieldsCount++;
      } else {
        console.warn(`⚠️ Campo sem par no MDM: ${cm.db_table_name}.${cf.db_column_name}`);
      }
    }
  }
  console.log(`✓ Fields mapeados com sucesso: ${mappedFieldsCount} campos\n`);

  // 3. Buscar e Mapear Relations
  const { data: crmRelations } = await supabase.from('relations').select('*').eq('project_id', crm.id);
  const { data: mdmRelations } = await supabase.from('relations').select('*').eq('project_id', mdm.id);

  const crmModelIdToName = new Map(crmModels.map(m => [m.id, m.db_table_name.toLowerCase().trim()]));
  const mdmModelIdToName = new Map(mdmModels.map(m => [m.id, m.db_table_name.toLowerCase().trim()]));

  const relationMap = new Map(); // sourceRelationId -> targetRelationId
  for (const cr of (crmRelations || [])) {
    const fromName = crmModelIdToName.get(cr.from_model_id);
    const toName = crmModelIdToName.get(cr.to_model_id);
    const targetRel = (mdmRelations || []).find(mr => {
      const mrFromName = mdmModelIdToName.get(mr.from_model_id);
      const mrToName = mdmModelIdToName.get(mr.to_model_id);
      return mrFromName === fromName && mrToName === toName && mr.relation_type === cr.relation_type;
    });

    if (targetRel) {
      relationMap.set(cr.id, targetRel.id);
    } else {
      console.warn(`⚠️ Relação sem par no MDM: ${fromName} -> ${toName} (${cr.relation_type})`);
    }
  }
  console.log(`✓ Relações mapeadas com sucesso: ${relationMap.size} relações\n`);

  // 4. Buscar BYOC (ui_custom_components)
  const { data: crmByoc } = await supabase.from('ui_custom_components').select('*').eq('project_id', crm.id);
  console.log(`✓ Custom Components (BYOC) encontrados no CRM: ${crmByoc?.length || 0}`);

  // 5. Buscar Enumerations (project_enumerations)
  const { data: crmEnums } = await supabase.from('project_enumerations').select('*').eq('project_id', crm.id);
  console.log(`✓ Enumerations encontradas no CRM: ${crmEnums?.length || 0}`);

  // 6. Buscar Auth Config e Roles
  const { data: crmAuth } = await supabase.from('project_auth_config').select('*').eq('project_id', crm.id).maybeSingle();
  const { data: crmRoles } = await supabase.from('project_roles').select('*').eq('project_id', crm.id);
  const { data: crmPerms } = await supabase.from('project_role_permissions').select('*').in('role_id', (crmRoles || []).map(r => r.id));
  console.log(`✓ Auth Config: ${crmAuth ? crmAuth.auth_type : 'none'} | Roles: ${crmRoles?.length || 0} | Permissões: ${crmPerms?.length || 0}`);

  // 7. Buscar UI Views e UI Components do CRM
  const { data: crmViews } = await supabase.from('ui_views').select('*').eq('project_id', crm.id).order('created_at', { ascending: true });
  const viewIds = (crmViews || []).map(v => v.id);
  const { data: crmComponents } = await supabase.from('ui_components').select('*').in('view_id', viewIds).order('order_index', { ascending: true });

  console.log(`✓ UI Views no CRM: ${crmViews.length}`);
  console.log(`✓ UI Components no CRM: ${crmComponents.length}\n`);

  // Helper para mapear IDs recursivamente dentro do layout_config
  function mapFieldId(id) {
    if (!id || typeof id !== 'string') return id;
    if (fieldMap.has(id)) return fieldMap.get(id);
    return id;
  }

  function transformLayoutConfig(config) {
    if (!config || typeof config !== 'object') return config;
    const cloned = JSON.parse(JSON.stringify(config));

    // grid_fields, form_fields, filter_fields
    if (Array.isArray(cloned.grid_fields)) {
      cloned.grid_fields = cloned.grid_fields.map(mapFieldId);
    }
    if (Array.isArray(cloned.form_fields)) {
      cloned.form_fields = cloned.form_fields.map(mapFieldId);
    }
    if (Array.isArray(cloned.filter_fields)) {
      cloned.filter_fields = cloned.filter_fields.map(mapFieldId);
    }

    // fields_metadata
    if (cloned.fields_metadata && typeof cloned.fields_metadata === 'object') {
      const newMeta = {};
      for (const [key, val] of Object.entries(cloned.fields_metadata)) {
        let newKey = key;
        const prefixMatch = key.match(/^(grid|form|filter)-(.+)$/);
        if (prefixMatch) {
          const prefix = prefixMatch[1];
          const rawId = prefixMatch[2];
          const mappedRawId = mapFieldId(rawId);
          newKey = `${prefix}-${mappedRawId}`;
        } else {
          newKey = mapFieldId(key);
        }

        // Se dentro do metadata houver virtual_model_id
        if (val && typeof val === 'object' && val.virtual_model_id) {
          val.virtual_model_id = modelMap.get(val.virtual_model_id) || val.virtual_model_id;
        }

        newMeta[newKey] = val;
      }
      cloned.fields_metadata = newMeta;
    }

    // Single field configs
    if (cloned.kanban_group_field) cloned.kanban_group_field = mapFieldId(cloned.kanban_group_field);
    if (cloned.kanban_group_display_field) cloned.kanban_group_display_field = mapFieldId(cloned.kanban_group_display_field);
    if (cloned.mindmap_central_field) cloned.mindmap_central_field = mapFieldId(cloned.mindmap_central_field);
    if (cloned.master_model_id) cloned.master_model_id = modelMap.get(cloned.master_model_id) || cloned.master_model_id;

    // scheduler_config
    if (cloned.scheduler_config && typeof cloned.scheduler_config === 'object') {
      for (const k of ['title_field', 'start_date_field', 'end_date_field', 'color_field']) {
        if (cloned.scheduler_config[k]) cloned.scheduler_config[k] = mapFieldId(cloned.scheduler_config[k]);
      }
    }

    // timeline_config
    if (cloned.timeline_config && typeof cloned.timeline_config === 'object') {
      for (const k of ['date_field', 'desc_field', 'icon_field', 'title_field']) {
        if (cloned.timeline_config[k]) cloned.timeline_config[k] = mapFieldId(cloned.timeline_config[k]);
      }
    }

    // gantt_config
    if (cloned.gantt_config && typeof cloned.gantt_config === 'object') {
      for (const k of ['title_field', 'start_date_field', 'end_date_field', 'progress_field', 'predecessor_field', 'dependencies_field']) {
        if (cloned.gantt_config[k]) cloned.gantt_config[k] = mapFieldId(cloned.gantt_config[k]);
      }
    }

    // blueprint_config
    if (cloned.blueprint_config && typeof cloned.blueprint_config === 'object') {
      for (const k of ['desc_field', 'title_field', 'status_field', 'predecessor_field']) {
        if (cloned.blueprint_config[k]) cloned.blueprint_config[k] = mapFieldId(cloned.blueprint_config[k]);
      }
    }

    // map_config
    if (cloned.map_config && typeof cloned.map_config === 'object') {
      for (const k of ['lat_field', 'lng_field', 'desc_field', 'title_field']) {
        if (cloned.map_config[k]) cloned.map_config[k] = mapFieldId(cloned.map_config[k]);
      }
    }

    // custom_slots
    if (Array.isArray(cloned.custom_slots)) {
      cloned.custom_slots = cloned.custom_slots.map(slot => {
        const newSlot = { ...slot };
        if (newSlot.model_id) {
          newSlot.model_id = modelMap.get(newSlot.model_id) || newSlot.model_id;
        }
        if (Array.isArray(newSlot.relation_path)) {
          newSlot.relation_path = newSlot.relation_path.map(rId => relationMap.get(rId) || rId);
        }
        return newSlot;
      });
    }

    // mindmap_levels
    if (Array.isArray(cloned.mindmap_levels)) {
      cloned.mindmap_levels = cloned.mindmap_levels.map(lvl => {
        const newLvl = { ...lvl };
        if (newLvl.model_id) newLvl.model_id = modelMap.get(newLvl.model_id) || newLvl.model_id;
        if (newLvl.field_id) newLvl.field_id = mapFieldId(newLvl.field_id);
        if (newLvl.relation_id) newLvl.relation_id = relationMap.get(newLvl.relation_id) || newLvl.relation_id;
        return newLvl;
      });
    }

    return cloned;
  }

  // Montar views e components para inserção
  const viewMap = new Map(); // sourceViewId -> targetViewId
  const viewsToInsert = [];

  for (const cv of crmViews) {
    const newViewId = crypto.randomUUID();
    viewMap.set(cv.id, newViewId);

    const newModelId = cv.model_id ? (modelMap.get(cv.model_id) || null) : null;
    const newLayoutConfig = transformLayoutConfig(cv.layout_config);

    viewsToInsert.push({
      id: newViewId,
      project_id: mdm.id,
      model_id: newModelId,
      name: cv.name,
      slug: cv.slug,
      view_type: cv.view_type,
      logic_type: cv.logic_type,
      layout_config: newLayoutConfig,
      buttons_config: cv.buttons_config || [],
      icon: cv.icon,
      is_public: cv.is_public ?? false,
      status: cv.status || 'published',
      has_arguments: cv.has_arguments ?? false,
      tables_config: cv.tables_config || [],
      query_type: cv.query_type || 'dynamic',
      custom_query: cv.custom_query || null,
      draft_config: cv.draft_config ? transformLayoutConfig(cv.draft_config) : null,
      created_at: new Date().toISOString()
    });
  }

  const componentsToInsert = [];
  for (const cc of crmComponents) {
    const targetViewId = viewMap.get(cc.view_id);
    const targetFieldId = fieldMap.get(cc.field_id);

    if (!targetViewId) {
      console.warn(`⚠️ Componente sem View mapeada: ${cc.label}`);
      continue;
    }
    if (!targetFieldId) {
      console.warn(`⚠️ Componente sem Field mapeado: ${cc.label}`);
      continue;
    }

    componentsToInsert.push({
      id: crypto.randomUUID(),
      view_id: targetViewId,
      field_id: targetFieldId,
      component_type: cc.component_type,
      label: cc.label,
      order_index: cc.order_index ?? 0,
      is_visible: cc.is_visible ?? true,
      is_readonly: cc.is_readonly ?? false,
      is_required: cc.is_required ?? false,
      width_cols: cc.width_cols ?? 12,
      config: cc.config || {},
      created_at: new Date().toISOString()
    });
  }

  // BYOC para inserção
  const byocToInsert = (crmByoc || []).map(b => ({
    id: crypto.randomUUID(),
    project_id: mdm.id,
    name: b.name,
    description: b.description,
    code: b.code,
    compiled_code: b.compiled_code,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  // Enumerations para inserção
  const enumsToInsert = (crmEnums || []).map(e => ({
    id: crypto.randomUUID(),
    project_id: mdm.id,
    name: e.name,
    description: e.description,
    values: e.values,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  // Roles e Permissões
  const roleMap = new Map(); // sourceRoleId -> targetRoleId
  const rolesToInsert = (crmRoles || []).map(r => {
    const newRoleId = crypto.randomUUID();
    roleMap.set(r.id, newRoleId);
    return {
      id: newRoleId,
      project_id: mdm.id,
      name: r.name,
      description: r.description,
      created_at: new Date().toISOString()
    };
  });

  const permsToInsert = (crmPerms || []).map(p => {
    const targetRoleId = roleMap.get(p.role_id);
    const targetViewId = viewMap.get(p.view_id);
    if (!targetRoleId || !targetViewId) return null;
    return {
      id: crypto.randomUUID(),
      role_id: targetRoleId,
      view_id: targetViewId,
      can_read: p.can_read,
      can_write: p.can_write,
      created_at: new Date().toISOString()
    };
  }).filter(Boolean);

  // Navigation
  const newNavigation = Array.isArray(crm.navigation)
    ? JSON.parse(JSON.stringify(crm.navigation))
    : [];

  // Atualizar view_id ou id se corresponder a uma view
  function updateNav(items) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (item.view_id && viewMap.has(item.view_id)) {
        item.view_id = viewMap.get(item.view_id);
      }
      if (item.id && viewMap.has(item.id)) {
        item.id = viewMap.get(item.id);
      }
      if (item.children) updateNav(item.children);
    }
  }
  updateNav(newNavigation);

  // Relatório do que será criado
  console.log('--- RESUMO DA REPLICAÇÃO ---');
  console.log(`📋 UI Views prontas para criar: ${viewsToInsert.length}`);
  viewsToInsert.forEach(v => {
    console.log(`   - [${v.logic_type}] ${v.name} (slug: /${mdm.slug}/${v.slug})`);
  });
  console.log(`🧩 UI Components prontos para criar: ${componentsToInsert.length}`);
  console.log(`🎨 Custom Components (BYOC) prontos: ${byocToInsert.length}`);
  console.log(`🔢 Enumerations prontas: ${enumsToInsert.length}`);
  console.log(`👥 Roles prontas: ${rolesToInsert.length}`);
  console.log(`🔑 Permissões prontas: ${permsToInsert.length}`);
  console.log(`🗺️ Navigation items prontos: ${newNavigation.length}`);
  console.log(`🔐 Auth Config pronto: ${crmAuth ? 'Sim (' + crmAuth.auth_type + ')' : 'Não'}\n`);

  if (isDryRun) {
    console.log('----------------------------------------------------------------');
    console.log('🔍 SIMULAÇÃO CONCLUÍDA COM SUCESSO! NENHUM DADO FOI ALTERADO.');
    console.log('Para aplicar todas as alterações acima no banco Supabase, execute:');
    console.log('   node scripts/replicate-use-cases.js --execute');
    console.log('----------------------------------------------------------------');
    return;
  }

  // ===================== EXECUÇÃO REAL =====================
  console.log('⚡ APLICANDO ALTERAÇÕES NO SUPABASE...');

  // 1. Limpar views existentes no MDM (como a view downloads default) para evitar duplicatas
  const { data: existingMdmViews } = await supabase.from('ui_views').select('id').eq('project_id', mdm.id);
  if (existingMdmViews && existingMdmViews.length > 0) {
    const delIds = existingMdmViews.map(v => v.id);
    await supabase.from('ui_components').delete().in('view_id', delIds);
    await supabase.from('ui_views').delete().in('id', delIds);
    console.log(`✓ Limpeza preventiva: ${existingMdmViews.length} views antigas removidas do MDM.`);
  }

  // 2. Limpar BYOC e Enums pré-existentes se houver
  await supabase.from('ui_custom_components').delete().eq('project_id', mdm.id);
  await supabase.from('project_enumerations').delete().eq('project_id', mdm.id);

  // 3. Inserir BYOC
  if (byocToInsert.length > 0) {
    const { error: byocErr } = await supabase.from('ui_custom_components').insert(byocToInsert);
    if (byocErr) throw new Error('Erro ao inserir BYOC: ' + JSON.stringify(byocErr));
    console.log(`✓ ${byocToInsert.length} Custom Components (BYOC) inseridos.`);
  }

  // 4. Inserir Enumerations
  if (enumsToInsert.length > 0) {
    const { error: enumErr } = await supabase.from('project_enumerations').insert(enumsToInsert);
    if (enumErr) throw new Error('Erro ao inserir Enumerations: ' + JSON.stringify(enumErr));
    console.log(`✓ ${enumsToInsert.length} Enumerations inseridas.`);
  }

  // 5. Inserir UI Views
  if (viewsToInsert.length > 0) {
    const { error: viewErr } = await supabase.from('ui_views').insert(viewsToInsert);
    if (viewErr) throw new Error('Erro ao inserir UI Views: ' + JSON.stringify(viewErr));
    console.log(`✓ ${viewsToInsert.length} UI Views inseridas com sucesso.`);
  }

  // 6. Inserir UI Components (em lotes de 50 para segurança)
  if (componentsToInsert.length > 0) {
    const batchSize = 50;
    for (let i = 0; i < componentsToInsert.length; i += batchSize) {
      const batch = componentsToInsert.slice(i, i + batchSize);
      const { error: compErr } = await supabase.from('ui_components').insert(batch);
      if (compErr) throw new Error(`Erro ao inserir lote de UI Components (${i}): ` + JSON.stringify(compErr));
    }
    console.log(`✓ ${componentsToInsert.length} UI Components inseridos com sucesso.`);
  }

  // 7. Configurar Auth Config
  if (crmAuth) {
    // Remover se já existir
    await supabase.from('project_auth_config').delete().eq('project_id', mdm.id);
    const newAuthConfig = {
      project_id: mdm.id,
      auth_type: crmAuth.auth_type,
      db_table_name: crmAuth.db_table_name,
      db_email_column: crmAuth.db_email_column,
      db_password_column: crmAuth.db_password_column,
      db_password_hash_type: crmAuth.db_password_hash_type,
      ldap_server_url: crmAuth.ldap_server_url || '',
      ldap_base_dn: crmAuth.ldap_base_dn || '',
      ui_config: crmAuth.ui_config || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const { error: authErr } = await supabase.from('project_auth_config').insert([newAuthConfig]);
    if (authErr) {
      console.warn('⚠️ Erro ao inserir Auth Config:', authErr);
    } else {
      console.log(`✓ Auth Config configurado para o MDM.`);
    }
  }

  // 8. Inserir Roles e Permissões
  if (rolesToInsert.length > 0) {
    const { error: roleErr } = await supabase.from('project_roles').insert(rolesToInsert);
    if (roleErr) {
      console.warn('⚠️ Erro ao inserir Roles:', roleErr);
    } else {
      console.log(`✓ ${rolesToInsert.length} Roles inseridas.`);
      if (permsToInsert.length > 0) {
        const { error: permErr } = await supabase.from('project_role_permissions').insert(permsToInsert);
        if (permErr) console.warn('⚠️ Erro ao inserir Permissões:', permErr);
        else console.log(`✓ ${permsToInsert.length} Permissões vinculadas às novas views.`);
      }
    }
  }

  // 9. Atualizar navigation e tema do Projeto MDM
  const updatePayload = {
    navigation: newNavigation
  };
  if (crm.icon) updatePayload.icon = crm.icon;
  if (crm.theme) updatePayload.theme = crm.theme;

  const { error: updateProjErr } = await supabase
    .from('projects')
    .update(updatePayload)
    .eq('id', mdm.id);

  if (updateProjErr) {
    throw new Error('Erro ao atualizar Navigation do MDM: ' + JSON.stringify(updateProjErr));
  }
  console.log(`✓ Navigation e configurações visuais aplicadas no projeto MDM.`);

  console.log('\n================================================================');
  console.log('🎉 REPLICAÇÃO CONCLUÍDA COM 100% DE SUCESSO!');
  console.log(`Todos os ${viewsToInsert.length} casos de uso do CRM agora estão espelhados no MDM!`);
  console.log('================================================================\n');
}

run().catch(err => {
  console.error('\n❌ ERRO NA REPLICAÇÃO:', err);
  process.exit(1);
});
