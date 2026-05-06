'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { LayoutGrid, Loader2 } from 'lucide-react'

interface DynamicGridProps {
  projectId: string
  modelName: string
  fields: any[]
}

export default function DynamicGrid({ projectId, modelName, fields }: DynamicGridProps) {
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const supabase = createClient()

  useEffect(() => {
    // 1. Gera um ID único para esta requisição
    const queryId = crypto.randomUUID()
    const channelName = `tunnel:${projectId}`
    
    console.log(`Conectando ao canal: ${channelName}`)
    const channel = supabase.channel(channelName)

    // 2. Se inscreve para ouvir a resposta do Agente (usando o queryId que geramos)
    channel
      .on('broadcast', { event: `query_result_${queryId}` }, (payload) => {
        console.log('Resposta do Agente Recebida:', payload)
        if (payload.payload.success) {
          setData(payload.payload.data)
        } else {
          setError(payload.payload.error)
        }
        setIsLoading(false)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // 3. Assim que conectar no túnel, grita para o Agente CLI pedir os dados
          console.log('Enviando pedido de dados para o Agente...')
          channel.send({
            type: 'broadcast',
            event: 'sql_query',
            payload: {
              queryId: queryId,
              table: modelName,
              action: 'select',
              token: 'test-token' // Simulando o token por enquanto
            }
          })
          
          // Timeout de segurança caso o Agente não esteja rodando
          setTimeout(() => {
            setIsLoading(prev => {
              if (prev) {
                setError('O Agente CLI não respondeu a tempo. Ele está rodando na máquina do cliente?')
                return false
              }
              return prev
            })
          }, 8000)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId, modelName, supabase])

  if (isLoading) {
    return (
      <tr>
        <td colSpan={fields.length + 2} className="px-6 py-16 text-center text-neutral-500">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
            <h3 className="text-lg font-medium text-neutral-300">Conectando ao banco de dados do cliente...</h3>
            <p className="text-sm mt-2">Aguardando resposta do Agente CLI via Túnel Seguro.</p>
          </div>
        </td>
      </tr>
    )
  }

  if (error) {
    return (
      <tr>
        <td colSpan={fields.length + 2} className="px-6 py-16 text-center text-red-500">
          <div className="flex flex-col items-center justify-center">
            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
              <span className="text-xl">❌</span>
            </div>
            <h3 className="text-lg font-medium text-red-400 mb-1">Falha na Comunicação</h3>
            <p className="text-sm">{error}</p>
          </div>
        </td>
      </tr>
    )
  }

  if (data.length === 0) {
    return (
      <tr>
        <td colSpan={fields.length + 2} className="px-6 py-16 text-center text-neutral-500">
          Nenhum registro encontrado nesta tabela.
        </td>
      </tr>
    )
  }

  // Renderiza as linhas de DADOS REAIS
  return (
    <>
      {data.map((row, rowIndex) => (
        <tr key={rowIndex} className="hover:bg-neutral-800/50 transition-colors">
          <td className="px-6 py-4 whitespace-nowrap w-12">
            <input type="checkbox" className="rounded bg-neutral-800 border-neutral-700 text-indigo-500" />
          </td>
          {fields.map((field) => (
            <td key={field.id} className="px-6 py-4 whitespace-nowrap text-sm text-neutral-300">
              {/* Uma verificação super simples para mostrar objects/arrays como string */}
              {typeof row[field.db_column_name] === 'object' 
                ? JSON.stringify(row[field.db_column_name]) 
                : String(row[field.db_column_name] ?? '')}
            </td>
          ))}
          <td className="px-6 py-4 text-right whitespace-nowrap text-sm font-medium">
            <button className="text-indigo-400 hover:text-indigo-300 mr-4">Editar</button>
            <button className="text-red-400 hover:text-red-300">Excluir</button>
          </td>
        </tr>
      ))}
    </>
  )
}
