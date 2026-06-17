import { useState, useRef } from 'react'

export function useUseCaseMockups() {
  // Stock gauge scroll interaction refs and state
  const estoqueGridRef = useRef<HTMLDivElement>(null)
  const [scrollPercent, setScrollPercent] = useState(0)

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    const maxScroll = target.scrollHeight - target.clientHeight
    if (maxScroll <= 0) return
    setScrollPercent(target.scrollTop / maxScroll)
  }

  const scrollUp = () => {
    estoqueGridRef.current?.scrollBy({ top: -140, behavior: 'smooth' })
  }

  const scrollDown = () => {
    estoqueGridRef.current?.scrollBy({ top: 140, behavior: 'smooth' })
  }

  // Mock states for interactive components
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOnlyQuery, setSearchOnlyQuery] = useState('')
  const [pesquisaCadastroRecords, setPesquisaCadastroRecords] = useState([
    { id: 1, name: 'Ana Souza', email: 'ana.souza@gmail.com', status: 'Ativo' },
    { id: 2, name: 'Bruno Lima', email: 'bruno.lima@yahoo.com', status: 'Inativo' },
    { id: 3, name: 'Carla Dias', email: 'carla.dias@outlook.com', status: 'Ativo' },
  ])
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [recordToDelete, setRecordToDelete] = useState<number | null>(null)
  const [newRecordName, setNewRecordName] = useState('')
  const [newRecordEmail, setNewRecordEmail] = useState('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  
  // Registration Only State
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regSuccess, setRegSuccess] = useState(false)

  // Master Detail Tab State
  const [activeDetailTab, setActiveDetailTab] = useState<'items' | 'payments' | 'logs'>('items')

  // Kanban Tasks State
  const [kanbanTasks, setKanbanTasks] = useState([
    { id: 'k1', title: 'Integração de API', status: 'todo' },
    { id: 'k2', title: 'Revisão de Layout', status: 'inprogress' },
    { id: 'k3', title: 'Testes de RLS', status: 'done' },
  ])
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null)

  // Dashboard simulation state
  const [dashboardPeriod, setDashboardPeriod] = useState<'7d' | '30d' | '12m'>('30d')

  // Calendar / Agenda simulation state
  const [selectedAgendaDay, setSelectedAgendaDay] = useState<number>(21)
  const [agendaEvents, setAgendaEvents] = useState([
    { id: 'ev1', day: 17, time: '14:00', title: 'Entrevista de Engenharia Core', type: 'entrevista' },
    { id: 'ev2', day: 18, time: '09:00', title: 'Reunião Diária (Daily Scrum)', type: 'reunião' },
    { id: 'ev3', day: 18, time: '11:00', title: 'Alinhamento Técnico do Schedu...', type: 'alinhamento' },
    { id: 'ev4', day: 19, time: '10:00', title: 'Revisão Trimestral de Metas (QBR)', type: 'reunião' },
    { id: 'ev5', day: 19, time: '14:30', title: 'Sessão de UI/UX feedback com...', type: 'design' },
    { id: 'ev6', day: 22, time: '16:00', title: 'Manutenção Preventiva de Banc...', type: 'infra' },
    { id: 'ev7', day: 23, time: '11:00', title: 'Brainstorming de Novos Recurs...', type: 'reunião' },
  ])

  // Custom SQL State
  const [sqlQuery, setSqlQuery] = useState('SELECT p.id, p.name, count(o.id) FROM products p...')
  const [isSqlRunning, setIsSqlRunning] = useState(false)
  const [sqlResults, setSqlResults] = useState<any[]>([])
  const [isMindMapExpanded, setIsMindMapExpanded] = useState(false)
  const [isFinanceExpanded, setIsFinanceExpanded] = useState(false)
  const [isSalesExpanded, setIsSalesExpanded] = useState(false)
  const [isHrExpanded, setIsHrExpanded] = useState(false)

  // Galeria simulation state
  const [customHybridTab, setCustomHybridTab] = useState<'metrics' | 'kanban' | 'history'>('metrics')
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'image' | 'pdf'>('all')
  const [gallerySearchQuery, setGallerySearchQuery] = useState('')
  const [selectedAssetPreview, setSelectedAssetPreview] = useState<any | null>(null)
  const [galleryAssets, setGalleryAssets] = useState([
    {
      id: 1,
      title: 'Comprovante de Assinatura',
      fileName: 'comprovante_asaas_maio.pdf',
      type: 'pdf',
      size: '2.4 MB',
      updatedAt: '21/05/2026',
      url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&auto=format&fit=crop&q=60',
      downloadUrl: '#',
      externalUrl: 'https://www.asaas.com',
      category: 'pdf'
    },
    {
      id: 2,
      title: 'Logo da Empresa (Dark)',
      fileName: 'logo_corporativo_dark.png',
      type: 'image',
      size: '850 KB',
      updatedAt: '20/05/2026',
      url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=60',
      downloadUrl: '#',
      externalUrl: 'https://github.com',
      category: 'image'
    },
    {
      id: 3,
      title: 'Contrato Social Registrado',
      fileName: 'contrato_social_agtech_consolidado.pdf',
      type: 'pdf',
      size: '4.1 MB',
      updatedAt: '18/05/2026',
      url: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=400&auto=format&fit=crop&q=60',
      downloadUrl: '#',
      externalUrl: 'https://google.com',
      category: 'pdf'
    },
    {
      id: 4,
      title: 'Mockup de UI Dashboard',
      fileName: 'dashboard_redesign_v3.jpg',
      type: 'image',
      size: '1.2 MB',
      updatedAt: '15/05/2026',
      url: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=400&auto=format&fit=crop&q=60',
      downloadUrl: '#',
      externalUrl: 'https://figma.com',
      category: 'image'
    }
  ])

  const filteredGalleryAssets = galleryAssets.filter(asset => {
    const matchesFilter = galleryFilter === 'all' || asset.type === galleryFilter
    const matchesSearch = asset.title.toLowerCase().includes(gallerySearchQuery.toLowerCase()) || 
                          asset.fileName.toLowerCase().includes(gallerySearchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const triggerToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleAddRecord = (e: React.FormEvent, t: any) => {
    e.preventDefault()
    if (!newRecordName || !newRecordEmail) return
    const newRec = {
      id: Date.now(),
      name: newRecordName,
      email: newRecordEmail,
      status: 'Ativo'
    }
    setPesquisaCadastroRecords([...pesquisaCadastroRecords, newRec])
    setNewRecordName('')
    setNewRecordEmail('')
    setIsDrawerOpen(false)
    triggerToast(t('runtime.create_success'))
  }

  const handleDeleteRecord = (id: number, t: any) => {
    setPesquisaCadastroRecords(pesquisaCadastroRecords.filter(r => r.id !== id))
    triggerToast(t('runtime.delete_success'))
  }

  const handleRegSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!regName || !regEmail) return
    setRegSuccess(true)
    setTimeout(() => {
      setRegSuccess(false)
      setRegName('')
      setRegEmail('')
    }, 4000)
  }

  const handleKanbanDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleKanbanDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault()
    setDraggedOverColumn(status)
  }

  const handleKanbanDragLeave = () => {
    setDraggedOverColumn(null)
  }

  const handleKanbanDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault()
    setDraggedOverColumn(null)
    const id = e.dataTransfer.getData('text/plain')
    if (!id) return
    setKanbanTasks(prev => prev.map(t => {
      if (t.id === id) {
        return { ...t, status: targetStatus }
      }
      return t
    }))
    triggerToast('Tarefa movida com sucesso!')
  }

  const runCustomQuery = () => {
    setIsSqlRunning(true)
    setTimeout(() => {
      setSqlResults([
        { id: 101, name: 'Licença Enterprise', count: 12 },
        { id: 102, name: 'Suporte Premium 24/7', count: 4 },
        { id: 103, name: 'Consultoria de Migração', count: 7 },
      ])
      setIsSqlRunning(false)
    }, 800)
  }

  // Filtered lists for simulation
  const filteredPesquisaCadastro = pesquisaCadastroRecords.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const searchOnlyRecords = [
    { code: 'MB-892', description: 'Servidor VPS Cloud', region: 'SP-East', usage: '84%' },
    { code: 'MB-412', description: 'Banco de Dados SSD', region: 'RJ-South', usage: '21%' },
    { code: 'MB-301', description: 'Load Balancer Edge', region: 'BH-Central', usage: '92%' },
    { code: 'MB-112', description: 'Firewall NGFW Local', region: 'PR-South', usage: '48%' },
  ]
  const filteredSearchOnly = searchOnlyRecords.filter(r => 
    r.description.toLowerCase().includes(searchOnlyQuery.toLowerCase()) ||
    r.code.toLowerCase().includes(searchOnlyQuery.toLowerCase())
  )

  return {
    estoqueGridRef,
    scrollPercent,
    handleScroll,
    scrollUp,
    scrollDown,
    searchQuery,
    setSearchQuery,
    searchOnlyQuery,
    setSearchOnlyQuery,
    pesquisaCadastroRecords,
    isDrawerOpen,
    setIsDrawerOpen,
    recordToDelete,
    setRecordToDelete,
    newRecordName,
    setNewRecordName,
    newRecordEmail,
    setNewRecordEmail,
    toastMessage,
    triggerToast,
    regName,
    setRegName,
    regEmail,
    setRegEmail,
    regSuccess,
    activeDetailTab,
    setActiveDetailTab,
    kanbanTasks,
    setKanbanTasks,
    draggedOverColumn,
    dashboardPeriod,
    setDashboardPeriod,
    selectedAgendaDay,
    setSelectedAgendaDay,
    agendaEvents,
    setAgendaEvents,
    sqlQuery,
    setSqlQuery,
    isSqlRunning,
    sqlResults,
    isMindMapExpanded,
    setIsMindMapExpanded,
    isFinanceExpanded,
    setIsFinanceExpanded,
    isSalesExpanded,
    setIsSalesExpanded,
    isHrExpanded,
    setIsHrExpanded,
    customHybridTab,
    setCustomHybridTab,
    galleryFilter,
    setGalleryFilter,
    gallerySearchQuery,
    setGallerySearchQuery,
    selectedAssetPreview,
    setSelectedAssetPreview,
    galleryAssets,
    filteredGalleryAssets,
    handleAddRecord,
    handleDeleteRecord,
    handleRegSubmit,
    handleKanbanDragStart,
    handleKanbanDragOver,
    handleKanbanDragLeave,
    handleKanbanDrop,
    runCustomQuery,
    filteredPesquisaCadastro,
    searchOnlyRecords,
    filteredSearchOnly,
  }
}
