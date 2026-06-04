import React, { useRef, useEffect } from 'react'
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered,
  Type
} from 'lucide-react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  onInsertVariable?: () => void
  placeholder?: string
  className?: string
  id?: string
}

export default function RichTextEditor({ 
  value, 
  onChange, 
  onInsertVariable,
  placeholder = 'Escreva aqui...',
  className = '',
  id
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)

  // Sincroniza o valor inicial e mudanças externas (mas não refaz se o próprio usuário digitou agora)
  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value || ''
    }
  }, [value])

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  const format = (command: string, arg?: string) => {
    document.execCommand(command, false, arg)
    editorRef.current?.focus()
    handleInput() // Force trigger onChange after formatting
  }

  return (
    <div className={`flex flex-col border border-neutral-300 dark:border-neutral-700 rounded-lg overflow-hidden bg-white dark:bg-neutral-900 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-300 dark:border-neutral-700">
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); format('bold'); }}
          className="p-1.5 text-neutral-600 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
          title="Negrito"
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); format('italic'); }}
          className="p-1.5 text-neutral-600 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
          title="Itálico"
        >
          <Italic size={16} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); format('underline'); }}
          className="p-1.5 text-neutral-600 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
          title="Sublinhado"
        >
          <Underline size={16} />
        </button>
        
        <div className="w-px h-5 bg-neutral-300 dark:bg-neutral-600 mx-1" />
        
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); format('insertUnorderedList'); }}
          className="p-1.5 text-neutral-600 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
          title="Lista com Marcadores"
        >
          <List size={16} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); format('insertOrderedList'); }}
          className="p-1.5 text-neutral-600 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
          title="Lista Numerada"
        >
          <ListOrdered size={16} />
        </button>
      </div>

      {/* Editor Area */}
      <div 
        id={id}
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={handleInput}
        className="flex-1 p-4 outline-none min-h-[150px] text-sm prose dark:prose-invert max-w-none empty:before:content-[attr(data-placeholder)] empty:before:text-neutral-400 focus:ring-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:mb-1 [&_b]:font-bold [&_i]:italic [&_u]:underline [&_p]:my-2"
        data-placeholder={placeholder}
      />
    </div>
  )
}
