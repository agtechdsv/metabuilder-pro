/**
 * ideUtils.ts
 *
 * Configurações utilitárias compartilhadas entre os componentes da IDE Local.
 */

export const getLanguageFromPath = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  switch (ext) {
    case 'java': return 'java'
    case 'xml': return 'xml'
    case 'properties': return 'properties'
    case 'sql': return 'sql'
    case 'ts':
    case 'tsx': return 'typescript'
    case 'json': return 'json'
    case 'css': return 'css'
    default: return 'javascript'
  }
}

let javaSnippetsRegistered = false

export const registerJavaSnippets = (monaco: any) => {
  if (javaSnippetsRegistered) return
  javaSnippetsRegistered = true

  monaco.languages.registerCompletionItemProvider('java', {
    provideCompletionItems: (model: any, position: any) => {
      const suggestions = [
        // Spring Boot Annotations
        { label: '@RestController', insertText: '@RestController' },
        { label: '@RequestMapping', insertText: '@RequestMapping("${1:/api}")' },
        { label: '@GetMapping', insertText: '@GetMapping("${1:/path}")' },
        { label: '@PostMapping', insertText: '@PostMapping("${1:/path}")' },
        { label: '@PutMapping', insertText: '@PutMapping("${1:/path}")' },
        { label: '@DeleteMapping', insertText: '@DeleteMapping("${1:/path}")' },
        { label: '@Autowired', insertText: '@Autowired' },
        { label: '@Service', insertText: '@Service' },
        { label: '@Repository', insertText: '@Repository' },
        { label: '@Component', insertText: '@Component' },
        
        // JPA Annotations
        { label: '@Entity', insertText: '@Entity' },
        { label: '@Table', insertText: '@Table(name = "${1:table_name}")' },
        { label: '@Id', insertText: '@Id' },
        { label: '@GeneratedValue', insertText: '@GeneratedValue(strategy = GenerationType.IDENTITY)' },
        { label: '@Column', insertText: '@Column(name = "${1:column_name}")' },
        { label: '@ManyToOne', insertText: '@ManyToOne(fetch = FetchType.LAZY)' },
        { label: '@OneToMany', insertText: '@OneToMany(mappedBy = "${1:field}", cascade = CascadeType.ALL, orphanRemoval = true)' },
        { label: '@JoinColumn', insertText: '@JoinColumn(name = "${1:column_id}")' },
        
        // Lombok & Jackson
        { label: '@Data', insertText: '@Data' },
        { label: '@JsonIgnore', insertText: '@JsonIgnore' },

        // Common Types
        { label: 'String', insertText: 'String' },
        { label: 'List', insertText: 'List<${1:Type}>' },
        { label: 'ArrayList', insertText: 'ArrayList<>()' },
        { label: 'UUID', insertText: 'UUID' },
        { label: 'LocalDateTime', insertText: 'LocalDateTime' },
        { label: 'OffsetDateTime', insertText: 'OffsetDateTime' },
        { label: 'BigDecimal', insertText: 'BigDecimal' },
        { label: 'ResponseEntity', insertText: 'ResponseEntity<${1:Type}>' }
      ].map(s => ({
        label: s.label,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: s.insertText,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
      }))

      return { suggestions }
    }
  })
}

export const handleMonacoBeforeMount = (monaco: any) => {
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.Latest,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.CommonJS,
    noEmit: true,
    esModuleInterop: true,
    jsx: monaco.languages.typescript.JsxEmit.Preserve,
    reactNamespace: 'React',
    allowJs: true,
  });

  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: false,
  });

  registerJavaSnippets(monaco)
}
