'use client'

import React, { useRef } from 'react'
import Editor from '@monaco-editor/react'

export interface ByocEditorProps {
  value: string
  onChange: (value: string | undefined) => void
  language?: string
  height?: string
}

export function ByocEditor({ value, onChange, language = 'typescript', height = '500px' }: ByocEditorProps) {
  const editorRef = useRef<any>(null)

  function handleEditorDidMount(editor: any, monaco: any) {
    editorRef.current = editor

    try {
      // Define custom theme
      monaco.editor.defineTheme('metabuilder-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#0a0a0a',
          'editor.lineHighlightBackground': '#171717',
          'editorLineNumber.foreground': '#525252',
          'editor.selectionBackground': '#262626',
        }
      })

      monaco.editor.setTheme('metabuilder-dark')
      
      // Add TypeScript compiler options to allow React syntax
      if (monaco.languages && monaco.languages.typescript) {
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
          jsx: monaco.languages.typescript.JsxEmit.React,
          jsxFactory: 'React.createElement',
          reactNamespace: 'React',
          allowNonTsExtensions: true,
          allowJs: true,
          target: monaco.languages.typescript.ScriptTarget.Latest,
        })
      }
    } catch (err) {
      console.warn('Monaco configuration error:', err)
    }
  }

  return (
    <div className="w-full h-full rounded-md overflow-hidden border border-neutral-800">
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={onChange}
        theme="vs-dark" // fallback before onMount
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: true, scale: 0.75 },
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          formatOnPaste: true,
          padding: { top: 16, bottom: 16 },
        }}
      />
    </div>
  )
}
