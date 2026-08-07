'use client'

// ─── UseCaseCodeEditor ────────────────────────────────────────────────────────
// Modal fullscreen estilo VS Code para edição programática de um caso de uso.
// Integra Monaco Editor com IntelliSense dos tipos do MetaBuilder.

import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  X, Save, Code2, AlertCircle, CheckCircle2, Loader2,
  Copy, RotateCcw, ChevronRight, Database, Layers,
  Braces, Info, Zap, Search
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

import { generateUseCaseCode } from './use-case-code-generator'
import { parseUseCaseCode }    from './use-case-code-parser'
import { WIZARD_CONFIG_DTS }   from './wizard-config-dts'
import type { WizardConfig, Model, UseCaseInitialData } from './types'

// Monaco via dynamic import (evita SSR issues)
import dynamic from 'next/dynamic'
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

// ─── Props ────────────────────────────────────────────────────────────────────

interface UseCaseCodeEditorProps {
  config: WizardConfig
  models: Model[]
  initialData: UseCaseInitialData | undefined
  projectId: string | undefined
  onClose: () => void
  onApply: (newConfig: WizardConfig) => void
}

// ─── Painel de referência — tabs ──────────────────────────────────────────────

type RefTab = 'fields' | 'logic_types' | 'snippets'

const LOGIC_TYPES = [
  { value: 'pesquisa',          label: 'Pesquisa',          desc: 'Somente listagem/grade, sem formulário.' },
  { value: 'cadastro',          label: 'Cadastro',          desc: 'Somente formulário de criação/edição.' },
  { value: 'pesquisa_cadastro', label: 'Pesquisa + Cadastro', desc: 'CRUD completo: lista + formulário.' },
  { value: 'kanban',            label: 'Kanban',            desc: 'Quadro kanban com colunas por campo.' },
  { value: 'analytics',         label: 'Analytics',         desc: 'Dashboard analítico com widgets e gráficos.' },
  { value: 'timeline',          label: 'Linha do Tempo',    desc: 'Eventos ordenados cronologicamente.' },
  { value: 'map',               label: 'Mapa',              desc: 'Registros plotados em mapa com lat/lng.' },
  { value: 'gantt',             label: 'Gantt',             desc: 'Gráfico de Gantt com datas e predecessoras.' },
  { value: 'blueprint',         label: 'Fluxograma',        desc: 'Diagrama de fluxo/blueprint de processos.' },
  { value: 'scheduler',         label: 'Agenda',            desc: 'Calendário/agenda com eventos.' },
  { value: 'master_detail',     label: 'Mestre/Detalhe',    desc: 'Tabela mestre com detalhes em abas.' },
  { value: 'personalizado',     label: 'Personalizado',     desc: 'Layout totalmente livre com abas customizadas.' },
]

const SNIPPETS = [
  {
    label: 'Custom Action (HTTP)',
    desc: 'Botão que chama uma API externa',
    code: `{
  id: "minha_acao",
  label: "Executar",
  icon: "Zap",
  type: "http",
  http_method: "POST",
  http_url: "https://api.exemplo.com/webhook",
  http_body: "{\\"id\\": \\"{{id}}\\"}",
  show_in: "list",
  button_color: "#6366f1",
  confirmation_required: true,
  confirmation_message: "Deseja executar esta ação?"
}`
  },
  {
    label: 'Custom Action (Navegar)',
    desc: 'Botão que navega para outro caso de uso',
    code: `{
  id: "ver_detalhes",
  label: "Ver Detalhes",
  icon: "ExternalLink",
  type: "navigate",
  navigate_to: "/slug-do-destino/{{id}}",
  show_in: "list"
}`
  },
  {
    label: 'Join (Relacionamento)',
    desc: 'Configura um JOIN entre tabelas',
    code: `{
  id: "join_1",
  from: "NOME_TABELA_ORIGEM",
  localKey: "CAMPO_FK",
  to: "NOME_TABELA_DESTINO",
  foreignKey: "ID"
}`
  },
  {
    label: 'Field Metadata',
    desc: 'Personaliza label e componente de um campo',
    code: `"id-do-campo": {
  label: { text: "Meu Label", font: "Inter", size: "sm", color: "#000" },
  content: { font: "Inter", size: "sm", color: "#000", mask: "", required: true, readonly: false },
  component: { type: "text", rows: 1, width: "full", options_type: "fixed", fixed_options: "", rel_table: "", rel_label: "", rel_value: "" }
}`
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function UseCaseCodeEditor({
  config,
  models,
  initialData,
  projectId,
  onClose,
  onApply,
}: UseCaseCodeEditorProps) {
  const { toast } = useToast()
  const supabase = createClient()

  const [code, setCode]             = useState<string>('')
  const [isSaving, setIsSaving]     = useState(false)
  const [parseStatus, setParseStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [parseError, setParseError]   = useState<string>('')
  const [refTab, setRefTab]           = useState<RefTab>('fields')
  const [fieldSearch, setFieldSearch] = useState('')
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null)
  const editorRef = useRef<any>(null)
  const monacoRef = useRef<any>(null)

  // Gera o código inicial quando o componente monta
  useEffect(() => {
    const generated = generateUseCaseCode(config, models)
    setCode(generated)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Valida o código em tempo real (debounced)
  useEffect(() => {
    if (!code) return
    const timer = setTimeout(() => {
      const result = parseUseCaseCode(code)
      if (result.success) {
        setParseStatus('ok')
        setParseError('')
      } else {
        setParseStatus('error')
        setParseError(result.error)
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [code])

  // Configuração do Monaco ao montar
  const handleEditorDidMount = useCallback((editor: any, monaco: any) => {
    editorRef.current  = editor
    monacoRef.current  = monaco

    try {
      // Tema customizado MetaBuilder
      monaco.editor.defineTheme('metabuilder-code-mode', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment',    foreground: '525252', fontStyle: 'italic' },
          { token: 'keyword',    foreground: 'a78bfa' },
          { token: 'string',     foreground: '86efac' },
          { token: 'number',     foreground: 'fb923c' },
          { token: 'identifier', foreground: 'e2e8f0' },
        ],
        colors: {
          'editor.background':              '#09090b',
          'editor.foreground':              '#e2e8f0',
          'editor.lineHighlightBackground': '#18181b',
          'editorLineNumber.foreground':    '#3f3f46',
          'editorLineNumber.activeForeground': '#a1a1aa',
          'editor.selectionBackground':     '#312e81',
          'editorCursor.foreground':        '#818cf8',
          'editor.inactiveSelectionBackground': '#1e1b4b50',
          'editorIndentGuide.background':   '#27272a',
        }
      })
      monaco.editor.setTheme('metabuilder-code-mode')

      // TypeScript settings com JSX
      if (monaco.languages?.typescript) {
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
          jsx: monaco.languages.typescript.JsxEmit.React,
          allowNonTsExtensions: true,
          allowJs: true,
          target: monaco.languages.typescript.ScriptTarget.Latest,
          strict: false,
          noSemanticValidation: false,
        })

        // Injeta os tipos do MetaBuilder para IntelliSense
        monaco.languages.typescript.typescriptDefaults.addExtraLib(
          WIZARD_CONFIG_DTS,
          'file:///metabuilder-types.d.ts'
        )
      }

      // Foco no editor
      editor.focus()
    } catch (err) {
      console.warn('[CodeEditor] Monaco setup error:', err)
    }
  }, [])

  // Formatar com o formatador interno do Monaco
  const handleFormat = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run()
    }
  }, [])

  // Resetar para o código original
  const handleReset = useCallback(() => {
    const original = generateUseCaseCode(config, models)
    setCode(original)
    if (editorRef.current) {
      editorRef.current.setValue(original)
    }
  }, [config, models])

  // Salvar: parse → validar → salvar no banco → aplicar no wizard
  const handleSave = useCallback(async () => {
    const result = parseUseCaseCode(code)
    if (!result.success) {
      toast(`Código inválido: ${result.error}`, 'error')
      return
    }

    setIsSaving(true)
    try {
      // Se há um ID (edição de UC existente), salva draft_config no banco
      if (initialData?.id) {
        const newConfig = result.config
        const draftPayload = {
          name:           newConfig.name,
          slug:           newConfig.slug,
          logic_type:     newConfig.logic_type,
          has_arguments:  newConfig.has_arguments,
          tables_config:  newConfig.selected_models,
          query_type:     newConfig.query_type,
          custom_query:   newConfig.custom_query,
          layout_config:  { ...newConfig.layout_config, is_active: true },
          buttons_config: newConfig.buttons_config,
          model_id:       newConfig.selected_models[0] || null,
          project_id:     projectId,
          view_type:      'advanced_use_case',
        }

        const { error: saveError } = await supabase
          .from('ui_views')
          .update({ draft_config: draftPayload })
          .eq('id', initialData.id)

        if (saveError) throw saveError

        toast('Rascunho salvo via Code Mode! Clique em Publicar para liberar.', 'success')
      } else {
        // UC novo ainda não tem ID: apenas aplica no estado do wizard
        toast('Configuração aplicada! Conclua o wizard e clique em Salvar.', 'success')
      }

      // Sincroniza o estado do wizard com o novo config
      onApply(result.config)
      onClose()
    } catch (err: any) {
      console.error('[CodeEditor] Save error:', err)
      toast('Erro ao salvar: ' + err.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }, [code, initialData, projectId, supabase, toast, onApply, onClose])

  // Copiar snippet para área de transferência
  const handleCopySnippet = useCallback((code: string, label: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedSnippet(label)
      setTimeout(() => setCopiedSnippet(null), 2000)
    })
  }, [])

  // Fechar com Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      // Ctrl+S / Cmd+S → salvar
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, handleSave])

  // Campos filtrados para o painel de referência
  const allFields = models.flatMap(m =>
    (m.fields || []).map(f => ({
      id:    f.id,
      label: f.display_name || f.db_column_name || f.id,
      table: m.display_name || m.db_table_name,
      type:  f.data_type || 'text',
    }))
  )
  const filteredFields = fieldSearch
    ? allFields.filter(f =>
        f.label.toLowerCase().includes(fieldSearch.toLowerCase()) ||
        f.id.toLowerCase().includes(fieldSearch.toLowerCase()) ||
        f.table.toLowerCase().includes(fieldSearch.toLowerCase())
      )
    : allFields

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ zIndex: 9999, background: '#09090b' }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/80 shrink-0"
        style={{ background: 'linear-gradient(to right, #09090b, #18181b)' }}
      >
        {/* Left: branding + UC name */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600/20 border border-indigo-500/30 rounded-lg">
            <Code2 className="w-4 h-4 text-indigo-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
              Code Mode
            </span>
          </div>

          <div className="h-5 w-px bg-zinc-700" />

          <div>
            <p className="text-xs font-bold text-zinc-100 leading-none">
              {config.name || 'Sem nome'}
            </p>
            <p className="text-[9px] text-zinc-500 mt-0.5 font-mono">
              /{config.slug || '...'}
            </p>
          </div>

          <div className="h-5 w-px bg-zinc-700" />

          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[9px] font-mono text-blue-400">
              TypeScript
            </span>
            <span className="px-2 py-0.5 bg-violet-500/10 border border-violet-500/20 rounded text-[9px] font-mono text-violet-400">
              WizardConfig
            </span>
          </div>
        </div>

        {/* Right: status + actions */}
        <div className="flex items-center gap-2">
          {/* Parse status badge */}
          <div className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-bold uppercase tracking-wider transition-all',
            parseStatus === 'ok'    && 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
            parseStatus === 'error' && 'bg-red-500/10 border-red-500/20 text-red-400',
            parseStatus === 'idle'  && 'bg-zinc-800 border-zinc-700 text-zinc-500',
          )}>
            {parseStatus === 'ok'    && <><CheckCircle2 className="w-3 h-3" /> Código válido</>}
            {parseStatus === 'error' && <><AlertCircle  className="w-3 h-3" /> Erro de sintaxe</>}
            {parseStatus === 'idle'  && <><Loader2      className="w-3 h-3 animate-spin" /> Validando...</>}
          </div>

          {/* Format */}
          <button
            onClick={handleFormat}
            title="Formatar código (Shift+Alt+F)"
            className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-all"
          >
            <Braces className="w-3.5 h-3.5" />
          </button>

          {/* Reset */}
          <button
            onClick={handleReset}
            title="Restaurar código original"
            className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/20 border border-zinc-800 rounded-lg transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={isSaving || parseStatus === 'error'}
            title="Salvar rascunho (Ctrl+S)"
            className={cn(
              'flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-lg',
              'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20',
              'disabled:opacity-40 disabled:cursor-not-allowed active:scale-95'
            )}
          >
            {isSaving
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Save    className="w-3.5 h-3.5" />
            }
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            title="Fechar (Esc)"
            className="p-1.5 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-all ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Body: Editor + Reference Panel ─────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Monaco Editor — 60% */}
        <div className="flex-1 min-w-0 relative" style={{ background: '#09090b' }}>
          {/* Linha de status do editor (imitando VS Code) */}
          <div className="absolute bottom-0 left-0 right-0 h-6 flex items-center px-3 gap-4 border-t border-zinc-800/50 z-10"
            style={{ background: '#18181b' }}
          >
            <span className="text-[9px] text-zinc-600 font-mono">TypeScript</span>
            <span className="text-[9px] text-zinc-600 font-mono">UTF-8</span>
            {parseStatus === 'error' && (
              <span className="text-[9px] text-red-400 font-mono flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {parseError.split('\n')[0].slice(0, 60)}
                {parseError.split('\n')[0].length > 60 ? '…' : ''}
              </span>
            )}
            {parseStatus === 'ok' && (
              <span className="text-[9px] text-emerald-500 font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Pronto para salvar (Ctrl+S)
              </span>
            )}
          </div>

          <MonacoEditor
            height="100%"
            language="typescript"
            value={code}
            onChange={(v) => setCode(v || '')}
            theme="vs-dark"
            onMount={handleEditorDidMount}
            options={{
              minimap:               { enabled: true, scale: 0.7 },
              fontSize:              13,
              fontFamily:            "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              fontLigatures:         true,
              wordWrap:              'on',
              scrollBeyondLastLine:  false,
              smoothScrolling:       true,
              cursorBlinking:        'smooth',
              cursorSmoothCaretAnimation: 'on',
              formatOnPaste:         true,
              formatOnType:          false,
              tabSize:               2,
              padding:               { top: 16, bottom: 32 },
              lineNumbers:           'on',
              renderLineHighlight:   'line',
              bracketPairColorization: { enabled: true },
              guides:                { bracketPairs: true, indentation: true },
              suggest:               { showWords: false },
              quickSuggestions:      { strings: true },
              scrollbar: {
                verticalScrollbarSize:   8,
                horizontalScrollbarSize: 8,
              },
            }}
          />
        </div>

        {/* Reference Panel — 40% */}
        <div
          className="w-96 shrink-0 flex flex-col border-l border-zinc-800"
          style={{ background: '#0f0f11' }}
        >
          {/* Tabs */}
          <div className="flex border-b border-zinc-800 shrink-0">
            {[
              { id: 'fields'      as RefTab, label: 'Campos',      icon: Database  },
              { id: 'logic_types' as RefTab, label: 'Lógicas',     icon: Layers    },
              { id: 'snippets'    as RefTab, label: 'Snippets',    icon: Zap       },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setRefTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 text-[9px] font-black uppercase tracking-widest flex-1 transition-all border-b-2',
                  refTab === tab.id
                    ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                )}
              >
                <tab.icon className="w-3 h-3" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">

            {/* ── Campos Tab ── */}
            {refTab === 'fields' && (
              <div className="p-3 space-y-3">
                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-zinc-800/50 border border-zinc-700/50 rounded-lg">
                  <Search className="w-3 h-3 text-zinc-500 shrink-0" />
                  <input
                    value={fieldSearch}
                    onChange={e => setFieldSearch(e.target.value)}
                    placeholder="Buscar campo..."
                    className="flex-1 bg-transparent text-xs text-zinc-300 placeholder-zinc-600 outline-none"
                  />
                </div>

                <p className="text-[9px] text-zinc-600 px-1">
                  Clique no ID para copiar. Use esses IDs nos arrays de campos.
                </p>

                {models.map(model => {
                  const modelFields = filteredFields.filter(f => f.table === (model.display_name || model.db_table_name))
                  if (modelFields.length === 0) return null
                  return (
                    <div key={model.id} className="space-y-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-1 pt-1 flex items-center gap-1">
                        <Database className="w-3 h-3" />
                        {model.display_name || model.db_table_name}
                      </p>
                      {modelFields.map(f => (
                        <button
                          key={f.id}
                          onClick={() => handleCopySnippet(f.id, f.id)}
                          title="Clique para copiar o ID"
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-zinc-800/60 transition-colors group text-left"
                        >
                          <div>
                            <p className="text-[10px] font-semibold text-zinc-300 group-hover:text-zinc-100">
                              {f.label}
                            </p>
                            <p className="text-[9px] font-mono text-zinc-600 group-hover:text-indigo-400 transition-colors">
                              {f.id.slice(0, 36)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <span className="px-1.5 py-0.5 bg-zinc-800 rounded text-[8px] font-mono text-zinc-500">
                              {f.type}
                            </span>
                            {copiedSnippet === f.id
                              ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              : <Copy className="w-3 h-3 text-zinc-700 group-hover:text-zinc-400" />
                            }
                          </div>
                        </button>
                      ))}
                    </div>
                  )
                })}

                {filteredFields.length === 0 && (
                  <p className="text-[10px] text-zinc-600 text-center py-8">
                    Nenhum campo encontrado.
                  </p>
                )}
              </div>
            )}

            {/* ── Logic Types Tab ── */}
            {refTab === 'logic_types' && (
              <div className="p-3 space-y-1.5">
                <p className="text-[9px] text-zinc-600 px-1 mb-3">
                  Valores válidos para o campo <span className="font-mono text-indigo-400">logic_type</span>.
                </p>
                {LOGIC_TYPES.map(lt => (
                  <button
                    key={lt.value}
                    onClick={() => handleCopySnippet(`"${lt.value}"`, lt.value)}
                    className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg hover:bg-zinc-800/60 transition-colors group text-left"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-emerald-400 group-hover:text-emerald-300">
                          &quot;{lt.value}&quot;
                        </span>
                        {config.logic_type === lt.value && (
                          <span className="px-1.5 py-px bg-indigo-500/20 border border-indigo-500/30 rounded text-[8px] text-indigo-400 font-bold">
                            atual
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-semibold text-zinc-300 mt-0.5">{lt.label}</p>
                      <p className="text-[9px] text-zinc-600">{lt.desc}</p>
                    </div>
                    {copiedSnippet === lt.value
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-1 shrink-0" />
                      : <Copy         className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-400 mt-1 shrink-0" />
                    }
                  </button>
                ))}
              </div>
            )}

            {/* ── Snippets Tab ── */}
            {refTab === 'snippets' && (
              <div className="p-3 space-y-3">
                <p className="text-[9px] text-zinc-600 px-1">
                  Clique em copiar e cole no local correto do código.
                </p>
                {SNIPPETS.map(s => (
                  <div key={s.label} className="border border-zinc-800 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-zinc-800/30">
                      <div>
                        <p className="text-[10px] font-bold text-zinc-200">{s.label}</p>
                        <p className="text-[9px] text-zinc-500">{s.desc}</p>
                      </div>
                      <button
                        onClick={() => handleCopySnippet(s.code, s.label)}
                        className="p-1.5 hover:bg-zinc-700 rounded-md transition-colors text-zinc-500 hover:text-zinc-300"
                        title="Copiar snippet"
                      >
                        {copiedSnippet === s.label
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          : <Copy         className="w-3.5 h-3.5" />
                        }
                      </button>
                    </div>
                    <pre className="text-[9px] font-mono text-zinc-400 p-3 overflow-x-auto bg-zinc-900/50 leading-5 whitespace-pre-wrap">
                      {s.code}
                    </pre>
                  </div>
                ))}
              </div>
            )}

          </div>

          {/* Footer do painel */}
          <div className="p-3 border-t border-zinc-800 shrink-0">
            <div className="flex items-start gap-2 px-2.5 py-2 bg-amber-500/5 border border-amber-500/10 rounded-lg">
              <Info className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-[9px] text-zinc-500 leading-relaxed">
                <span className="text-amber-500 font-bold">Ctrl+S</span> salva o rascunho.{' '}
                <span className="text-zinc-400">Publique no wizard para liberar em produção.</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
