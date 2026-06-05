'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Trash2, CheckCircle, AlertTriangle } from 'lucide-react'

export default function SyncResolutionClient({
  projectId,
  missingModels,
  missingFields,
  allModels,
  incomingPayload,
  newTables,
  workspaceSlug,
  projectSlug
}: {
  projectId: string,
  missingModels: any[],
  missingFields: any[],
  allModels: any[],
  incomingPayload: any[],
  newTables: string[],
  workspaceSlug: string,
  projectSlug: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mapping state: key = old UUID, value = new table/col name or '_DELETE_'
  const [tableMappings, setTableMappings] = useState<Record<string, string>>({})
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({})

  const handleTableMapping = (modelId: string, actionValue: string) => {
    setTableMappings(prev => ({ ...prev, [modelId]: actionValue }))
  }

  const handleFieldMapping = (fieldId: string, actionValue: string) => {
    setFieldMappings(prev => ({ ...prev, [fieldId]: actionValue }))
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    // Parse mappings into API payload
    const mappedTables: Record<string, string> = {}
    const deletedModels: string[] = []

    for (const [modelId, val] of Object.entries(tableMappings)) {
      if (val === '_DELETE_') deletedModels.push(modelId)
      else if (val) mappedTables[modelId] = val
    }

    const mappedFields: Record<string, string> = {}
    const deletedFields: string[] = []

    for (const [fieldId, val] of Object.entries(fieldMappings)) {
      if (val === '_DELETE_') deletedFields.push(fieldId)
      else if (val) mappedFields[fieldId] = val
    }

    try {
      const res = await fetch('/api/metadata/apply-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          mappedTables,
          mappedFields,
          deletedModels,
          deletedFields
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao aplicar sincronização')

      router.push(`/admin/${workspaceSlug}/${projectSlug}/studio`)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg flex items-center gap-3">
          <AlertTriangle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Tabe Mappings */}
      {missingModels.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">Tabelas Ausentes (Models)</h2>
          <div className="space-y-4">
            {missingModels.map(model => (
              <div key={model.id} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="w-1/3 font-mono text-sm line-through text-red-500">
                  {model.db_table_name}
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
                <div className="w-2/3">
                  <select
                    className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500/50"
                    value={tableMappings[model.id] || ''}
                    onChange={(e) => handleTableMapping(model.id, e.target.value)}
                  >
                    <option value="" disabled>-- Selecione uma Ação --</option>
                    <option value="_DELETE_">🗑️ Confirmar Exclusão Definitiva (Perderá fluxos)</option>
                    <optgroup label="Renomear para Tabela Nova:">
                      {newTables.map(tName => (
                        <option key={tName} value={tName}>🔄 Renomear para: {tName}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Field Mappings */}
      {missingFields.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">Colunas Ausentes (Fields)</h2>
          <div className="space-y-6">
            {Object.entries(
              missingFields.reduce((acc, field) => {
                const parentModel = allModels.find(m => m.id === field.model_id)
                // Se a tabela parent foi deletada inteira, não precisamos mostrar os fields
                if (tableMappings[field.model_id] === '_DELETE_') return acc;
                
                const tableName = parentModel?.db_table_name || 'Desconhecida';
                if (!acc[tableName]) acc[tableName] = { model: parentModel, fields: [] };
                acc[tableName].fields.push(field);
                return acc;
              }, {} as Record<string, { model: any, fields: any[] }>)
            ).map(([tableName, group]: [string, any]) => {
              
              const parentModel = group.model;
              
              // Se a tabela parent foi deletada inteira, não precisamos mostrar os fields
              if (tableMappings[parentModel?.id] === '_DELETE_') return null;

              // Identifica se a tabela inteira sumiu (está na aba Tabelas)
              const isMissingModel = missingModels.some((m: any) => m.id === parentModel?.id);

              // Se a tabela sumiu e o usuário ainda não escolheu uma ação para ela, não exibe os campos
              if (isMissingModel && !tableMappings[parentModel?.id]) {
                return null;
              }

              // Se a tabela parent foi renomeada, buscamos as colunas da tabela nova
              const targetTableName = parentModel && tableMappings[parentModel.id] 
                ? tableMappings[parentModel.id] 
                : tableName; // ou o nome atual se não mudou

              const targetTablePayload = incomingPayload.find((t: any) => t.name === targetTableName);
              const newColumns = targetTablePayload?.columns?.map((c:any) => c.name) || [];

              const trulyMissingFields = group.fields.filter((field: any) => !newColumns.includes(field.db_column_name));

              if (trulyMissingFields.length === 0) {
                return null;
              }

              return (
                <div key={tableName} className="bg-gray-50/50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
                  <div className="bg-gray-100/80 dark:bg-gray-800/80 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <span className="p-1 bg-white dark:bg-gray-700 rounded-md shadow-sm text-xs">Tabela</span>
                      {tableName}
                      {targetTableName !== tableName && (
                        <span className="text-xs text-indigo-500 font-normal">→ Renomeada para {targetTableName}</span>
                      )}
                    </h3>
                  </div>
                  <div className="p-4 space-y-3">
                    {trulyMissingFields.map((field: any) => (
                      <div key={field.id} className="flex items-center gap-4 bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className="w-1/3">
                          <span className="font-mono text-sm line-through text-red-500">{field.db_column_name}</span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                        <div className="w-2/3">
                          <select
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500/50"
                            value={fieldMappings[field.id] || ''}
                            onChange={(e) => handleFieldMapping(field.id, e.target.value)}
                          >
                            <option value="" disabled>-- Selecione uma Ação --</option>
                            <option value="_DELETE_">🗑️ Confirmar Exclusão (Perderá lógicas de forms)</option>
                            {newColumns.length > 0 && (
                              <optgroup label={`Renomear para Coluna em ${targetTableName}:`}>
                                {newColumns.map((cName: string) => (
                                  <option key={cName} value={cName}>🔄 Renomear para: {cName}</option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Resumo e Botão */}
      <div className="flex justify-end pt-4">
        <button
          onClick={handleSubmit}
          disabled={loading || 
            // Bloqueia se ainda houver dropdown sem selecionar
            (missingModels.some(m => !tableMappings[m.id])) ||
            (missingFields.some(f => {
              if (tableMappings[f.model_id] === '_DELETE_') return false; // ignorado
              
              const parentModel = allModels.find(m => m.id === f.model_id);
              if (parentModel) {
                const targetTableName = tableMappings[f.model_id] || parentModel.db_table_name;
                const targetTablePayload = incomingPayload.find((t: any) => t.name === targetTableName);
                const newColumns = targetTablePayload?.columns?.map((c:any) => c.name) || [];
                
                if (newColumns.includes(f.db_column_name)) {
                  return false; // ignorado pois matchou automaticamente
                }
              }

              return !fieldMappings[f.id];
            }))
          }
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span>Aplicando...</span>
          ) : (
            <>
              <CheckCircle className="h-5 w-5" />
              <span>Aplicar Resoluções e Sincronizar</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
