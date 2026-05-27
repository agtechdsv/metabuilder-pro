'use client'

import { useState, useEffect } from 'react'
import {
  Lightbulb,
  Search,
  CheckCircle2,
  Clock,
  Ban,
  Activity,
  Layers,
  ShieldAlert,
  Loader2,
  MessageCircle,
  Star,
  ThumbsUp
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import {
  Suggestion,
  getSuggestions,
  updateSuggestionStatus,
  adminReplyToSuggestion
} from '@/app/actions/metavoice'

const STATUS_MAP: Record<string, { label: string, color: string, icon: any }> = {
  under_review: { label: 'Em Análise', color: 'bg-amber-500/10 text-amber-500', icon: Clock },
  planned: { label: 'Planejado', color: 'bg-blue-500/10 text-blue-500', icon: Layers },
  in_progress: { label: 'Em Desenvolvimento', color: 'bg-purple-500/10 text-purple-500', icon: Activity },
  completed: { label: 'Concluído', color: 'bg-emerald-500/10 text-emerald-500', icon: CheckCircle2 },
  declined: { label: 'Descartada', color: 'bg-rose-500/10 text-rose-500', icon: Ban },
  duplicate: { label: 'Duplicata', color: 'bg-neutral-500/10 text-neutral-500', icon: Layers },
}

export function MetaVoiceAdminView() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null)
  const [showModal, setShowModal] = useState(false)
  
  const [editStatus, setEditStatus] = useState('')
  const [publicReply, setPublicReply] = useState('')
  const [privateNote, setPrivateNote] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const { toast } = useToast()

  const fetchSuggestions = async () => {
    setLoading(true)
    const { data, error } = await getSuggestions()
    if (!error && data) {
      setSuggestions(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchSuggestions()
  }, [])

  const handleOpenDetails = (s: Suggestion) => {
    setSelectedSuggestion(s)
    setEditStatus(s.status)
    setPublicReply(s.admin_response_public || '')
    setPrivateNote(s.admin_response_private || '')
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSuggestion) return

    setIsSaving(true)
    
    // Update status if changed
    if (editStatus !== selectedSuggestion.status) {
      await updateSuggestionStatus(selectedSuggestion.id, editStatus)
    }

    // Update replies
    await adminReplyToSuggestion(selectedSuggestion.id, {
      publicResponse: publicReply,
      privateNote: privateNote
    })

    toast('Sugestão atualizada com sucesso!', 'success')
    setShowModal(false)
    fetchSuggestions()
    setIsSaving(false)
  }

  const filtered = suggestions.filter(s => {
    const matchesSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-neutral-900 dark:text-white flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-indigo-500" /> Moderação MetaVoice
          </h2>
          <p className="text-sm text-neutral-500 mt-1">
            Gerencie as sugestões dos usuários, defina o roadmap e interaja com a comunidade.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input 
              type="text" 
              placeholder="Buscar..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Todos os Status</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {/* List */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-neutral-500 text-sm">
            Nenhuma sugestão encontrada.
          </div>
        ) : (
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-800 text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-6 py-4 font-black">Título</th>
                <th className="px-6 py-4 font-black text-center">Status</th>
                <th className="px-6 py-4 font-black text-center">Votos</th>
                <th className="px-6 py-4 font-black text-center">Resposta Adm</th>
                <th className="px-6 py-4 font-black text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {filtered.map(s => {
                const st = STATUS_MAP[s.status] || STATUS_MAP.under_review
                const StatusIcon = st.icon
                return (
                  <tr key={s.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-neutral-900 dark:text-white truncate max-w-[300px]">
                        {s.title}
                      </div>
                      <div className="text-xs text-neutral-500">{new Date(s.created_at).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase", st.color)}>
                        <StatusIcon className="w-3 h-3" /> {st.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-3">
                        <span className="flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          <ThumbsUp className="w-3.5 h-3.5" /> {s._count?.likes || 0}
                        </span>
                        {s.avgStars !== undefined && s.avgStars > 0 && (
                          <span className="flex items-center gap-1 text-xs font-bold text-amber-500">
                            <Star className="w-3.5 h-3.5" /> {s.avgStars.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {s.admin_response_public ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                      ) : (
                        <span className="text-neutral-300 dark:text-neutral-700">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleOpenDetails(s)}
                        className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white rounded-lg text-xs font-bold transition-colors"
                      >
                        Avaliar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Edit/Moderate */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Moderar Sugestão" size="2xl">
        {selectedSuggestion && (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="p-4 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <h3 className="font-black text-lg mb-1">{selectedSuggestion.title}</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 whitespace-pre-wrap">{selectedSuggestion.description}</p>
              <div className="flex items-center gap-4 text-xs font-bold text-neutral-500 uppercase">
                <span>Categoria: {selectedSuggestion.category}</span>
                <span>Anônimo: {selectedSuggestion.is_anonymous ? 'Sim' : 'Não'}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-neutral-100 dark:border-neutral-800 pt-6">
              
              {/* Left Column */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase text-neutral-500 mb-1.5">Status da Sugestão</label>
                  <select 
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value)}
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500"
                  >
                    {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-neutral-500 mb-1.5 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-500" /> Nota Privada (Apenas Admins)
                  </label>
                  <textarea 
                    value={privateNote}
                    onChange={e => setPrivateNote(e.target.value)}
                    placeholder="Ex: Usuário x solicitou também via ticket #123..."
                    className="w-full bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-500 h-32 resize-none"
                  />
                </div>
              </div>

              {/* Right Column */}
              <div>
                <label className="block text-xs font-black uppercase text-neutral-500 mb-1.5 text-emerald-600 dark:text-emerald-400">
                  Resposta Oficial (Pública)
                </label>
                <textarea 
                  value={publicReply}
                  onChange={e => setPublicReply(e.target.value)}
                  placeholder="Mensagem oficial que todos os clientes poderão ver..."
                  className="w-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 h-48 resize-none"
                />
              </div>

            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-5 py-2 text-sm font-bold text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black uppercase tracking-wider rounded-xl transition-colors flex items-center gap-2"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Salvar Avaliação
              </button>
            </div>
          </form>
        )}
      </Modal>

    </div>
  )
}
