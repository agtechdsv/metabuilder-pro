import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { wrapChannelWithChunking } from '@/lib/chunkedChannel'
import { resolveRelations, resolveAllJoins, buildJoinSql } from '@/lib/relationPathFinder'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/I18nContext'

const getCachedData = (key: string) => {
  if (typeof window === 'undefined') return null
  const cached = sessionStorage.getItem(`metabuilder_cache_${key}`)
  return cached ? JSON.parse(cached) : null
}

const setCachedData = (key: string, data: any[]) => {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(`metabuilder_cache_${key}`, JSON.stringify(data))
}

export function useViewDataFetch({
  projectId,
  modelName,
  project,
  tunnelChannel,
  isTunnelReady,
  primaryKeyName,
  joins,
  projectRelations,
  displayFields,
  filterFields,
  formFields,
  advancedStaticFilters,
  kanbanGroupField,
  kanbanCardFields,
  galleryConfig,
  schedulerConfig,
  timelineConfig,
  logicType,
  timelineDirection,
  currentPage,
  itemsPerPage,
  filterValues,
  initialEditId,
  onEdit,
  onCustomAction
}: any) {
  const { toast } = useToast()
  const { t } = useI18n()
  const supabase = createClient()

  const [data, setData] = useState<any[]>(() => getCachedData(`${projectId}:${modelName}`) || [])
  const [isLoading, setIsLoading] = useState(!getCachedData(`${projectId}:${modelName}`))
  const [isFetchingBackground, setIsFetchingBackground] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalServerRows, setTotalServerRows] = useState<number>(0)
  const [hasFetchedInitial, setHasFetchedInitial] = useState(false)

  const activeQueriesRef = useRef<Set<string>>(new Set())
  const queryConfigsRef = useRef<Map<string, { append: boolean }>>(new Map())
  const currentFiltersRef = useRef<any>(filterValues)
  const hasAutoOpenedEditRef = useRef<boolean>(false)
  const fetchDataRef = useRef<any>(null)

  useEffect(() => {
    currentFiltersRef.current = filterValues
  }, [JSON.stringify(filterValues)])

  useEffect(() => {
    const cached = getCachedData(`${projectId}:${modelName}`)
    if (cached && data.length === 0) {
      setData(cached)
      setIsLoading(false)
    }
  }, [projectId, modelName])

  // Listener centralizado usando o canal do PAI
  useEffect(() => {
    if (!tunnelChannel || !isTunnelReady) return

    const handleSqlResult = (payload: any) => {
      const qId = payload.payload?.queryId
      if (!qId || !activeQueriesRef.current.has(qId)) return

      const config = queryConfigsRef.current.get(qId)
      const shouldAppend = config?.append || false
      queryConfigsRef.current.delete(qId)

      if (payload.payload.success) {
        if (payload.payload.action === 'count_records') {
          setTotalServerRows(payload.payload.total || 0)
          activeQueriesRef.current.delete(qId)
          return
        }

        let resultData = payload.payload.data || []

        if (joins && joins.length > 0) {
          const pkName = formFields?.find((f: any) => f.is_primary_key)?.db_column_name || 'id'
          const grouped: Record<string, any> = {}
          resultData.forEach((row: any) => {
            const pkValue = row[pkName] || row.id || row.ID
            if (!pkValue) return
            if (!grouped[pkValue]) grouped[pkValue] = { ...row, _details: [] }
            grouped[pkValue]._details.push(row)
          })
          resultData = Object.values(grouped)
        }

        resultData = resultData.map((row: any) => ({
          ...row,
          _key: String(row[primaryKeyName] || row.id || row.ID || crypto.randomUUID())
        }))

        const uniqueResultData = resultData.filter((row: any, index: number, self: any[]) =>
          index === self.findIndex((r) =>
            String(r[primaryKeyName] || r.id || r.ID) === String(row[primaryKeyName] || row.id || row.ID)
          )
        );

        if (shouldAppend) {
          setData((prev: any[]) => {
            const combined = [...prev, ...uniqueResultData]
            return combined.filter((row: any, index: number, self: any[]) =>
              index === self.findIndex((r) =>
                String(r[primaryKeyName] || r.id || r.ID) === String(row[primaryKeyName] || row.id || row.ID)
              )
            )
          })
        } else {
          setData(uniqueResultData)
          if (initialEditId && onEdit) {
            if (!hasAutoOpenedEditRef.current) {
              const rowToEdit = resultData.find((r: any) => String(r[primaryKeyName || 'id'] || r.id) === String(initialEditId))
              if (rowToEdit) {
                hasAutoOpenedEditRef.current = true
                onEdit(rowToEdit)
              }
            }
          }

          const cacheKey = `${projectId}:${modelName}`
          if (!Object.keys(currentFiltersRef.current || {}).length) {
            setCachedData(cacheKey, resultData)
          }
        }
      } else {
        setError(payload.payload.error)
      }
      setIsLoading(false)
      setIsFetchingBackground(false)
      activeQueriesRef.current.delete(qId)
    }

    tunnelChannel.on('broadcast', { event: 'sql_result' }, handleSqlResult)

    return () => {
      if (tunnelChannel.removeListener) {
        tunnelChannel.removeListener('sql_result', handleSqlResult)
      }
      const bindings = tunnelChannel.bindings?.broadcast
      if (Array.isArray(bindings)) {
        const binding = bindings.find((b: any) => b.callback === handleSqlResult)
        if (binding) {
          if (tunnelChannel.channelAdapter) {
            tunnelChannel.channelAdapter.off('broadcast', binding.ref)
          }
          tunnelChannel.bindings.broadcast = bindings.filter((b: any) => b.callback !== handleSqlResult)
        }
      }
    }
  }, [tunnelChannel, isTunnelReady])

  const fetchData = async (currentFilters: any = {}, forceRefresh: boolean = false, append: boolean = false) => {
    if (!tunnelChannel || !isTunnelReady) return

    const cacheKey = `${projectId}:${modelName}`
    const cached = getCachedData(cacheKey)

    if (!forceRefresh && !append && cached && !Object.keys(currentFilters).length) {
      const uniqueCached = cached.filter((row: any, index: number, self: any[]) =>
        index === self.findIndex((r) =>
          String(r[primaryKeyName] || r.id || r.ID) === String(row[primaryKeyName] || row.id || row.ID)
        )
      );
      setData(uniqueCached)
      setIsLoading(false)
      setIsFetchingBackground(false)
      return
    }

    const queryId = crypto.randomUUID()
    queryConfigsRef.current.set(queryId, { append })
    activeQueriesRef.current.add(queryId)

    if (!cached || data.length === 0 || append) {
      setIsLoading(true)
    } else {
      setIsFetchingBackground(true)
    }
    setError(null)

    setTimeout(() => {
      const buildJoinsSql = (joinsList: any[], includeFilters: boolean = true) => {
        const allModels = project?.models || []
        const requiredTables = new Set<string>()
        const filterTables = new Set<string>()

        if (includeFilters) {
          if (currentFilters) {
            Object.keys(currentFilters).forEach(key => {
              if (key.includes('.')) {
                requiredTables.add(key.split('.')[0])
                filterTables.add(key.split('.')[0])
              }
            })
          }
          if (filterFields) {
            filterFields.forEach((f: any) => {
              const col = f.sql_expression || f.db_column_name
              if (col && col.includes('.')) {
                requiredTables.add(col.split('.')[0])
                filterTables.add(col.split('.')[0])
              }
            })
          }
          if (advancedStaticFilters) {
            advancedStaticFilters.forEach((f: any) => {
              if (f.field && f.field.includes('.')) {
                requiredTables.add(f.field.split('.')[0])
                filterTables.add(f.field.split('.')[0])
              }
            })
          }
        }
        if (displayFields) {
          displayFields.forEach((f: any) => {
            const col = f.sql_expression || f.db_column_name
            if (col && col.includes('.')) requiredTables.add(col.split('.')[0])
          })
        }

        const additionalTables = [
          ...Array.from(requiredTables),
          ...(joinsList || []).flatMap((j: any) => {
            const fromModel = allModels.find((m: any) => String(m.id) === String(j.from) || m.db_table_name === j.from)
            const toModel = allModels.find((m: any) => String(m.id) === String(j.to) || m.db_table_name === j.to)
            return [fromModel?.db_table_name, toModel?.db_table_name].filter(Boolean)
          })
        ].filter((t: string) => t && t.toLowerCase() !== modelName.toLowerCase())

        if (additionalTables.length === 0) return ''

        if (projectRelations && projectRelations.length > 0) {
          const resolvedRelations = resolveRelations(projectRelations, allModels)
          const steps = resolveAllJoins(resolvedRelations, modelName, additionalTables)
          return buildJoinSql(steps, filterTables)
        }

        const validJoinsList = joinsList || []
        const resolvedJoins = validJoinsList.map((j: any) => {
          if (j.toTable && j.table) return j
          if (j.localKey && j.foreignKey) {
            return { table: j.from, toTable: j.to, on: j.localKey, toOn: j.foreignKey }
          }
          if (allModels.length > 0) {
            const fromModel = allModels.find((m: any) => String(m.id) === String(j.from) || m.db_table_name === j.from)
            const toModel = allModels.find((m: any) => String(m.id) === String(j.to) || m.db_table_name === j.to)
            const fromTable = fromModel?.db_table_name
            const toTable = toModel?.db_table_name
            const localField = fromModel?.fields?.find((f: any) => String(f.id) === String(j.local_field) || f.db_column_name === j.local_field)
            const foreignField = toModel?.fields?.find((f: any) => String(f.id) === String(j.foreign_field) || f.db_column_name === j.foreign_field)
            if (!fromTable || !toTable || !localField || !foreignField) return null
            return { table: fromTable, toTable: toTable, on: localField.db_column_name, toOn: foreignField.db_column_name }
          }
          return null
        }).filter(Boolean)

        if (requiredTables.size > 0 && allModels.length > 0) {
          const findRelation = (modelA: any, modelB: any) => {
            if (!modelA || !modelB) return null
            const modelBNameSingular = modelB.db_table_name.endsWith('s') ? modelB.db_table_name.slice(0, -1) : modelB.db_table_name
            const modelBNameShort = modelBNameSingular.slice(0, -2)
            const modelBParts = modelB.db_table_name.split('_')
            let fkField = modelA.fields?.find((f: any) => {
              const rel = f.config?.rel_table || ''
              return rel !== '' && (rel === modelB.db_table_name || rel + 's' === modelB.db_table_name || modelB.db_table_name.includes(rel) || rel.includes(modelBNameSingular))
            })
            if (fkField) return { table: modelA.db_table_name, toTable: modelB.db_table_name, on: fkField.db_column_name, toOn: 'id' }
            fkField = modelA.fields?.find((f: any) => {
              const col = (f.db_column_name || '').toLowerCase()
              if (!col.endsWith('_id')) return false
              if (col.includes(modelBNameSingular.toLowerCase()) || col.includes(modelBNameShort.toLowerCase())) return true
              if (modelBParts.length > 1) {
                const firstPartSingular = modelBParts[0].endsWith('s') ? modelBParts[0].slice(0, -1) : modelBParts[0]
                if (col.includes(firstPartSingular.toLowerCase())) return true
              }
              return false
            })
            if (fkField) return { table: modelA.db_table_name, toTable: modelB.db_table_name, on: fkField.db_column_name, toOn: 'id' }
            return null
          }
          const tablesToJoin = Array.from(requiredTables).filter(t => t !== modelName)
          const currentlyJoined = new Set<string>([modelName.toLowerCase()])
          let changed = true
          while (changed && tablesToJoin.length > 0) {
            changed = false
            for (let i = 0; i < tablesToJoin.length; i++) {
              const reqTable = tablesToJoin[i]
              const relModel = allModels.find((m: any) => m.db_table_name === reqTable)
              if (!relModel) continue
              let foundRelation: any = null
              for (const joinedTable of currentlyJoined) {
                const joinedModel = allModels.find((m: any) => m.db_table_name === joinedTable)
                if (!joinedModel) continue
                foundRelation = findRelation(joinedModel, relModel)
                if (foundRelation) break
                foundRelation = findRelation(relModel, joinedModel)
                if (foundRelation) break
              }
              if (foundRelation) {
                const isDuplicate = resolvedJoins.some((rj: any) =>
                  (rj.table === foundRelation.table && rj.toTable === foundRelation.toTable) ||
                  (rj.table === foundRelation.toTable && rj.toTable === foundRelation.table)
                )
                if (!isDuplicate) resolvedJoins.push(foundRelation)
                currentlyJoined.add(reqTable.toLowerCase())
                tablesToJoin.splice(i, 1)
                changed = true
                break
              }
            }
          }
        }

        if (resolvedJoins.length === 0) return ''
        const joinedTables = new Set([modelName.toLowerCase()])
        const sqlParts: string[] = []
        let changed = true
        const remaining = [...resolvedJoins]
        while (changed && remaining.length > 0) {
          changed = false
          for (let i = 0; i < remaining.length; i++) {
            const j = remaining[i]
            const fromT = j.table.toLowerCase()
            const toT = j.toTable.toLowerCase()
            let targetTable = '', existingTable = '', localOn = '', foreignOn = ''
            if (joinedTables.has(fromT) && !joinedTables.has(toT)) {
              targetTable = j.toTable; existingTable = j.table; localOn = j.on; foreignOn = j.toOn
            } else if (joinedTables.has(toT) && !joinedTables.has(fromT)) {
              targetTable = j.table; existingTable = j.toTable; localOn = j.toOn; foreignOn = j.on
            }
            if (targetTable) {
              const joinType = filterTables.has(targetTable.toLowerCase()) ? 'INNER JOIN' : 'LEFT JOIN'
              sqlParts.push(`${joinType} "${targetTable}" ON "${existingTable}"."${localOn}" = "${targetTable}"."${foreignOn}"`)
              joinedTables.add(targetTable.toLowerCase())
              remaining.splice(i, 1)
              changed = true
              break
            }
          }
        }
        return sqlParts.join(' ')
      }

      const selectExprs: string[] = []
      const seenExprs = new Set<string>()
      const outerRequiredTables = new Set<string>()

      const addSelectExpr = (expr: string, alias?: string) => {
        const key = alias || expr
        if (seenExprs.has(key.toLowerCase())) return
        seenExprs.add(key.toLowerCase())

        const exprWithoutAlias = expr.split(/ as /i)[0].trim()
        if (exprWithoutAlias.includes('.')) {
          outerRequiredTables.add(exprWithoutAlias.split('.')[0].replace(/"/g, '').toLowerCase())
        }

        const hasAlias = expr.toLowerCase().includes(' as ')
        let finalExpr = expr
        if (!expr.includes('.') && !hasAlias) {
          finalExpr = `"${modelName}"."${expr}"`
        }

        if (alias && !hasAlias) {
          selectExprs.push(`${finalExpr} AS "${alias}"`)
        } else if (expr.includes('.') && !hasAlias) {
          selectExprs.push(`${finalExpr} AS "${expr}"`)
        } else if (!expr.includes('.') && !hasAlias) {
          selectExprs.push(finalExpr)
        } else {
          selectExprs.push(finalExpr)
        }
      }

      const cleanPk = primaryKeyName.split('.').pop() || 'id'
      if (primaryKeyName.includes('.')) addSelectExpr(primaryKeyName, primaryKeyName)
      else addSelectExpr(`"${modelName}"."${cleanPk}"`, cleanPk)

      if (displayFields) {
        displayFields.forEach((f: any) => {
          if (f.field_type === 'byoc' || f.db_column_name?.startsWith('byoc_')) return;
          const expr = f.sql_expression || f.db_column_name
          if (expr) addSelectExpr(expr, f.db_column_name)
        })
      }

      if (formFields) {
        formFields.forEach((f: any) => {
          if (f.field_type === 'byoc' || f.db_column_name?.startsWith('byoc_')) return;
          const isMasterModel = !f.model_name || f.model_name.toLowerCase() === modelName.toLowerCase()
          const isJoinedModel = joins && joins.some((j: any) => {
            const toTable = j.toTable || j.to
            return toTable && f.model_name && toTable.toLowerCase() === f.model_name.toLowerCase()
          })
          if (isMasterModel || isJoinedModel) {
            const expr = f.sql_expression || f.db_column_name
            if (expr) addSelectExpr(expr, f.db_column_name)
          }
        })
      }

      if (kanbanGroupField) {
        const f = displayFields?.find((x: any) => x.id === kanbanGroupField) || formFields?.find((x: any) => x.id === kanbanGroupField)
        addSelectExpr(f ? (f.sql_expression || f.db_column_name) : kanbanGroupField)
      }
      if (kanbanCardFields) {
        kanbanCardFields.forEach((col: any) => {
          const f = displayFields?.find((x: any) => x.id === col) || formFields?.find((x: any) => x.id === col)
          addSelectExpr(f ? (f.sql_expression || f.db_column_name) : col)
        })
      }
      if (galleryConfig?.card_fields) {
        galleryConfig.card_fields.forEach((col: string) => {
          const f = displayFields?.find((x: any) => x.id === col) || formFields?.find((x: any) => x.id === col)
          addSelectExpr(f ? (f.sql_expression || f.db_column_name) : col)
        })
      }
      if (schedulerConfig) {
        const sFields = [schedulerConfig.start_date_field, schedulerConfig.end_date_field, schedulerConfig.title_field, schedulerConfig.color_field].filter(Boolean)
        sFields.forEach(col => {
          const f = displayFields?.find((x: any) => x.id === col) || formFields?.find((x: any) => x.id === col)
          addSelectExpr(f ? (f.sql_expression || f.db_column_name) : col)
        })
      }
      if (timelineConfig) {
        const tFields = [timelineConfig.date_field, timelineConfig.title_field].filter(Boolean)
        tFields.forEach(col => {
          const f = displayFields?.find((x: any) => x.id === col) || formFields?.find((x: any) => x.id === col)
          addSelectExpr(f ? (f.sql_expression || f.db_column_name) : col)
        })
      }

      if (selectExprs.length === 0) addSelectExpr('*')
      const columns = selectExprs.length > 0 ? selectExprs.join(', ') : '*'

      const currentOffset = append ? data.length : (currentPage - 1) * itemsPerPage;
      let orderSql = `"${modelName}"."${primaryKeyName}" DESC`;
      if (logicType === 'timeline' && timelineConfig?.date_field) {
        const dateFieldObj = displayFields.find((f: any) => f.id === timelineConfig.date_field);
        const dateColumnName = dateFieldObj ? dateFieldObj.db_column_name : timelineConfig.date_field;
        const timelineOrderHorizontal = timelineConfig.timeline_order_horizontal || 'asc';
        const timelineOrderVertical = timelineConfig.timeline_order_vertical || 'asc';
        const orderConf = timelineDirection === 'horizontal' ? timelineOrderHorizontal : timelineOrderVertical;
        orderSql = `"${modelName}"."${dateColumnName}" ${orderConf.toUpperCase()}, "${modelName}"."${primaryKeyName}" DESC`;
      }

      let rawQuery = '';
      const joinsSql = buildJoinsSql(joins, true);
      if (joinsSql) {
        let outerJoinsSql = '';
        if (projectRelations && projectRelations.length > 0 && outerRequiredTables.size > 0) {
          const allModels = project?.models || [];
          const resolvedRelations = resolveRelations(projectRelations, allModels);
          const steps = resolveAllJoins(resolvedRelations, modelName, Array.from(outerRequiredTables));
          outerJoinsSql = buildJoinSql(steps, new Set());
        } else if (!projectRelations || projectRelations.length === 0) {
          const requiredOuterJoins = (joins || []).filter((j: any) => {
            const toTable = (j.toTable || j.to || '').toLowerCase();
            const fromTable = (j.table || j.from || '').toLowerCase();
            if (!toTable || !fromTable) return false;
            const isToMaster = toTable === modelName.toLowerCase();
            const isFromMaster = fromTable === modelName.toLowerCase();
            const isToUsed = outerRequiredTables.has(toTable);
            const isFromUsed = outerRequiredTables.has(fromTable);
            if (!isToMaster && !isToUsed) return false;
            if (!isFromMaster && !isFromUsed) return false;
            return true;
          });
          outerJoinsSql = buildJoinsSql(requiredOuterJoins, false);
        }

        rawQuery = `SELECT ${columns} FROM (
    SELECT DISTINCT "${modelName}".* FROM "${modelName}"
    ${joinsSql}
    __WHERE_PLACEHOLDER__
    ORDER BY ${orderSql}
    LIMIT ${itemsPerPage} OFFSET ${currentOffset}
  ) AS "${modelName}" ${outerJoinsSql}
  ORDER BY ${orderSql}`
      } else {
        rawQuery = `SELECT ${columns} FROM "${modelName}" __WHERE_PLACEHOLDER__ ORDER BY ${orderSql}`
      }

      const currentModel = project?.models?.find((m: any) => m.db_table_name === modelName)
      const actualSchemaName = currentModel?.db_schema_name || project?.slug || 'public'

      const payload: any = {
        queryId: queryId,
        table: modelName,
        tableName: modelName,
        schemaName: actualSchemaName,
        action: 'select',
        query: rawQuery,
        sql: rawQuery,
        token: project?.secret_token || 'test-token',
        joins: joins,
        limit: itemsPerPage,
        offset: currentOffset
      }

      const dynamicAdvancedFilters: any[] = []
      const cleanFilters = { ...(currentFilters || {}) }

      Object.keys(cleanFilters).forEach(key => {
        if (key.startsWith(`${modelName}.`)) {
          const newKey = key.split('.')[1];
          if (cleanFilters[newKey] === undefined) {
            cleanFilters[newKey] = cleanFilters[key];
          }
          delete cleanFilters[key];
        }
      });

      if (filterFields) {
        filterFields.forEach((f: any) => {
          const zoneConfig = f.config?.filter_config || f.config || {}
          const op = zoneConfig.content?.filter_operator
          if (op && op !== 'ilike') {
            if (op === 'between') {
              const valStart = cleanFilters[`${f.db_column_name}_start`]
              const valEnd = cleanFilters[`${f.db_column_name}_end`]
              if (valStart && valEnd) {
                dynamicAdvancedFilters.push({ field: f.db_column_name, operator: 'between', value: valStart, value2: valEnd, logic: 'AND' })
              } else if (valStart) {
                dynamicAdvancedFilters.push({ field: f.db_column_name, operator: '>=', value: valStart, logic: 'AND' })
              } else if (valEnd) {
                dynamicAdvancedFilters.push({ field: f.db_column_name, operator: '<=', value: valEnd, logic: 'AND' })
              }
              delete cleanFilters[`${f.db_column_name}_start`]
              delete cleanFilters[`${f.db_column_name}_end`]
            } else {
              const val = cleanFilters[f.db_column_name]
              if (val) {
                dynamicAdvancedFilters.push({ field: f.db_column_name, operator: op, value: val, logic: 'AND' })
                delete cleanFilters[f.db_column_name]
              }
            }
          }
        })
      }

      Object.keys(cleanFilters).forEach(key => {
        if (key.includes('.')) {
          dynamicAdvancedFilters.push({ field: key, operator: '=', value: cleanFilters[key], logic: 'AND' })
          delete cleanFilters[key]
        }
      })

      const allAdvancedFilters = [...(advancedStaticFilters || []), ...dynamicAdvancedFilters]
      if (Object.keys(cleanFilters).length > 0) payload.filters = cleanFilters
      if (allAdvancedFilters.length > 0) payload.advancedFilters = allAdvancedFilters

      const countQueryId = crypto.randomUUID()
      activeQueriesRef.current.add(countQueryId)
      const countPayload: any = {
        queryId: countQueryId,
        table: modelName,
        tableName: modelName,
        schemaName: actualSchemaName,
        action: 'count_records',
        query: `SELECT COUNT(DISTINCT "${modelName}"."id") as total FROM "${modelName}" ${joinsSql} __WHERE_PLACEHOLDER__`,
        sql: '',
        token: project?.secret_token || 'test-token',
        joins: joins
      }

      if (Object.keys(cleanFilters).length > 0) countPayload.filters = cleanFilters
      if (allAdvancedFilters.length > 0) countPayload.advancedFilters = allAdvancedFilters

      setTimeout(() => {
        if (!tunnelChannel || !isTunnelReady) return
        tunnelChannel.send({ type: 'broadcast', event: 'sql_query', payload })
        if (!append) {
          tunnelChannel.send({ type: 'broadcast', event: 'sql_query', payload: countPayload })
        }
      }, 200)

      setTimeout(() => {
        setIsLoading(prev => {
          if (prev) {
            setError('Tempo limite excedido na requisição. Verifique sua conexão ou a configuração da tabela.')
            activeQueriesRef.current.delete(queryId)
          }
          return false
        })
        setIsFetchingBackground(prev => {
          if (prev) activeQueriesRef.current.delete(queryId)
          return false
        })
      }, 15000)
    }, 100)
  }

  fetchDataRef.current = fetchData

  const handleMove = async (recordId: string, newValue: any) => {
    const cleanPrimaryKeyName = primaryKeyName.split('.').pop() || 'id'
    const movedItem = data.find(item => String(item[cleanPrimaryKeyName] || item[primaryKeyName] || item._key || item.id || item.ID) === recordId)

    if (!movedItem) {
      toast(`Item não encontrado (Procurado ID: ${recordId})`, 'error')
      return
    }

    const actualPrimaryKey = movedItem[cleanPrimaryKeyName] || movedItem[primaryKeyName] || movedItem.id || movedItem.ID
    if (!actualPrimaryKey) {
      toast('Chave primária do item não encontrada.', 'error')
      return
    }

    let updates: Record<string, any> = {}
    if (newValue && typeof newValue === 'object') {
      updates = newValue
    } else {
      const groupFieldDef = displayFields.find((f: any) => f.id === kanbanGroupField) || displayFields.find((f: any) => f.db_column_name === 'status') || { db_column_name: 'status' }
      const groupFieldName = groupFieldDef.db_column_name
      const cleanGroupFieldName = groupFieldName.split('.').pop() || 'status'
      updates = { [cleanGroupFieldName]: newValue }
    }

    setData(prev => {
      const newData = prev.map(item => {
        const itemId = String(item[cleanPrimaryKeyName] || item[primaryKeyName] || item._key || item.id || item.ID)
        if (itemId === recordId) {
          const updatedItem = { ...item }
          for (const [col, val] of Object.entries(updates)) {
            updatedItem[col] = val
            const fullField = displayFields.find((f: any) => f.db_column_name.endsWith(col))?.db_column_name
            if (fullField) {
              updatedItem[fullField] = val
            }
          }
          return updatedItem
        }
        return item
      })
      const cacheKey = `${projectId}:${modelName}`
      setCachedData(cacheKey, newData)
      return newData
    })

    const setStatements = Object.entries(updates).map(([col, val]) => {
      const cleanVal = val === null ? 'NULL' : `'${String(val).replace(/'/g, "''")}'`
      return `${col} = ${cleanVal}`
    }).join(', ')

    const rawQuery = `UPDATE ${modelName} SET ${setStatements} WHERE ${cleanPrimaryKeyName} = '${String(actualPrimaryKey).replace(/'/g, "''")}'`

    const queryId = crypto.randomUUID()
    const payload: any = {
      queryId,
      table: modelName,
      tableName: modelName,
      schemaName: project?.models?.find((m: any) => m.db_table_name === modelName)?.db_schema_name || project?.slug || 'public',
      slug: project?.slug,
      action: 'update',
      data: updates,
      record: updates,
      query: rawQuery,
      sql: rawQuery,
      idColumn: cleanPrimaryKeyName,
      idValue: actualPrimaryKey,
      token: project?.secret_token || 'test-token'
    }

    const handleResult = (res: any) => {
      if (res.payload?.queryId === queryId) {
        if (!res.payload.success) {
          toast(res.payload.error || 'Erro ao salvar no banco', 'error')
        } else {
          toast(t('runtime.update_success'), 'success')
          if (onCustomAction) {
            onCustomAction({ action: 'system_refresh' })
          }
        }
      }
    }

    if (tunnelChannel && isTunnelReady) {
      tunnelChannel.on('broadcast', { event: `query_result_${queryId}` }, handleResult)
      tunnelChannel.send({ type: 'broadcast', event: 'sql_query', payload })
      setTimeout(() => {
        try {
          const bindings = tunnelChannel.bindings?.broadcast
          if (Array.isArray(bindings)) {
            tunnelChannel.bindings.broadcast = bindings.filter((b: any) => b.callback !== handleResult)
          }
        } catch (_) { }
      }, 5000)
    } else {
      const channelName = `tunnel:${projectId}`
      const channel = wrapChannelWithChunking(supabase.channel(channelName))
      channel.on('broadcast', { event: `query_result_${queryId}` }, handleResult)
      channel.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          channel.send({ type: 'broadcast', event: 'sql_query', payload })
          setTimeout(() => supabase.removeChannel((channel as any)._channel || channel), 5000)
        }
      })
    }
  }

  return {
    data,
    setData,
    isLoading,
    isFetchingBackground,
    error,
    totalServerRows,
    fetchData: (filters: any, forceRefresh?: boolean, append?: boolean) => fetchDataRef.current(filters, forceRefresh, append),
    handleMove,
    hasFetchedInitial,
    setHasFetchedInitial
  }
}
