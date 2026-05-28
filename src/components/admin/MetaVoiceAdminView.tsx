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
  ThumbsUp,
  RefreshCw,
  Eye,
  EyeOff,
  Trash2,
  UserX,
  UserCheck
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
import {
  toggleUserMetaVoiceBlock,
  toggleSuggestionHide,
  deleteSuggestionAdmin
} from '@/app/actions/admin'

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

  const [isHidden, setIsHidden] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [isProcessingBlock, setIsProcessingBlock] = useState(false)
  const [isProcessingDelete, setIsProcessingDelete] = useState(false)

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
    setIsHidden(s.is_hidden || false)
    setIsBlocked(s.author?.is_blocked_metavoice || false)
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

    // Update is_hidden if changed
    if (isHidden !== selectedSuggestion.is_hidden) {
      await toggleSuggestionHide(selectedSuggestion.id, isHidden)
    }

    toast('Sugestão atualizada com sucesso!', 'success')
    setShowModal(false)
    fetchSuggestions()
    setIsSaving(false)
  }

  const handleToggleBlock = async () => {
    if (!selectedSuggestion?.author) return
    setIsProcessingBlock(true)
    const nextBlock = !isBlocked
    const res = await toggleUserMetaVoiceBlock(selectedSuggestion.author.id, nextBlock)
    if (res.success) {
      setIsBlocked(nextBlock)
      toast(nextBlock ? 'Usuário bloqueado no MetaVoice!' : 'Usuário desbloqueado!', 'success')
      fetchSuggestions()
    } else {
      toast(res.error || 'Erro ao alternar bloqueio', 'error')
    }
    setIsProcessingBlock(false)
  }

  const handleDeleteSuggestion = async () => {
    if (!selectedSuggestion) return
    if (!confirm('Tem certeza de que deseja EXCLUIR permanentemente esta sugestão? Esta ação não pode ser desfeita.')) return
    
    setIsProcessingDelete(true)
    const res = await deleteSuggestionAdmin(selectedSuggestion.id)
    if (res.success) {
      toast('Sugestão excluída com sucesso!', 'success')
      setShowModal(false)
      fetchSuggestions()
    } else {
      toast(res.error || 'Erro ao excluir sugestão', 'error')
    }
    setIsProcessingDelete(false)
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
          <button
            type="button"
            onClick={fetchSuggestions}
            disabled={loading}
            className="p-2.5 text-neutral-500 hover:text-indigo-600 dark:text-neutral-400 dark:hover:text-indigo-400 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800/80 transition-all flex items-center justify-center disabled:opacity-50 group active:scale-95 duration-200 shadow-sm"
            title="Atualizar dados"
          >
            <RefreshCw className={cn("w-4 h-4 transition-transform duration-500 ease-out", loading ? "animate-spin" : "group-hover:rotate-180")} />
          </button>
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
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-neutral-900 dark:text-white truncate max-w-[300px]">
                          {s.title}
                        </div>
                        {s.is_hidden && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border border-neutral-200 dark:border-neutral-700">Oculta</span>
                        )}
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
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-black text-lg">{selectedSuggestion.title}</h3>
                {selectedSuggestion.author && (
                  <div className="flex items-center gap-2 bg-white dark:bg-neutral-800 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 shrink-0">
                    <img
                      src={selectedSuggestion.author.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${selectedSuggestion.author.id}`}
                      alt={selectedSuggestion.author.full_name || 'Autor'}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                    <div className="text-left">
                      <div className="text-xs font-black text-neutral-900 dark:text-white leading-none">
                        {selectedSuggestion.author.full_name || 'Membro'}
                        {selectedSuggestion.is_anonymous && (
                          <span className="text-[8px] font-black text-rose-500 bg-rose-500/10 px-1 py-0.5 rounded ml-1 uppercase">Anônimo</span>
                        )}
                      </div>
                      <div className="text-[9px] text-neutral-400 leading-none mt-0.5">Autor</div>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 whitespace-pre-wrap">{selectedSuggestion.description}</p>
              <div className="flex items-center gap-4 text-xs font-bold text-neutral-500 uppercase">
                <span>Categoria: {selectedSuggestion.category}</span>
                <span>Data: {new Date(selectedSuggestion.created_at).toLocaleString()}</span>
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

            {/* Moderation & Safety Tools */}
            <div className="border-t border-neutral-100 dark:border-neutral-800 pt-6">
              <h4 className="text-xs font-black uppercase text-neutral-500 mb-3 flex items-center gap-1">
                <ShieldAlert className="w-4 h-4 text-indigo-500" /> Ferramentas de Moderação e Segurança
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                {/* Ocultar / Exibir */}
                <div className="flex items-center gap-2.5 p-3.5 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
                  <input
                    type="checkbox"
                    id="hide-suggestion"
                    checked={isHidden}
                    onChange={e => setIsHidden(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-neutral-300 dark:border-neutral-700"
                  />
                  <label htmlFor="hide-suggestion" className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5 cursor-pointer">
                    {isHidden ? <EyeOff className="w-4 h-4 text-neutral-500" /> : <Eye className="w-4 h-4 text-emerald-500" />}
                    {isHidden ? 'Oculto (Exibir)' : 'Ocultar do MetaVoice'}
                  </label>
                </div>

                {/* Bloquear Autor */}
                {selectedSuggestion.author && (
                  <button
                    type="button"
                    onClick={handleToggleBlock}
                    disabled={isProcessingBlock}
                    className={cn(
                      "px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 border transition-all active:scale-95 disabled:opacity-50",
                      isBlocked
                        ? "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                        : "bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20"
                    )}
                  >
                    {isBlocked ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                    {isBlocked ? 'Desbloquear Autor' : 'Bloquear Autor'}
                  </button>
                )}

                {/* Excluir Sugestão */}
                <button
                  type="button"
                  onClick={handleDeleteSuggestion}
                  disabled={isProcessingDelete}
                  className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir Sugestão
                </button>

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
