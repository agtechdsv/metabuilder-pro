import JSZip from 'jszip'

export function generateFeatures(zip: JSZip, models: any[], uiViews: any[], dbType: string = 'supabase', customComponents: any[] = []) {
  const configFolder = zip.folder('src/config/views')
  const appFolder = zip.folder('src/app')
  if (!configFolder || !appFolder) return

  uiViews.forEach(view => {
    if (!view.slug || !view.model_id) return

    const model = models.find(m => m.id === view.model_id)
    if (!model) return

    const modelName = model.table_name
    const layoutConfig = view.layout_config || {}
    const fields = model.ui_fields || []
    const allFields = models.flatMap(m => (m.ui_fields || []).map((f: any) => ({ ...f, model_id: m.id, model_name: m.table_name, display_model_name: m.name })))

    // Reconstruct display fields
    let displayFields = fields.filter((f: any) => f.list_visible !== false)
    if (layoutConfig.grid_fields && layoutConfig.grid_fields.length > 0) {
      displayFields = layoutConfig.grid_fields.map((fieldIdOrName: string) => {
        if (fieldIdOrName.startsWith('virt_') || fieldIdOrName.startsWith('byoc_') || fieldIdOrName.startsWith('byoc-')) {
          const isByoc = fieldIdOrName.startsWith('byoc')
          const byocName = isByoc ? fieldIdOrName.split(/[-_]/).slice(2).join('_') : ''
          const gridMeta = layoutConfig.fields_metadata?.[`grid-${fieldIdOrName}`] || {}
          const baseMeta = layoutConfig.fields_metadata?.[fieldIdOrName] || {}
          const meta = { ...baseMeta, ...gridMeta }
          if (isByoc) {
            const comp = customComponents.find((c: any) => c.name === byocName)
            if (comp && comp.compiled_code) {
              meta.compiled_code = comp.compiled_code
            }
          }
          
          let virtualModelId: any = null;
          let virtualModelName = '';
          const vMatch = Object.entries(layoutConfig.fields_metadata || {}).find(([k, v]: [string, any]) => k === fieldIdOrName || k === `grid-${fieldIdOrName}`);
          if (vMatch) {
             virtualModelId = (vMatch[1] as any)?.virtual_model_id || (vMatch[1] as any)?.byoc_model_id || (vMatch[1] as any)?.model_id;
             if (virtualModelId) {
               const foundModel = models.find(m => m.id === virtualModelId);
               if (foundModel) virtualModelName = foundModel.table_name;
             }
          }

          return {
            id: fieldIdOrName,
            column_name: fieldIdOrName,
            label: meta.label?.text || (isByoc ? `[BYOC] ${byocName}` : 'Campo Calculado'),
            field_type: isByoc ? 'byoc' : 'virtual',
            data_type: isByoc ? 'byoc' : 'virtual',
            required: false,
            is_virtual: !isByoc,
            model_id: virtualModelId,
            model_name: virtualModelName,
            display_model_name: virtualModelName,
            config: meta
          }
        }
        return allFields.find((f: any) => f.id === fieldIdOrName || f.column_name === fieldIdOrName)
      }).filter(Boolean)
    }

    let formFields = fields.filter((f: any) => f.form_visible !== false && f.column_name !== 'id')
    if (layoutConfig.form_fields && layoutConfig.form_fields.length > 0) {
      formFields = layoutConfig.form_fields.map((fieldIdOrName: string) => {
        if (fieldIdOrName.startsWith('byoc-') || fieldIdOrName.startsWith('byoc_') || fieldIdOrName.startsWith('virt_')) {
          const isByoc = fieldIdOrName.startsWith('byoc')
          const byocName = isByoc ? fieldIdOrName.split(/[-_]/).slice(2).join('_') : ''
          const formMeta = layoutConfig.fields_metadata?.[`form-${fieldIdOrName}`] || {}
          const baseMeta = layoutConfig.fields_metadata?.[fieldIdOrName] || {}
          const meta = { ...baseMeta, ...formMeta }
          if (isByoc) {
            const comp = customComponents.find((c: any) => c.name === byocName)
            if (comp && comp.compiled_code) {
              meta.compiled_code = comp.compiled_code
            }
          }
          
          let virtualModelId: any = null;
          let virtualModelName = '';
          const vMatch = Object.entries(layoutConfig.fields_metadata || {}).find(([k, v]: [string, any]) => k === fieldIdOrName || k === `form-${fieldIdOrName}`);
          if (vMatch) {
             virtualModelId = (vMatch[1] as any)?.virtual_model_id || (vMatch[1] as any)?.byoc_model_id || (vMatch[1] as any)?.model_id;
             if (virtualModelId) {
               const foundModel = models.find(m => m.id === virtualModelId);
               if (foundModel) virtualModelName = foundModel.table_name;
             }
          }

          return {
            id: fieldIdOrName,
            column_name: fieldIdOrName,
            label: meta.label?.text || (isByoc ? `[BYOC] ${byocName}` : 'Campo Calculado'),
            field_type: isByoc ? 'byoc' : 'virtual',
            data_type: isByoc ? 'byoc' : 'virtual',
            required: false,
            is_virtual: !isByoc,
            model_id: virtualModelId,
            model_name: virtualModelName,
            config: meta
          }
        }
        return allFields.find((f: any) => f.id === fieldIdOrName || f.column_name === fieldIdOrName)
      }).filter(Boolean)
    }

    // Freeze Configuration into JSON
    const viewConfig = {
      viewName: view.name,
      modelName: modelName,
      primaryKeyName: 'id', // Defaulting for exported projects
      displayType: layoutConfig.display_type || 'list',
      defaultView: layoutConfig.default_view || 'list',
      logicType: view.logic_type,
      displayFields: displayFields.map((f: any) => {
        const baseMeta = layoutConfig.fields_metadata?.[f.id] || {}
        const specificMeta = layoutConfig.fields_metadata?.[`grid-${f.id}`] || {}
        const mergedMeta = { ...baseMeta, ...specificMeta }
        return {
          id: f.id || f.column_name,
          db_column_name: f.column_name,
          display_name: mergedMeta.label?.text || f.label,
          field_type: f.field_type,
          model_id: f.model_id,
          model_name: f.model_name,
          display_model_name: f.display_model_name,
          config: { ...(f.config || {}), ...mergedMeta }
        }
      }),
      formFields: formFields.map((f: any) => {
        const baseMeta = layoutConfig.fields_metadata?.[f.id] || {}
        const specificMeta = layoutConfig.fields_metadata?.[`form-${f.id}`] || {}
        const mergedMeta = { ...baseMeta, ...specificMeta }
        return {
          id: f.id || f.column_name,
          db_column_name: f.column_name,
          display_name: mergedMeta.label?.text || f.label,
          field_type: f.field_type,
          is_nullable: !f.required,
          model_id: f.model_id,
          model_name: f.model_name,
          display_model_name: f.display_model_name,
          config: { ...(f.config || {}), ...mergedMeta }
        }
      }),
      filterFields: (layoutConfig.filter_fields || []).map((fieldIdOrName: string) => {
        const f = allFields.find((f: any) => f.id === fieldIdOrName || f.column_name === fieldIdOrName)
        if (!f) return null
        const baseMeta = layoutConfig.fields_metadata?.[f.id] || {}
        const specificMeta = layoutConfig.fields_metadata?.[`filter-${f.id}`] || {}
        const mergedMeta = { ...baseMeta, ...specificMeta }
        if (f.field_type === 'byoc') {
          const byocName = f.id.replace(/^byoc[-_]/, '')
          const comp = customComponents.find((c: any) => c.name === byocName)
          if (comp && comp.compiled_code) {
            mergedMeta.compiled_code = comp.compiled_code
          }
        }
        return {
          id: f.id || f.column_name,
          db_column_name: f.column_name,
          display_name: mergedMeta.label?.text || f.label,
          field_type: f.field_type,
          model_id: f.model_id,
          model_name: f.model_name,
          display_model_name: f.display_model_name,
          config: { ...(f.config || {}), ...mergedMeta }
        }
      }).filter(Boolean),
      buttonsConfig: view.buttons_config || [],
      customActions: layoutConfig.custom_actions || [],
      canAdd: true,
      canExport: true,
      isAutomationsEnabled: false,
      timelineConfig: layoutConfig.timeline_config || layoutConfig.timelineConfig,
      ganttConfig: layoutConfig.gantt_config || layoutConfig.ganttConfig,
      kanbanConfig: layoutConfig.kanban_config || layoutConfig.kanbanConfig,
      schedulerConfig: layoutConfig.scheduler_config || layoutConfig.schedulerConfig,
      galleryConfig: layoutConfig.gallery_config || layoutConfig.galleryConfig,
      mapConfig: layoutConfig.map_config || layoutConfig.mapConfig,
      mindmapLevels: layoutConfig.mindmap_levels || layoutConfig.mindmapLevels,
      mindmapCentralField: layoutConfig.mindmap_central_field || layoutConfig.mindmapCentralField,
      blueprintConfig: layoutConfig.blueprint_config || layoutConfig.blueprintConfig,
      kanbanGroupField: layoutConfig.kanban_group_field || layoutConfig.kanbanGroupField,
      kanbanGroupDisplayField: layoutConfig.kanban_group_display_field || layoutConfig.kanbanGroupDisplayField,
      kanbanCardFields: layoutConfig.kanban_card_fields || layoutConfig.kanbanCardFields,
      detailsInterfaceTypes: layoutConfig.details_interface_types || layoutConfig.detailsInterfaceTypes,
      actionInterfaceType: layoutConfig.action_interface_type || layoutConfig.actionInterfaceType || 'drawer',
      masterModelId: layoutConfig.master_model_id || view.model_id,
      detailsDisplayMode: layoutConfig.details_display_mode || layoutConfig.detailsDisplayMode,
      detailsInlineTypes: layoutConfig.details_inline_types || layoutConfig.detailsInlineTypes,
      detailsModalSizes: layoutConfig.details_modal_sizes || layoutConfig.detailsModalSizes,
      detailsModalWidths: layoutConfig.details_modal_widths || layoutConfig.detailsModalWidths,
      detailsModalHeights: layoutConfig.details_modal_heights || layoutConfig.detailsModalHeights,
      masterTabTitle: layoutConfig.master_tab_title || layoutConfig.masterTabTitle,
      detailsTabTitles: layoutConfig.details_tab_titles || layoutConfig.detailsTabTitles,
      detailsItemTitles: layoutConfig.details_item_titles || layoutConfig.detailsItemTitles,
      tabsStyleConfig: layoutConfig.fields_metadata?.['form-TABS'] || layoutConfig.fields_metadata?.['TABS'] || layoutConfig.tabs_style_config || layoutConfig.tabsStyleConfig,
      joins: layoutConfig.joins || [],
      analyticsConfig: layoutConfig.analytics_config || layoutConfig.analyticsConfig,
      exportFormats: layoutConfig.export_formats || layoutConfig.exportFormats,
      filterGridColumns: layoutConfig.filter_grid_columns || layoutConfig.filterGridColumns,
      galleryClickBehavior: layoutConfig.gallery_click_behavior || layoutConfig.galleryClickBehavior,
      customSlots: layoutConfig.custom_slots || layoutConfig.customSlots || [],
      formHeaderTitle: layoutConfig.form_header_title || layoutConfig.formHeaderTitle,
      formHeaderSubtitleField: layoutConfig.form_header_subtitle_field || layoutConfig.formHeaderSubtitleField,
      initialItemsPerPage: layoutConfig.items_per_page || layoutConfig.initialItemsPerPage || layoutConfig.itemsPerPage
    }

    configFolder.file(`${view.slug}.json`, JSON.stringify(viewConfig, null, 2))

    // Generate Wrapper Page inside (dashboard)
    const dashboardFolder = appFolder.folder('(dashboard)') || appFolder
    const pageFolder = dashboardFolder.folder(view.slug)
    if (pageFolder) {
      pageFolder.file('page.tsx', `'use client'

import React, { Suspense } from 'react'
import ViewPageContent from '@/components/runtime/ViewPageContent'
import viewConfig from '@/config/views/${view.slug}.json'
import projectConfig from '@/config/project.json'
import { PermissionGuard } from '@/components/auth/PermissionGuard'

export default function ${view.slug.replace(/-/g, '')}Page() {
  return (
    <PermissionGuard viewSlug="${view.slug}">
      <div className="flex-1 w-full h-full relative">
        <Suspense fallback={null}>
          <ViewPageContent 
            {...(viewConfig as any)}
            viewId="${view.id}"
            workspace={{ slug: 'export' }}
            project={projectConfig}
            locale="pt"
            baseUrl=""
            projectRelations={projectConfig.relations || []}
          />
        </Suspense>
      </div>
    </PermissionGuard>
  )
}
`)
    }
  })

  // Generate API Routes for Supabase for ALL models (server-side, using SSR client)
  // This ensures ALL data access goes through the server — no direct browser calls to Supabase.
  if (dbType === 'supabase') {
    models.forEach(model => {
      if (!model.table_name) return
      const modelName = model.table_name
      const apiFolder = appFolder.folder('api')?.folder(modelName)
      if (apiFolder) {
        apiFolder.file('route.ts', `import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const from = (page - 1) * limit
  const to = from + limit - 1

  // Parse optional JOIN definitions: [{ from, localKey, to, foreignKey }]
  let joinsParam: Array<{ from: string; localKey: string; to: string; foreignKey: string }> = []
  try {
    const raw = searchParams.get('joins')
    if (raw) joinsParam = JSON.parse(raw)
  } catch (_) {}

  // Build select string: main table + nested joined tables for detailsItemTitles
  const nestedSelects = joinsParam
    .filter(j => j.from?.toLowerCase() === '${modelName}'.toLowerCase())
    .map(j => \`\${j.to}!inner(\${j.foreignKey})\`)

  const selectStr = nestedSelects.length > 0
    ? \`*, \${nestedSelects.join(', ')}\`
    : '*'

  let query = supabase
    .from('${modelName}')
    .select(selectStr, { count: 'exact' })
    .range(from, to)
    .order('id', { ascending: false })

  // Apply equality filters from query params (filter_<column>=<value>)
  searchParams.forEach((value, key) => {
    if (key.startsWith('filter_')) {
      const col = key.replace('filter_', '')
      query = query.eq(col, value)
    }
  })

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data || [], count: count || 0 })
}

export async function POST(request: Request) {
  const supabase = createClient()
  try {
    const data = await request.json()
    const { data: inserted, error } = await supabase
      .from('${modelName}')
      .insert([data])
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(inserted)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const supabase = createClient()
  try {
    const { pkValue, data } = await request.json()
    const { data: updated, error } = await supabase
      .from('${modelName}')
      .update(data)
      .eq('id', pkValue)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(updated)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })
  try {
    const { error } = await supabase
      .from('${modelName}')
      .delete()
      .eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
`)
      }
    })
  }

  // Generate API Routes for Postgres for ALL models (not just ones with views)
  if (dbType === 'postgres') {
    models.forEach(model => {
      if (!model.table_name) return
      const modelName = model.table_name
      const apiFolder = appFolder.folder('api')?.folder(modelName)
      if (apiFolder) {
        apiFolder.file('route.ts', `import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  // Parse optional JOIN definitions: [{ from, localKey, to, foreignKey }]
  let joinsParam: Array<{ from: string; localKey: string; to: string; foreignKey: string }> = []
  try {
    const raw = searchParams.get('joins')
    if (raw) joinsParam = JSON.parse(raw)
  } catch (_) {}

  // Build JOIN clauses for related tables needed by detailsItemTitles
  const joinClauses = joinsParam
    .filter(j => j.from?.toLowerCase() === '${modelName}'.toLowerCase())
    .map((j, idx) => \`LEFT JOIN "\${j.to}" AS join_\${idx} ON "${modelName}"."\${j.localKey}" = join_\${idx}."\${j.foreignKey}"\`)
    .join(' ')

  // Select columns: main table + nested objects from joined tables
  const joinedSelectCols = joinsParam
    .filter(j => j.from?.toLowerCase() === '${modelName}'.toLowerCase())
    .map((j, idx) => \`row_to_json(join_\${idx}) AS "\${j.to}"\`)
    .join(', ')

  const selectClause = joinedSelectCols
    ? \`"${modelName}".*, \${joinedSelectCols}\`
    : \`"${modelName}".*\`

  let baseQuery = \`SELECT \${selectClause} FROM "${modelName}"\`
  if (joinClauses) baseQuery += \` \${joinClauses}\`
  let countQuery = \`SELECT COUNT(*) as total FROM "${modelName}"\`
  if (joinClauses) countQuery += \` \${joinClauses}\`
  
  const filters: string[] = []
  const values: any[] = []
  
  searchParams.forEach((value, key) => {
    if (key.startsWith('filter_')) {
      const col = key.replace('filter_', '')
      filters.push(\`"${modelName}"."\${col}" = $\${filters.length + 1}\`)
      values.push(value)
    }
  })
  
  let whereClause = ''
  if (filters.length > 0) {
    whereClause = ' WHERE ' + filters.join(' AND ')
  }
  
  try {
    const dataRes = await query(baseQuery + whereClause + \` ORDER BY "${modelName}".id DESC LIMIT $\${values.length + 1} OFFSET $\${values.length + 2}\`, [...values, limit, offset])
    const countRes = await query(countQuery + whereClause, values)
    
    return NextResponse.json({ data: dataRes.rows, count: parseInt(countRes.rows[0]?.total || '0') })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const columns = Object.keys(data).map(k => \`"\${k}"\`).join(', ')
    const placeholders = Object.keys(data).map((_, i) => \`$\${i + 1}\`).join(', ')
    const values = Object.values(data)
    
    const result = await query(\`INSERT INTO "\${'${modelName}'}" (\${columns}) VALUES (\${placeholders}) RETURNING *\`, values)
    return NextResponse.json(result.rows[0])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { pkValue, data } = await request.json()
    
    const setClause = Object.keys(data).map((k, i) => \`"\${k}" = $\${i + 2}\`).join(', ')
    const values = [pkValue, ...Object.values(data)]
    
    const result = await query(\`UPDATE "\${'${modelName}'}" SET \${setClause} WHERE id = $1 RETURNING *\`, values)
    return NextResponse.json(result.rows[0])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })
  
  try {
    await query(\`DELETE FROM "\${'${modelName}'}" WHERE id = $1\`, [id])
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
`)
      }
    })
  }
}
