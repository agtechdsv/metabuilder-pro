/**
 * entityParser.ts
 *
 * Parser leve e inteligente de Entidades Java JPA para alimentar
 * autocompletes e snippets de DTOs, Records e Mappers no Monaco Editor.
 */

export interface EntityField {
  name: string
  type: string
  isId?: boolean
}

export interface EntityCacheInfo {
  className: string
  fields: EntityField[]
  packageName?: string
  fullPath?: string
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Localiza uma entidade no cache com base no nome do tipo ou nome da variável.
 * Ex: "ClientesEntity" -> Clientes
 * Ex: "cliente" -> Clientes
 * Ex: "clientesRepository" -> Clientes
 */
export function findEntityByNameOrVariable(nameOrVar: string): EntityCacheInfo | undefined {
  if (!nameOrVar) return undefined

  // 1. Busca exata
  if (entityCache.has(nameOrVar)) {
    return entityCache.get(nameOrVar)
  }

  // 2. Remove sufixos comuns de arquitetura
  const clean = nameOrVar.replace(/(?:Entity|DTO|Dto|Record|Repository|Service)$/, '')
  if (entityCache.has(clean)) {
    return entityCache.get(clean)
  }

  // 3. Busca insensível a maiúsculas/minúsculas e variações plural/singular
  const target = clean.toLowerCase()
  for (const [key, val] of entityCache.entries()) {
    const keyClean = key.replace(/Entity$/, '')
    const keyLower = keyClean.toLowerCase()
    if (keyLower === target) return val
    if (keyLower.startsWith(target) || target.startsWith(keyLower)) return val
    // Plural/singular simples: 'clientes' vs 'cliente'
    if (keyLower.replace(/s$/, '') === target.replace(/s$/, '')) return val
  }

  return undefined
}

/**
 * Gera métodos dinâmicos de instância (getters, setters e utilitários) para uma Entidade
 */
export function generateEntityInstanceMethods(entity: EntityCacheInfo): { label: string, insertText: string, isSnippet?: boolean, kind?: 'Method' | 'Field', detail: string }[] {
  const methods: { label: string, insertText: string, isSnippet?: boolean, kind?: 'Method' | 'Field', detail: string }[] = []
  const seenLabels = new Set<string>()

  entity.fields.forEach(f => {
    const cap = capitalize(f.name)
    const getterLabel = `get${cap}()`
    if (!seenLabels.has(getterLabel)) {
      seenLabels.add(getterLabel)
      methods.push({
        label: getterLabel,
        insertText: `get${cap}()`,
        kind: 'Method',
        detail: `${f.type} get${cap}() - Obtém ${f.name}`
      })
    }

    const setterLabel = `set${cap}(${f.name})`
    if (!seenLabels.has(setterLabel)) {
      seenLabels.add(setterLabel)
      methods.push({
        label: setterLabel,
        insertText: `set${cap}(\${1:${f.name}})`,
        isSnippet: true,
        kind: 'Method',
        detail: `void set${cap}(${f.type} ${f.name}) - Define ${f.name}`
      })
    }
  })

  // Utilitários canônicos de Entidade
  if (!seenLabels.has('getId()')) {
    methods.unshift({
      label: 'getId()',
      insertText: 'getId()',
      kind: 'Method',
      detail: 'Obtém a chave primária da entidade'
    })
  }

  methods.push(
    { label: 'toString()', insertText: 'toString()', kind: 'Method', detail: 'String: Representação textual da entidade' },
    { label: 'equals(obj)', insertText: 'equals(${1:obj})', isSnippet: true, kind: 'Method', detail: 'boolean: Compara igualdade' },
    { label: 'hashCode()', insertText: 'hashCode()', kind: 'Method', detail: 'int: Código hash da entidade' }
  )

  return methods
}

/**
 * Faz o parse do código-fonte de uma classe @Entity Java e extrai os campos
 */
export function parseEntitySource(source: string, className: string, fullPath?: string): EntityCacheInfo {
  const fields: EntityField[] = []
  
  // Extrai pacote
  const pkgMatch = source.match(/^\s*package\s+([a-zA-Z0-9_.]+)\s*;/m)
  const packageName = pkgMatch ? pkgMatch[1] : ''

  // Regex para capturar declarações de atributos privados
  // Suporta anotações na linha anterior ou na mesma linha
  // Ignora serialVersionUID e campos static/final
  const lines = source.split('\n')
  const fieldRegex = /^\s*(?:@[\w()="',\s.]+\s+)*private\s+(?!static|final\b)([A-Za-z0-9_<>[\]]+)\s+([A-Za-z0-9_]+)\s*;/

  let isNextFieldId = false

  for (const line of lines) {
    if (line.includes('@Id')) {
      isNextFieldId = true
    }

    const match = line.match(fieldRegex)
    if (match) {
      const type = match[1]
      const name = match[2]
      if (name !== 'serialVersionUID') {
        fields.push({
          type,
          name,
          isId: isNextFieldId || line.includes('@Id') || name.toLowerCase() === 'id'
        })
      }
      isNextFieldId = false
    }
  }

  return {
    className,
    fields,
    packageName,
    fullPath
  }
}

// Cache em memória de entidades indexadas: Map<NomeDaClasse, EntityCacheInfo>
const entityCache = new Map<string, EntityCacheInfo>()

// Mapa de caminhos de arquivos de entidades: Map<NomeDaClasse, CaminhoDoArquivo>
const entityPathMap = new Map<string, string>()

export function registerEntityPath(className: string, fullPath: string) {
  entityPathMap.set(className, fullPath)
}

export function updateEntityCache(className: string, info: EntityCacheInfo) {
  entityCache.set(className, info)
}

export function getCachedEntity(className: string): EntityCacheInfo | undefined {
  return entityCache.get(className)
}

export function getEntityPath(className: string): string | undefined {
  return entityPathMap.get(className)
}

export function getAllCachedEntities(): EntityCacheInfo[] {
  return Array.from(entityCache.values())
}

/**
 * Tenta encontrar uma entidade correspondente a partir do nome do arquivo atual.
 * Exemplo: "ClientesDTO.java" -> "Clientes"
 *          "ClientesRecord.java" -> "Clientes"
 *          "ClientesService.java" -> "Clientes"
 */
export function resolveEntityNameFromFilename(filename: string): string | null {
  const cleanName = filename.replace(/\.java$/, '')
  
  // Tenta remover sufixos comuns de arquitetura
  const suffixes = ['DTO', 'Dto', 'Record', 'Request', 'Response', 'Mapper', 'Service', 'Controller', 'Repository']
  for (const suffix of suffixes) {
    if (cleanName.endsWith(suffix) && cleanName.length > suffix.length) {
      const base = cleanName.substring(0, cleanName.length - suffix.length)
      if (entityCache.has(base) || entityPathMap.has(base)) {
        return base
      }
    }
  }

  // Se o próprio nome corresponder a uma entidade existente
  if (entityCache.has(cleanName) || entityPathMap.has(cleanName)) {
    return cleanName
  }

  return null
}

/**
 * Gera as sugestões inteligentes do Monaco Editor baseadas na entidade
 */
export function generateEntityContextSuggestions(
  filename: string,
  entityInfo: EntityCacheInfo,
  range: { startLineNumber: number, endLineNumber: number, startColumn: number, endColumn: number },
  monaco: any
): any[] {
  const { className, fields } = entityInfo
  const baseName = className.replace(/Entity$/, '')
  const suggestions: any[] = []

  if (fields.length === 0) return suggestions

  const isDtoOrRecord = filename.endsWith('DTO.java') || filename.endsWith('Dto.java') || filename.endsWith('Record.java')
  const isService = filename.endsWith('Service.java')

  // ==========================================
  // CASO 1: DTO / Record
  // ==========================================
  if (isDtoOrRecord) {
    // 1.1 Gerar Record completo com método estático fromEntity (Java 21)
    const recordParams = fields.map(f => `${f.type} ${f.name}`).join(', ')
    const fromEntityMappings = fields.map(f => `            entity.get${capitalize(f.name)}()`).join(',\n')

    const recordTemplate = `public record ${baseName}DTO(${recordParams}) {\n` +
      `    public static ${baseName}DTO fromEntity(${className} entity) {\n` +
      `        return new ${baseName}DTO(\n` +
      `${fromEntityMappings}\n` +
      `        );\n` +
      `    }\n` +
      `}`

    suggestions.push({
      label: 'generate-record-from-entity',
      kind: monaco.languages.CompletionItemKind.Snippet,
      detail: `Java 21: Gera Record DTO completo a partir de ${className}`,
      documentation: `Gera assinatura de record com todos os campos de ${className} e o método estático fromEntity()`,
      insertText: recordTemplate,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range
    })

    // 1.2 Gerar método estático fromEntity() isolado
    const methodOnlyTemplate = `public static ${baseName}DTO fromEntity(${className} entity) {\n` +
      `    return new ${baseName}DTO(\n` +
      `${fromEntityMappings}\n` +
      `    );\n` +
      `}`

    suggestions.push({
      label: 'fromEntity',
      kind: monaco.languages.CompletionItemKind.Method,
      detail: `Método fábrica fromEntity(${className} entity)`,
      documentation: `Converte a entidade ${className} no DTO correspondente`,
      insertText: methodOnlyTemplate,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range
    })

    // 1.3 Gerar todos os campos privados (DTO tradicional com Lombok)
    const allFieldsTemplate = fields.map(f => `    private ${f.type} ${f.name};`).join('\n')
    suggestions.push({
      label: 'generate-all-fields-from-entity',
      kind: monaco.languages.CompletionItemKind.Snippet,
      detail: `Gera todos os ${fields.length} atributos da entidade ${className}`,
      insertText: allFieldsTemplate,
      range
    })

    // 1.4 Sugestões campo a campo individuais
    fields.forEach(f => {
      suggestions.push({
        label: `field-${f.name}`,
        kind: monaco.languages.CompletionItemKind.Field,
        detail: `Atributo de ${className}: ${f.type} ${f.name}`,
        insertText: `private ${f.type} ${f.name};`,
        range
      })
    })
  }

  // ==========================================
  // CASO 2: Service
  // ==========================================
  if (isService) {
    const dtoVarName = `${baseName.toLowerCase()}DTO`
    const entityVarName = `${baseName.toLowerCase()}`

    // 2.1 Mapeamento de DTO para Entidade para persistência
    const nonIdFields = fields.filter(f => !f.isId)
    const settersBlock = (nonIdFields.length > 0 ? nonIdFields : fields)
      .map(f => `        ${entityVarName}.set${capitalize(f.name)}(${dtoVarName}.${f.name}());`)
      .join('\n')

    const toEntityTemplate = `var ${entityVarName} = new ${className}();\n` +
      `${settersBlock}\n` +
      `        \${0}`

    suggestions.push({
      label: 'map-dto-to-entity',
      kind: monaco.languages.CompletionItemKind.Snippet,
      detail: `Gera instanciação e setters de ${className} a partir de ${dtoVarName}`,
      insertText: toEntityTemplate,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range
    })

    // 2.2 Conversão de Lista de Entidades para Lista de DTOs via Stream (Java 21 .toList())
    const listStreamTemplate = `\${1:${entityVarName}List}.stream()\n` +
      `    .map(${baseName}DTO::fromEntity)\n` +
      `    .toList();`

    suggestions.push({
      label: 'toDTOList',
      kind: monaco.languages.CompletionItemKind.Snippet,
      detail: `Java 21: Stream .map(${baseName}DTO::fromEntity).toList()`,
      insertText: listStreamTemplate,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range
    })
  }

  // ==========================================
  // CASO 3: Pattern Matching for switch (Java 21)
  // ==========================================
  const recordPatternTemplate = `switch (\${1:dto}) {\n` +
    `    case ${baseName}DTO(${fields.map(f => `var ${f.name}`).join(', ')}) -> {\n` +
    `        \${2:// Lógica com campos desestruturados}\n` +
    `    }\n` +
    `    default -> throw new IllegalArgumentException("DTO inválido");\n` +
    `}`

  suggestions.push({
    label: 'switch-record-pattern',
    kind: monaco.languages.CompletionItemKind.Snippet,
    detail: `Java 21: Pattern Matching no switch desestruturando ${baseName}DTO`,
    insertText: recordPatternTemplate,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    range
  })

  return suggestions
}
