import JSZip from 'jszip'

export function generateFeatures(zip: JSZip, models: any[], uiViews: any[], dbType: string = 'supabase') {
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

    // Reconstruct display fields
    let displayFields = fields.filter((f: any) => f.list_visible !== false)
    if (layoutConfig.grid_fields && layoutConfig.grid_fields.length > 0) {
      displayFields = layoutConfig.grid_fields.map((fieldIdOrName: string) => 
        fields.find((f: any) => f.id === fieldIdOrName || f.column_name === fieldIdOrName)
      ).filter(Boolean)
    }

    let formFields = fields.filter((f: any) => f.form_visible !== false && f.column_name !== 'id')
    if (layoutConfig.form_fields && layoutConfig.form_fields.length > 0) {
      formFields = layoutConfig.form_fields.map((fieldIdOrName: string) => {
        if (fieldIdOrName.startsWith('byoc-') || fieldIdOrName.startsWith('byoc_')) {
          return {
            id: fieldIdOrName,
            column_name: fieldIdOrName,
            label: `[BYOC]`,
            field_type: 'byoc',
            required: false,
            config: {}
          }
        }
        return fields.find((f: any) => f.id === fieldIdOrName || f.column_name === fieldIdOrName)
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
          config: { ...(f.config || {}), ...mergedMeta }
        }
      }),
      filterFields: (layoutConfig.filter_fields || []).map((fieldIdOrName: string) => {
        const f = fields.find((f: any) => f.id === fieldIdOrName || f.column_name === fieldIdOrName)
        if (!f) return null
        const baseMeta = layoutConfig.fields_metadata?.[f.id] || {}
        const specificMeta = layoutConfig.fields_metadata?.[`filter-${f.id}`] || {}
        const mergedMeta = { ...baseMeta, ...specificMeta }
        return {
          id: f.id || f.column_name,
          db_column_name: f.column_name,
          display_name: mergedMeta.label?.text || f.label,
          field_type: f.field_type,
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
      blueprintConfig: layoutConfig.blueprint_config || layoutConfig.blueprintConfig,
      kanbanGroupField: layoutConfig.kanban_group_field || layoutConfig.kanbanGroupField,
      kanbanGroupDisplayField: layoutConfig.kanban_group_display_field || layoutConfig.kanbanGroupDisplayField,
      kanbanCardFields: layoutConfig.kanban_card_fields || layoutConfig.kanbanCardFields,
      detailsInterfaceTypes: layoutConfig.details_interface_types || layoutConfig.detailsInterfaceTypes,
      actionInterfaceType: layoutConfig.action_interface_type || layoutConfig.actionInterfaceType || 'drawer'
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
          />
        </Suspense>
      </div>
    </PermissionGuard>
  )
}
`)
    }

    // Generate API Routes for Postgres
    if (dbType === 'postgres') {
      const apiFolder = appFolder.folder('api')?.folder(modelName)
      if (apiFolder) {
        apiFolder.file('route.ts', `import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = (page - 1) * limit
  
  let baseQuery = \`SELECT * FROM \${'${modelName}'}\`
  let countQuery = \`SELECT COUNT(*) as total FROM \${'${modelName}'}\`
  
  const filters: string[] = []
  const values: any[] = []
  
  searchParams.forEach((value, key) => {
    if (key.startsWith('filter_')) {
      const col = key.replace('filter_', '')
      filters.push(\`"\${col}" = $\${filters.length + 1}\`)
      values.push(value)
    }
  })
  
  let whereClause = ''
  if (filters.length > 0) {
    whereClause = ' WHERE ' + filters.join(' AND ')
  }
  
  try {
    const dataRes = await query(baseQuery + whereClause + \` ORDER BY id DESC LIMIT $\${values.length + 1} OFFSET $\${values.length + 2}\`, [...values, limit, offset])
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
    
    const result = await query(\`INSERT INTO \${'${modelName}'} (\${columns}) VALUES (\${placeholders}) RETURNING *\`, values)
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
    
    const result = await query(\`UPDATE \${'${modelName}'} SET \${setClause} WHERE id = $1 RETURNING *\`, values)
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
    await query(\`DELETE FROM \${'${modelName}'} WHERE id = $1\`, [id])
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
`)
      }
    }
  })
}
