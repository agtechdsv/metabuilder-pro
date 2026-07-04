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
  ShieldAlert,
  RefreshCw,
  ExternalLink
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
  hideHeader?: boolean
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

export function MetaVoiceView({ userId, hideHeader = false }: MetaVoiceViewProps) {
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
  const [suggestionImageFile, setSuggestionImageFile] = useState<File | null>(null)
  const [suggestionImagePreview, setSuggestionImagePreview] = useState<string | null>(null)

  // Modal Details
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [isCommenting, setIsCommenting] = useState(false)

  const { toast } = useToast()

  const fetchSuggestions = async (silent = false) => {
    if (!silent) setLoading(true)
    const { data, error } = await getSuggestions({
      category: filterCategory,
      status: filterStatus
    })
    if (!error && data) {
      setSuggestions(data)
    }
    if (!silent) setLoading(false)
  }

  useEffect(() => {
    fetchSuggestions()
  }, [filterCategory, filterStatus])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || !newDesc.trim()) return

    setIsSubmitting(true)

    // If image attached, convert to base64 to pass along (server action will handle upload)
    let imageDataUrl: string | undefined = undefined
    if (suggestionImageFile) {
      imageDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(suggestionImageFile)
      })
    }

    const { error } = await createSuggestion({
      title: newTitle,
      description: newDesc,
      category: newCategory,
      is_anonymous: isAnonymous,
      image_data_url: imageDataUrl
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
      setSuggestionImageFile(null)
      setSuggestionImagePreview(null)
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

  // Atualiza os dados do modal em background sem fechar/piscar
  const refreshSelectedSilently = async (id: string) => {
    const { data, error } = await getSuggestionById(id)
    if (!error && data) {
      setSelectedSuggestion(data)
    }
  }

  const handleLike = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const { error } = await voteSuggestion(id, 'like')
    if (error) {
      toast(error, 'error')
    } else {
      if (selectedId === id) refreshSelectedSilently(id)
      fetchSuggestions(true)
    }
  }

  const handleStar = async (id: string, value: number) => {
    const { error } = await voteSuggestion(id, 'star', value)
    if (error) {
      toast(error, 'error')
    } else {
      if (selectedId === id) refreshSelectedSilently(id)
      fetchSuggestions(true)
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
      refreshSelectedSilently(selectedId)
      fetchSuggestions(true)
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
      {!hideHeader && (
        <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-lg border border-indigo-500/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10 max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-white/10 border border-white/20">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" /> MetaVoice
              </span>
              <button 
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.open('/client/metavoice/popout', '_blank', 'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no')
                  }
                }}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md border border-white/20 transition-all flex items-center gap-2 group"
                title="Abrir em Nova Janela (Modo Foco)"
              >
                <span className="hidden md:inline text-xs font-bold uppercase tracking-widest group-hover:text-white">Modo Foco</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
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
      )}

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
          <button
            type="button"
            onClick={() => fetchSuggestions()}
            disabled={loading}
            title="Atualizar lista"
            className="p-2 text-neutral-500 hover:text-indigo-600 dark:text-neutral-400 dark:hover:text-indigo-400 bg-neutral-100 dark:bg-neutral-800 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all flex items-center justify-center disabled:opacity-50 group active:scale-95 duration-200"
          >
            <RefreshCw className={cn("w-4 h-4 transition-transform duration-500 ease-out", loading ? "animate-spin" : "group-hover:rotate-180")} />
          </button>
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
                <p className="text-xs text-neutral-500 line-clamp-3 mb-4 flex-1">
                  {s.description}
                </p>

                {/* Author Info */}
                {s.author && (
                  <div className="flex items-center gap-2 mb-4">
                    <img
                      src={s.author.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${s.author.id}`}
                      alt={s.author.full_name || 'Usuário'}
                      className="w-5 h-5 rounded-full object-cover border border-neutral-200 dark:border-neutral-800"
                    />
                    <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
                      {s.author.full_name || 'Membro'}
                      {s.is_anonymous && (
                        <span className="text-[8px] font-black text-rose-500 uppercase bg-rose-500/10 px-1.5 py-0.5 rounded-full">Anônimo</span>
                      )}
                    </span>
                  </div>
                )}

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

                  <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                    {[1, 2, 3, 4, 5].map(star => {
                      const userStar = s.votes?.find(v => v.user_id === userId && v.type === 'star')?.star_value || 0
                      const isFilled = star <= userStar
                      return (
                        <button
                          key={star}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStar(s.id, star)
                          }}
                          className="focus:outline-none transition-transform hover:scale-120 p-0.5"
                          title={`Avaliar importância: ${star} estrelas`}
                        >
                          <Star className={cn("w-4 h-4 transition-colors", isFilled ? "fill-amber-400 text-amber-400" : "text-neutral-300 dark:text-neutral-700 hover:text-amber-300")} />
                        </button>
                      )
                    })}
                    {s.avgStars !== undefined && s.avgStars > 0 && (
                      <span className="text-[10px] font-black text-amber-500 ml-1">
                        (Média: {s.avgStars.toFixed(1)})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* New Suggestion Modal */}
      <Modal isOpen={showNewModal} onClose={() => setShowNewModal(false)} title="Nova Sugestão" size="2xl">
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
              onPaste={(e) => {
                const items = e.clipboardData?.items
                if (!items) return
                for (const item of Array.from(items)) {
                  if (item.type.startsWith('image/')) {
                    e.preventDefault()
                    const file = item.getAsFile()
                    if (file) {
                      setSuggestionImageFile(file)
                      const reader = new FileReader()
                      reader.onloadend = () => setSuggestionImagePreview(reader.result as string)
                      reader.readAsDataURL(file)
                    }
                    break
                  }
                }
              }}
              placeholder="Explique o que você gostaria que fosse implementado e qual problema isso resolve... (Cole uma imagem com Ctrl+V)"
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
            {/* Suggestion image preview */}
            {suggestionImagePreview && (
              <div className="relative mt-3 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800">
                <img src={suggestionImagePreview} alt="Preview" className="max-h-48 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setSuggestionImageFile(null); setSuggestionImagePreview(null) }}
                  className="absolute top-2 right-2 p-1.5 bg-neutral-950/80 hover:bg-neutral-950 text-white rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <span className="absolute bottom-2 left-2 text-[9px] font-black bg-neutral-900/70 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">🖼️ Imagem colada
                </span>
              </div>
            )}
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
              
              {selectedSuggestion.author && (
                <div className="flex items-center gap-2 mb-4">
                  <img
                    src={selectedSuggestion.author.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${selectedSuggestion.author.id}`}
                    alt={selectedSuggestion.author.full_name || 'Usuário'}
                    className="w-6 h-6 rounded-full object-cover border border-neutral-200 dark:border-neutral-800"
                  />
                  <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
                    Sugerido por <strong className="text-neutral-900 dark:text-white">{selectedSuggestion.author.full_name}</strong>
                    {selectedSuggestion.is_anonymous && (
                      <span className="text-[9px] font-black text-rose-500 uppercase bg-rose-500/10 px-2 py-0.5 rounded-full">Anônimo (Visível apenas para Admin)</span>
                    )}
                  </span>
                </div>
              )}

              <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed bg-neutral-50 dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                {selectedSuggestion.description}
              </p>
              {selectedSuggestion.image_url && (
                <div className="mt-3 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800">
                  <img
                    src={selectedSuggestion.image_url}
                    alt="Imagem anexada à sugestão"
                    className="w-full max-h-72 object-contain bg-neutral-100 dark:bg-neutral-900"
                  />
                </div>
              )}
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
                    {comment.is_admin_response ? (
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center shrink-0 text-xs font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                        AG
                      </div>
                    ) : (
                      <img
                        src={comment.author?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${comment.author?.id || comment.id}`}
                        alt={comment.author?.full_name || 'Membro'}
                        className="w-8 h-8 rounded-full object-cover shrink-0 border border-neutral-200 dark:border-neutral-800"
                      />
                    )}
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
