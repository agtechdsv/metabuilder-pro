'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lightbulb,
  Plus,
  Search,
  Filter,
  ThumbsUp,
  Star,
  MessageCircle,
  X,
  Loader2,
  CheckCircle2,
  Clock,
  Ban,
  Activity,
  Layers,
  MoreVertical,
  ShieldAlert
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import {
  Suggestion,
  getSuggestions,
  createSuggestion,
  voteSuggestion,
  addSuggestionComment,
  getSuggestionById
} from '@/app/actions/metavoice'
import { cn } from '@/lib/utils'

interface MetaVoiceViewProps {
  userId?: string
}

const CATEGORIES = [
  { id: 'all', label: 'Todas as Categorias' },
  { id: 'ui_ux', label: 'UI / UX' },
  { id: 'integration', label: 'Integração' },
  { id: 'feature', label: 'Nova Funcionalidade' },
  { id: 'bug', label: 'Bug / Correção' },
  { id: 'other', label: 'Outro' }
]

const STATUS_MAP: Record<string, { label: string, color: string, icon: any }> = {
  under_review: { label: 'Em Análise', color: 'bg-amber-500/10 text-amber-500', icon: Clock },
  planned: { label: 'Planejado', color: 'bg-blue-500/10 text-blue-500', icon: Layers },
  in_progress: { label: 'Em Desenvolvimento', color: 'bg-purple-500/10 text-purple-500', icon: Activity },
  completed: { label: 'Concluído', color: 'bg-emerald-500/10 text-emerald-500', icon: CheckCircle2 },
  declined: { label: 'Descartada', color: 'bg-rose-500/10 text-rose-500', icon: Ban },
  duplicate: { label: 'Duplicata', color: 'bg-neutral-500/10 text-neutral-500', icon: Layers },
}

export function MetaVoiceView({ userId }: MetaVoiceViewProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modal New Suggestion
  const [showNewModal, setShowNewModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newCategory, setNewCategory] = useState('feature')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Modal Details
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [isCommenting, setIsCommenting] = useState(false)

  const { toast } = useToast()

  const fetchSuggestions = async () => {
    setLoading(true)
    const { data, error } = await getSuggestions({
      category: filterCategory,
      status: filterStatus
    })
    if (!error && data) {
      setSuggestions(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchSuggestions()
  }, [filterCategory, filterStatus])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || !newDesc.trim()) return

    setIsSubmitting(true)
    const { error } = await createSuggestion({
      title: newTitle,
      description: newDesc,
      category: newCategory,
      is_anonymous: isAnonymous
    })

    if (error) {
      toast(error, 'error')
    } else {
      toast('Sugestão enviada com sucesso!', 'success')
      setShowNewModal(false)
      setNewTitle('')
      setNewDesc('')
      setNewCategory('feature')
      setIsAnonymous(false)
      fetchSuggestions()
    }
    setIsSubmitting(false)
  }

  const handleOpenDetails = async (id: string) => {
    setSelectedId(id)
    setLoadingDetails(true)
    const { data, error } = await getSuggestionById(id)
    if (!error && data) {
      setSelectedSuggestion(data)
    }
    setLoadingDetails(false)
  }

  const handleLike = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const { error } = await voteSuggestion(id, 'like')
    if (error) {
      toast(error, 'error')
    } else {
      if (selectedId === id) handleOpenDetails(id)
      fetchSuggestions()
    }
  }

  const handleStar = async (id: string, value: number) => {
    const { error } = await voteSuggestion(id, 'star', value)
    if (error) {
      toast(error, 'error')
    } else {
      if (selectedId === id) handleOpenDetails(id)
      fetchSuggestions()
    }
  }

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedId || !newComment.trim()) return

    setIsCommenting(true)
    const { error } = await addSuggestionComment(selectedId, newComment)
    if (error) {
      toast(error, 'error')
    } else {
      toast('Comentário adicionado!', 'success')
      setNewComment('')
      handleOpenDetails(selectedId)
      fetchSuggestions()
    }
    setIsCommenting(false)
  }

  const filteredSuggestions = suggestions.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getCategoryLabel = (id: string) => CATEGORIES.find(c => c.id === id)?.label || id

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-lg border border-indigo-500/20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-white/10 border border-white/20 mb-4">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" /> MetaVoice
          </span>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-2">Ideias & Sugestões</h2>
          <p className="text-indigo-200 text-sm md:text-base leading-relaxed mb-6">
            Ajude-nos a construir o futuro do MetaBuilderPRO. Envie suas ideias, vote nas sugestões de outros usuários e acompanhe nosso roadmap.
          </p>
          <button
            onClick={() => setShowNewModal(true)}
            className="px-5 py-2.5 bg-white text-indigo-900 font-black text-sm uppercase tracking-wider rounded-xl hover:bg-neutral-100 transition-colors shadow-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Nova Sugestão
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-2 rounded-2xl">
        <div className="flex-1 w-full relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input 
            type="text" 
            placeholder="Buscar sugestões..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none focus:ring-0 pl-10 pr-4 py-2 text-sm text-neutral-900 dark:text-neutral-100"
          />
        </div>
        <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-800 hidden md:block"></div>
        <div className="flex gap-2 w-full md:w-auto px-2 pb-2 md:pb-0 overflow-x-auto">
          <select 
            value={filterCategory} 
            onChange={e => setFilterCategory(e.target.value)}
            className="bg-neutral-100 dark:bg-neutral-800 border-none text-xs font-bold rounded-lg px-3 py-2 text-neutral-700 dark:text-neutral-300 focus:ring-0"
          >
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select 
            value={filterStatus} 
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-neutral-100 dark:bg-neutral-800 border-none text-xs font-bold rounded-lg px-3 py-2 text-neutral-700 dark:text-neutral-300 focus:ring-0"
          >
            <option value="all">Todos os Status</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : filteredSuggestions.length === 0 ? (
        <div className="py-20 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center text-neutral-400 mb-4">
            <Lightbulb className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-neutral-900 dark:text-white">Nenhuma sugestão encontrada</h3>
          <p className="text-sm text-neutral-500 mt-2 max-w-sm">
            Seja o primeiro a enviar uma ideia nesta categoria!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSuggestions.map(s => {
            const hasLiked = s.votes?.some(v => v.user_id === userId && v.type === 'like')
            const st = STATUS_MAP[s.status] || STATUS_MAP.under_review
            const StatusIcon = st.icon

            return (
              <div 
                key={s.id} 
                onClick={() => handleOpenDetails(s.id)}
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col h-full group"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className={cn("px-2.5 py-1 rounded-full text-[9px] font-black uppercase flex items-center gap-1", st.color)}>
                    <StatusIcon className="w-3 h-3" /> {st.label}
                  </span>
                  <span className="text-[10px] font-black uppercase text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded-full">
                    {getCategoryLabel(s.category)}
                  </span>
                </div>
                
                <h3 className="text-lg font-black text-neutral-900 dark:text-white leading-tight mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                  {s.title}
                </h3>
                <p className="text-xs text-neutral-500 line-clamp-3 mb-6 flex-1">
                  {s.description}
                </p>

                {/* Footer Metrics */}
                <div className="flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-neutral-800 mt-auto">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={(e) => handleLike(s.id, e)}
                      className={cn(
                        "flex items-center gap-1.5 text-xs font-bold transition-colors",
                        hasLiked ? "text-indigo-600 dark:text-indigo-400" : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                      )}
                    >
                      <ThumbsUp className={cn("w-4 h-4", hasLiked && "fill-current")} />
                      {s._count?.likes || 0}
                    </button>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-400">
                      <MessageCircle className="w-4 h-4" />
                      {s._count?.comments || 0}
                    </div>
                  </div>
                  
                  {s.avgStars !== undefined && s.avgStars > 0 && (
                    <div className="flex items-center gap-1 text-xs font-bold text-amber-500">
                      <Star className="w-4 h-4 fill-current" />
                      {s.avgStars.toFixed(1)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* New Suggestion Modal */}
      <Modal isOpen={showNewModal} onClose={() => setShowNewModal(false)} title="Nova Sugestão" size="xl">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-black uppercase text-neutral-500 mb-1.5">Título da Sugestão</label>
            <input 
              required
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Ex: Modo Escuro no Editor SQL"
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-black uppercase text-neutral-500 mb-1.5">Categoria</label>
            <select 
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
            >
              {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-black uppercase text-neutral-500 mb-1.5">Descrição Detalhada</label>
            <textarea 
              required
              maxLength={2000}
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Explique o que você gostaria que fosse implementado e qual problema isso resolve..."
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 h-48 resize-none"
            />
            <div className="flex justify-between items-center mt-1.5 px-1">
              <span className="text-[10px] text-neutral-400">Máximo de 2000 caracteres</span>
              <span className={cn(
                "text-[10px] font-bold",
                newDesc.length > 1800 ? "text-rose-500 animate-pulse" : "text-neutral-400"
              )}>
                {newDesc.length} / 2000
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <input 
              type="checkbox" 
              id="anon" 
              checked={isAnonymous}
              onChange={e => setIsAnonymous(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-neutral-300"
            />
            <label htmlFor="anon" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Submeter anonimamente (outros usuários não verão seu nome)
            </label>
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setShowNewModal(false)}
              className="px-5 py-2.5 text-sm font-bold text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black uppercase tracking-wider rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Enviar Sugestão
            </button>
          </div>
        </form>
      </Modal>

      {/* Details Drawer/Modal */}
      <Modal isOpen={!!selectedId} onClose={() => setSelectedId(null)} title="Detalhes da Sugestão" size="2xl">
        {loadingDetails || !selectedSuggestion ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Header Content */}
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className={cn("px-2.5 py-1 rounded-full text-[9px] font-black uppercase flex items-center gap-1", STATUS_MAP[selectedSuggestion.status]?.color || STATUS_MAP.under_review.color)}>
                  {STATUS_MAP[selectedSuggestion.status]?.label || 'Em Análise'}
                </span>
                <span className="text-[10px] font-black uppercase text-neutral-400">
                  {new Date(selectedSuggestion.created_at).toLocaleDateString()}
                </span>
              </div>
              <h2 className="text-2xl font-black text-neutral-900 dark:text-white mb-2">{selectedSuggestion.title}</h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed bg-neutral-50 dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                {selectedSuggestion.description}
              </p>
            </div>

            {/* Admin Response */}
            {selectedSuggestion.admin_response_public && (
              <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">Resposta Oficial do Time</span>
                </div>
                <p className="text-sm text-emerald-800 dark:text-emerald-200">
                  {selectedSuggestion.admin_response_public}
                </p>
              </div>
            )}

            {/* Voting Area */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => handleLike(selectedSuggestion.id)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wider flex items-center gap-2 transition-all",
                    selectedSuggestion.votes?.some(v => v.user_id === userId && v.type === 'like')
                      ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  )}
                >
                  <ThumbsUp className={cn("w-4 h-4", selectedSuggestion.votes?.some(v => v.user_id === userId && v.type === 'like') && "fill-current")} />
                  {selectedSuggestion.votes?.some(v => v.user_id === userId && v.type === 'like') ? 'Você votou' : 'Eu também quero!'}
                </button>
                <span className="text-sm font-bold text-neutral-500">
                  {selectedSuggestion.votes?.filter(v => v.type === 'like').length || 0} votos
                </span>
              </div>
              
              <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-800 hidden sm:block"></div>
              
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mr-2">Avalie a importância:</span>
                {[1, 2, 3, 4, 5].map(star => {
                  const userStar = selectedSuggestion.votes?.find(v => v.user_id === userId && v.type === 'star')?.star_value || 0
                  const isFilled = star <= userStar
                  return (
                    <button 
                      key={star} 
                      onClick={() => handleStar(selectedSuggestion.id, star)}
                      className="focus:outline-none transition-transform hover:scale-110"
                    >
                      <Star className={cn("w-6 h-6", isFilled ? "fill-amber-400 text-amber-400" : "text-neutral-300 dark:text-neutral-700 hover:text-amber-300")} />
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Comments */}
            <div className="space-y-4">
              <h3 className="text-sm font-black uppercase text-neutral-500 tracking-wider border-b border-neutral-100 dark:border-neutral-800 pb-2">
                Comentários ({selectedSuggestion.comments?.length || 0})
              </h3>
              
              <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                {selectedSuggestion.comments?.map(comment => (
                  <div key={comment.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center shrink-0 text-xs font-bold text-neutral-500">
                      {comment.is_admin_response ? 'AG' : (comment.author?.full_name?.charAt(0) || 'U')}
                    </div>
                    <div className={cn("flex-1 p-3 rounded-2xl", comment.is_admin_response ? "bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20" : "bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800")}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn("text-xs font-black", comment.is_admin_response ? "text-indigo-600 dark:text-indigo-400" : "text-neutral-900 dark:text-white")}>
                          {comment.is_admin_response ? 'Equipe MetaBuilderPRO' : (comment.author?.full_name || 'Usuário')}
                        </span>
                        <span className="text-[9px] font-medium text-neutral-400">
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-600 dark:text-neutral-300 whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  </div>
                ))}
                {(!selectedSuggestion.comments || selectedSuggestion.comments.length === 0) && (
                  <p className="text-xs text-neutral-400 italic text-center py-4">Nenhum comentário ainda. Seja o primeiro a opinar!</p>
                )}
              </div>

              {/* Add comment */}
              <form onSubmit={handleComment} className="flex gap-2 pt-2">
                <input 
                  required
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Adicionar um comentário..."
                  className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={isCommenting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-colors disabled:opacity-50"
                >
                  {isCommenting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar'}
                </button>
              </form>
            </div>
          </div>
        )}
      </Modal>

    </div>
  )
}
