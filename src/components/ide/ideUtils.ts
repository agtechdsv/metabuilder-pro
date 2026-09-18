/**
 * ideUtils.ts
 *
 * Configurações utilitárias compartilhadas entre os componentes da IDE Local.
 */

import {
  getCachedEntity,
  resolveEntityNameFromFilename,
  generateEntityContextSuggestions,
  findEntityByNameOrVariable,
  generateEntityInstanceMethods,
} from './entityParser'

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

export interface JavaClassInfo {
  name: string
  packageName?: string
  fullPath?: string
}

let javaClasses: JavaClassInfo[] = []

export const updateJavaClasses = (classes: (string | JavaClassInfo)[]) => {
  javaClasses = classes.map(c => typeof c === 'string' ? { name: c } : c)
}

export const STANDARD_JAVA_IMPORTS: Record<string, string> = {
  // Lombok
  '@RequiredArgsConstructor': 'lombok.RequiredArgsConstructor',
  '@Data': 'lombok.Data',

  // Spring Web Annotations
  '@PathVariable': 'org.springframework.web.bind.annotation.PathVariable',
  '@RequestParam': 'org.springframework.web.bind.annotation.RequestParam',
  '@RequestBody': 'org.springframework.web.bind.annotation.RequestBody',
  '@RestController': 'org.springframework.web.bind.annotation.RestController',
  '@RequestMapping': 'org.springframework.web.bind.annotation.RequestMapping',
  '@GetMapping': 'org.springframework.web.bind.annotation.GetMapping',
  '@PostMapping': 'org.springframework.web.bind.annotation.PostMapping',
  '@PutMapping': 'org.springframework.web.bind.annotation.PutMapping',
  '@DeleteMapping': 'org.springframework.web.bind.annotation.DeleteMapping',
  '@RestControllerAdvice': 'org.springframework.web.bind.annotation.RestControllerAdvice',
  '@ExceptionHandler': 'org.springframework.web.bind.annotation.ExceptionHandler',
  '@ResponseStatus': 'org.springframework.web.bind.annotation.ResponseStatus',

  // Spring Core / Stereotypes
  '@Autowired': 'org.springframework.beans.factory.annotation.Autowired',
  '@Service': 'org.springframework.stereotype.Service',
  '@Repository': 'org.springframework.stereotype.Repository',
  '@Component': 'org.springframework.stereotype.Component',

  // Spring Security
  '@PreAuthorize': 'org.springframework.security.access.prepost.PreAuthorize',

  // Jakarta Validation
  '@Valid': 'jakarta.validation.Valid',
  '@NotNull': 'jakarta.validation.constraints.NotNull',
  '@NotEmpty': 'jakarta.validation.constraints.NotEmpty',
  '@NotBlank': 'jakarta.validation.constraints.NotBlank',
  '@Size': 'jakarta.validation.constraints.Size',
  '@Min': 'jakarta.validation.constraints.Min',
  '@Max': 'jakarta.validation.constraints.Max',
  '@Email': 'jakarta.validation.constraints.Email',

  // JPA Persistence
  '@Entity': 'jakarta.persistence.Entity',
  '@Table': 'jakarta.persistence.Table',
  '@Id': 'jakarta.persistence.Id',
  '@GeneratedValue': 'jakarta.persistence.GeneratedValue',
  '@Column': 'jakarta.persistence.Column',
  '@ManyToOne': 'jakarta.persistence.ManyToOne',
  '@OneToMany': 'jakarta.persistence.OneToMany',
  '@JoinColumn': 'jakarta.persistence.JoinColumn',

  // Jackson
  '@JsonIgnore': 'com.fasterxml.jackson.annotation.JsonIgnore',

  // Wrappers & Types
  'Optional': 'java.util.Optional',
  'ResponseEntity': 'org.springframework.http.ResponseEntity',
  'HttpEntity': 'org.springframework.http.HttpEntity',
  'RequestEntity': 'org.springframework.http.RequestEntity',
  'UUID': 'java.util.UUID',
  'List': 'java.util.List',
  'ArrayList': 'java.util.ArrayList',
  'Map': 'java.util.Map',
  'HashMap': 'java.util.HashMap',
  'Set': 'java.util.Set',
  'HashSet': 'java.util.HashSet',
  'Collectors': 'java.util.stream.Collectors',
  'Arrays': 'java.util.Arrays',
  'Collections': 'java.util.Collections',
  'BigDecimal': 'java.math.BigDecimal',
  'LocalDateTime': 'java.time.LocalDateTime',
  'OffsetDateTime': 'java.time.OffsetDateTime',

  // Spring Transactions
  '@Transactional': 'org.springframework.transaction.annotation.Transactional',
  'Transactional': 'org.springframework.transaction.annotation.Transactional',

  // Spring Data Domain
  'Page': 'org.springframework.data.domain.Page',
  'Pageable': 'org.springframework.data.domain.Pageable',
  'PageRequest': 'org.springframework.data.domain.PageRequest',
  'Sort': 'org.springframework.data.domain.Sort',

  // Spring Exceptions & HTTP
  'DataIntegrityViolationException': 'org.springframework.dao.DataIntegrityViolationException',
  'EntityNotFoundException': 'jakarta.persistence.EntityNotFoundException',
  'ResponseStatusException': 'org.springframework.web.server.ResponseStatusException',
  'HttpStatus': 'org.springframework.http.HttpStatus',
}

export const getAutoImportEdit = (
  model: any,
  importTarget: string
): { range: { startLineNumber: number, startColumn: number, endLineNumber: number, endColumn: number }, text: string }[] | undefined => {
  if (!importTarget) return undefined
  if (importTarget.startsWith('java.lang.')) return undefined

  const fullText = model.getValue()
  const pkgPart = importTarget.substring(0, importTarget.lastIndexOf('.'))

  const escapedTarget = importTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedPkg = pkgPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const hasExactImport = new RegExp(`^\\s*import\\s+${escapedTarget}\\s*;`, 'm').test(fullText)
  const hasWildcardImport = new RegExp(`^\\s*import\\s+${escapedPkg}\\.\\*\\s*;`, 'm').test(fullText)

  if (hasExactImport || hasWildcardImport) {
    return undefined
  }

  // Se pertencer ao mesmo pacote do arquivo atual
  const currentPkgMatch = fullText.match(/^\s*package\s+([a-zA-Z0-9_.]+)\s*;/m)
  const currentPkg = currentPkgMatch ? currentPkgMatch[1] : ''
  if (currentPkg && currentPkg === pkgPart) {
    return undefined
  }

  const lines = model.getLinesContent()
  let targetLine = -1

  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^\s*import\s+/.test(lines[i])) {
      targetLine = i + 1
      break
    }
  }

  if (targetLine !== -1) {
    return [{
      range: {
        startLineNumber: targetLine + 1,
        startColumn: 1,
        endLineNumber: targetLine + 1,
        endColumn: 1
      },
      text: `import ${importTarget};\n`
    }]
  }

  for (let i = 0; i < lines.length; i++) {
    if (/^\s*package\s+/.test(lines[i])) {
      targetLine = i + 1
      break
    }
  }

  if (targetLine !== -1) {
    return [{
      range: {
        startLineNumber: targetLine + 1,
        startColumn: 1,
        endLineNumber: targetLine + 1,
        endColumn: 1
      },
      text: `\nimport ${importTarget};\n`
    }]
  }

  return [{
    range: {
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 1
    },
    text: `import ${importTarget};\n\n`
  }]
}

let javaSnippetsRegistered = false

const WRAPPER_DOT_SUGGESTIONS: Record<string, { label: string, insertText: string, isSnippet?: boolean, kind?: 'Method' | 'Field', detail?: string }[]> = {
  Integer: [
    { label: 'valueOf', insertText: 'valueOf(${1:s})', isSnippet: true, detail: 'Integer.valueOf(String/int) - Instância com cache' },
    { label: 'parseInt', insertText: 'parseInt(${1:s})', isSnippet: true, detail: 'Integer.parseInt(String) - int primitivo' },
    { label: 'toString', insertText: 'toString(${1:i})', isSnippet: true, detail: 'Integer.toString(int) - Converte para String' },
    { label: 'compare', insertText: 'compare(${1:x}, ${2:y})', isSnippet: true, detail: 'Integer.compare(x, y) - Compara numericamente' },
    { label: 'max', insertText: 'max(${1:a}, ${2:b})', isSnippet: true, detail: 'Integer.max(a, b) - Maior valor (Streams/Lambda)' },
    { label: 'min', insertText: 'min(${1:a}, ${2:b})', isSnippet: true, detail: 'Integer.min(a, b) - Menor valor (Streams/Lambda)' },
    { label: 'sum', insertText: 'sum(${1:a}, ${2:b})', isSnippet: true, detail: 'Integer.sum(a, b) - Soma (Streams/Lambda: Integer::sum)' },
    { label: 'hashCode', insertText: 'hashCode(${1:value})', isSnippet: true, detail: 'Integer.hashCode(value) - Hash estático' },
    { label: 'MAX_VALUE', insertText: 'MAX_VALUE', kind: 'Field', detail: '2^31 - 1 (2.147.483.647)' },
    { label: 'MIN_VALUE', insertText: 'MIN_VALUE', kind: 'Field', detail: '-2^31 (-2.147.483.648)' },
    { label: 'BYTES', insertText: 'BYTES', kind: 'Field', detail: 'Tamanho: 4 bytes' },
    { label: 'SIZE', insertText: 'SIZE', kind: 'Field', detail: 'Tamanho: 32 bits' },
  ],
  Long: [
    { label: 'valueOf', insertText: 'valueOf(${1:s})', isSnippet: true, detail: 'Long.valueOf(String/long) - Instância com cache' },
    { label: 'parseLong', insertText: 'parseLong(${1:s})', isSnippet: true, detail: 'Long.parseLong(String) - long primitivo' },
    { label: 'toString', insertText: 'toString(${1:l})', isSnippet: true, detail: 'Long.toString(long) - Converte para String' },
    { label: 'compare', insertText: 'compare(${1:x}, ${2:y})', isSnippet: true, detail: 'Long.compare(x, y) - Compara longs' },
    { label: 'max', insertText: 'max(${1:a}, ${2:b})', isSnippet: true, detail: 'Long.max(a, b) - Maior valor' },
    { label: 'min', insertText: 'min(${1:a}, ${2:b})', isSnippet: true, detail: 'Long.min(a, b) - Menor valor' },
    { label: 'sum', insertText: 'sum(${1:a}, ${2:b})', isSnippet: true, detail: 'Long.sum(a, b) - Soma longs (Long::sum)' },
    { label: 'hashCode', insertText: 'hashCode(${1:value})', isSnippet: true, detail: 'Long.hashCode(value)' },
    { label: 'MAX_VALUE', insertText: 'MAX_VALUE', kind: 'Field', detail: '2^63 - 1 (64-bit max)' },
    { label: 'MIN_VALUE', insertText: 'MIN_VALUE', kind: 'Field', detail: '-2^63 (64-bit min)' },
    { label: 'BYTES', insertText: 'BYTES', kind: 'Field', detail: 'Tamanho: 8 bytes' },
    { label: 'SIZE', insertText: 'SIZE', kind: 'Field', detail: 'Tamanho: 64 bits' },
  ],
  Double: [
    { label: 'valueOf', insertText: 'valueOf(${1:s})', isSnippet: true, detail: 'Double.valueOf(String/double)' },
    { label: 'parseDouble', insertText: 'parseDouble(${1:s})', isSnippet: true, detail: 'Double.parseDouble(String) - double primitivo' },
    { label: 'toString', insertText: 'toString(${1:d})', isSnippet: true, detail: 'Double.toString(double)' },
    { label: 'compare', insertText: 'compare(${1:d1}, ${2:d2})', isSnippet: true, detail: 'Double.compare(d1, d2)' },
    { label: 'isNaN', insertText: 'isNaN(${1:v})', isSnippet: true, detail: 'Double.isNaN(v) - Valida Not-a-Number' },
    { label: 'isInfinite', insertText: 'isInfinite(${1:v})', isSnippet: true, detail: 'Double.isInfinite(v) - Valida infinito' },
    { label: 'max', insertText: 'max(${1:a}, ${2:b})', isSnippet: true, detail: 'Double.max(a, b)' },
    { label: 'min', insertText: 'min(${1:a}, ${2:b})', isSnippet: true, detail: 'Double.min(a, b)' },
    { label: 'sum', insertText: 'sum(${1:a}, ${2:b})', isSnippet: true, detail: 'Double.sum(a, b)' },
    { label: 'MAX_VALUE', insertText: 'MAX_VALUE', kind: 'Field', detail: '1.7976931348623157e+308' },
    { label: 'MIN_VALUE', insertText: 'MIN_VALUE', kind: 'Field', detail: '4.9e-324' },
    { label: 'POSITIVE_INFINITY', insertText: 'POSITIVE_INFINITY', kind: 'Field', detail: 'Infinito positivo' },
    { label: 'NEGATIVE_INFINITY', insertText: 'NEGATIVE_INFINITY', kind: 'Field', detail: 'Infinito negativo' },
    { label: 'NaN', insertText: 'NaN', kind: 'Field', detail: 'Constante Not-a-Number' },
    { label: 'BYTES', insertText: 'BYTES', kind: 'Field', detail: 'Tamanho: 8 bytes' },
    { label: 'SIZE', insertText: 'SIZE', kind: 'Field', detail: 'Tamanho: 64 bits' },
  ],
  Boolean: [
    { label: 'valueOf', insertText: 'valueOf(${1:s})', isSnippet: true, detail: 'Boolean.valueOf(String/boolean)' },
    { label: 'parseBoolean', insertText: 'parseBoolean("${1:true}")', isSnippet: true, detail: 'Boolean.parseBoolean(String) - boolean primitivo' },
    { label: 'toString', insertText: 'toString(${1:b})', isSnippet: true, detail: 'Boolean.toString(boolean)' },
    { label: 'logicalAnd', insertText: 'logicalAnd(${1:a}, ${2:b})', isSnippet: true, detail: 'Boolean.logicalAnd(a, b) - E lógico (&&)' },
    { label: 'logicalOr', insertText: 'logicalOr(${1:a}, ${2:b})', isSnippet: true, detail: 'Boolean.logicalOr(a, b) - OU lógico (||)' },
    { label: 'logicalXor', insertText: 'logicalXor(${1:a}, ${2:b})', isSnippet: true, detail: 'Boolean.logicalXor(a, b) - XOR (^)' },
    { label: 'compare', insertText: 'compare(${1:x}, ${2:y})', isSnippet: true, detail: 'Boolean.compare(x, y)' },
    { label: 'TRUE', insertText: 'TRUE', kind: 'Field', detail: 'Instância Boolean.TRUE' },
    { label: 'FALSE', insertText: 'FALSE', kind: 'Field', detail: 'Instância Boolean.FALSE' },
  ],
  Character: [
    { label: 'valueOf', insertText: 'valueOf(${1:c})', isSnippet: true, detail: 'Character.valueOf(char)' },
    { label: 'isDigit', insertText: 'isDigit(${1:ch})', isSnippet: true, detail: 'Character.isDigit(ch) - Valida se é número' },
    { label: 'isLetter', insertText: 'isLetter(${1:ch})', isSnippet: true, detail: 'Character.isLetter(ch) - Valida se é letra' },
    { label: 'isLetterOrDigit', insertText: 'isLetterOrDigit(${1:ch})', isSnippet: true, detail: 'Valida se é letra ou dígito' },
    { label: 'isWhitespace', insertText: 'isWhitespace(${1:ch})', isSnippet: true, detail: 'Valida se é espaço em branco' },
    { label: 'toUpperCase', insertText: 'toUpperCase(${1:ch})', isSnippet: true, detail: 'Converte char para maiúsculo' },
    { label: 'toLowerCase', insertText: 'toLowerCase(${1:ch})', isSnippet: true, detail: 'Converte char para minúsculo' },
    { label: 'isUpperCase', insertText: 'isUpperCase(${1:ch})', isSnippet: true, detail: 'Verifica se é maiúsculo' },
    { label: 'isLowerCase', insertText: 'isLowerCase(${1:ch})', isSnippet: true, detail: 'Verifica se é minúsculo' },
    { label: 'compare', insertText: 'compare(${1:x}, ${2:y})', isSnippet: true, detail: 'Character.compare(x, y)' },
    { label: 'BYTES', insertText: 'BYTES', kind: 'Field', detail: 'Tamanho: 2 bytes' },
    { label: 'SIZE', insertText: 'SIZE', kind: 'Field', detail: 'Tamanho: 16 bits' },
  ],
  Byte: [
    { label: 'valueOf', insertText: 'valueOf(${1:s})', isSnippet: true, detail: 'Byte.valueOf(String/byte)' },
    { label: 'parseByte', insertText: 'parseByte("${1:s}")', isSnippet: true, detail: 'Byte.parseByte(String) - byte primitivo' },
    { label: 'toString', insertText: 'toString(${1:b})', isSnippet: true, detail: 'Byte.toString(byte)' },
    { label: 'compare', insertText: 'compare(${1:x}, ${2:y})', isSnippet: true, detail: 'Byte.compare(x, y)' },
    { label: 'MAX_VALUE', insertText: 'MAX_VALUE', kind: 'Field', detail: '127 (byte max)' },
    { label: 'MIN_VALUE', insertText: 'MIN_VALUE', kind: 'Field', detail: '-128 (byte min)' },
    { label: 'BYTES', insertText: 'BYTES', kind: 'Field', detail: 'Tamanho: 1 byte' },
    { label: 'SIZE', insertText: 'SIZE', kind: 'Field', detail: 'Tamanho: 8 bits' },
  ],
  ResponseEntity: [
    { label: 'ok', insertText: 'ok(${1:body})', isSnippet: true, detail: 'ResponseEntity.ok(body) - HTTP 200' },
    { label: 'ok().build()', insertText: 'ok().build()', isSnippet: true, detail: 'ResponseEntity.ok().build() - HTTP 200 vazio' },
    { label: 'status', insertText: 'status(org.springframework.http.HttpStatus.${1:OK}).body(${2:body})', isSnippet: true, detail: 'ResponseEntity.status(status).body(body)' },
    { label: 'created', insertText: 'created(java.net.URI.create("${1:/api/resource/}" + ${2:id})).body(${3:body})', isSnippet: true, detail: 'HTTP 201 Created com URI' },
    { label: 'badRequest', insertText: 'badRequest().body(${1:error})', isSnippet: true, detail: 'ResponseEntity.badRequest().body(error) - HTTP 400' },
    { label: 'badRequest().build()', insertText: 'badRequest().build()', isSnippet: true, detail: 'HTTP 400 Bad Request vazio' },
    { label: 'notFound().build()', insertText: 'notFound().build()', isSnippet: true, detail: 'HTTP 404 Not Found' },
    { label: 'noContent().build()', insertText: 'noContent().build()', isSnippet: true, detail: 'HTTP 204 No Content' },
  ],
  Optional: [
    { label: 'ofNullable', insertText: 'ofNullable(${1:value})', isSnippet: true, detail: 'Optional.ofNullable(obj) - Permite nulo' },
    { label: 'of', insertText: 'of(${1:value})', isSnippet: true, detail: 'Optional.of(obj) - Lança NPE se nulo' },
    { label: 'empty', insertText: 'empty()', isSnippet: true, detail: 'Optional.empty() - Retorna Optional vazio' },
  ],
  UUID: [
    { label: 'randomUUID', insertText: 'randomUUID()', isSnippet: true, detail: 'UUID.randomUUID() - Gera UUID v4 aleatório' },
    { label: 'fromString', insertText: 'fromString("${1:uuidString}")', isSnippet: true, detail: 'UUID.fromString(String) - Converte texto em UUID' },
  ]
}

export const SPRING_DATA_JPA_METHODS = [
  // 1. Escrita e Mutação (Persistência)
  { label: 'save(entity)', insertText: 'save(${1:entity})', isSnippet: true, detail: '<S extends T> S save(S entity) - Salva ou atualiza entidade' },
  { label: 'saveAndFlush(entity)', insertText: 'saveAndFlush(${1:entity})', isSnippet: true, detail: 'Salva a entidade e sincroniza com o banco imediatamente' },
  { label: 'saveAll(entities)', insertText: 'saveAll(${1:listOfEntities})', isSnippet: true, detail: '<S extends T> List<S> saveAll(Iterable<S>) - Salva lote em batch' },

  // 2. Consultas Unitárias
  { label: 'findById(id)', insertText: 'findById(${1:id})', isSnippet: true, detail: 'Optional<T> findById(ID id) - Busca por chave primária (Anti-NPE)' },
  { label: 'existsById(id)', insertText: 'existsById(${1:id})', isSnippet: true, detail: 'boolean existsById(ID id) - Verifica existência sem carregar entidade' },
  { label: 'getReferenceById(id)', insertText: 'getReferenceById(${1:id})', isSnippet: true, detail: 'T getReferenceById(ID id) - Referência Lazy Proxy (alta performance)' },

  // 3. Listagens
  { label: 'findAll()', insertText: 'findAll()', detail: 'List<T> findAll() - Retorna todos os registros' },
  { label: 'findAllById(ids)', insertText: 'findAllById(${1:listOfIds})', isSnippet: true, detail: 'List<T> findAllById(Iterable<ID>) - Busca por lista de IDs' },
  { label: 'count()', insertText: 'count()', detail: 'long count() - Quantidade total de registros' },

  // 4. Paginação, Ordenação e Busca Fluida (Spring Data 3.x)
  { label: 'findAll(PageRequest)', insertText: 'findAll(org.springframework.data.domain.PageRequest.of(${1:0}, ${2:10}))', isSnippet: true, detail: 'Page<T> findAll(Pageable) - Paginação com PageRequest.of(page, size)' },
  { label: 'findAll(Sort)', insertText: 'findAll(org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.${1:ASC}, "${2:id}"))', isSnippet: true, detail: 'List<T> findAll(Sort) - Consulta com ordenação Sort.by' },

  // 5. Exclusões Otimizadas
  { label: 'deleteById(id)', insertText: 'deleteById(${1:id})', isSnippet: true, detail: 'void deleteById(ID id) - Remove registro por ID' },
  { label: 'delete(entity)', insertText: 'delete(${1:entity})', isSnippet: true, detail: 'void delete(T entity) - Remove entidade especificada' },
  { label: 'deleteAllInBatch()', insertText: 'deleteAllInBatch()', detail: 'void deleteAllInBatch() - Apaga registros em query única combinada (Batch)' },
  { label: 'deleteAllByIdInBatch(ids)', insertText: 'deleteAllByIdInBatch(${1:listOfIds})', isSnippet: true, detail: 'Apaga lote por lista de IDs em query única combinada' },
  { label: 'deleteAll()', insertText: 'deleteAll()', detail: 'void deleteAll() - Remove todos os registros' },

  // 6. Projeção Dinâmica (Spring Data 3.x)
  { label: 'findBy(id, Class)', insertText: 'findBy(${1:id}, ${2:ClassToConvert}.class)', isSnippet: true, detail: 'Spring 3: Projeção dinâmica direta para Record/DTO no banco' },

  // 7. Flush e Sincronização
  { label: 'flush()', insertText: 'flush()', detail: 'void flush() - Descarrega operações pendentes no banco' },
]

export const SPRING_SERVICE_METHODS = [
  // 1. Métodos padrão de negócio e métricas do MetaBuilder Spring Boot
  { label: 'getAnalyticsSummary()', insertText: 'getAnalyticsSummary()', detail: 'Map<String, Object> getAnalyticsSummary() - Métricas e resumo analítico' },
  { label: 'findAll(page, size, sort)', insertText: 'findAll(${1:page}, ${2:size}, ${3:sort})', isSnippet: true, detail: 'Page<T> findAll(int page, int size, String sort) - Busca paginada' },
  { label: 'search(params, page, size, sort)', insertText: 'search(${1:filters}, ${2:page}, ${3:size}, ${4:sort})', isSnippet: true, detail: 'Page<T> search(Map<String, String> params, int page, int size, String sort) - Busca dinâmica por filtros' },
  { label: 'findAllProjected(page, size, sort)', insertText: 'findAllProjected(${1:page}, ${2:size}, ${3:sort})', isSnippet: true, detail: 'Page<ListView> findAllProjected(int page, int size, String sort) - Projeção de Grid' },

  // 2. Operações CRUD canônicas
  { label: 'findById(id)', insertText: 'findById(${1:id})', isSnippet: true, detail: 'Optional<T> findById(ID id) - Busca por ID' },
  { label: 'save(entity)', insertText: 'save(${1:entity})', isSnippet: true, detail: 'T save(T entity) - Salva ou atualiza entidade' },
  { label: 'delete(id)', insertText: 'delete(${1:id})', isSnippet: true, detail: 'void delete(ID id) - Remove por ID' },
  { label: 'deleteById(id)', insertText: 'deleteById(${1:id})', isSnippet: true, detail: 'void deleteById(ID id) - Remove por ID' },
  { label: 'findAll()', insertText: 'findAll()', detail: 'List<T> findAll() - Retorna lista completa' },
  { label: 'save(dto)', insertText: 'save(${1:dto})', isSnippet: true, detail: 'DTO save(DTO dto) - Cria ou atualiza registro DTO' },
  { label: 'update(id, dto)', insertText: 'update(${1:id}, ${2:dto})', isSnippet: true, detail: 'DTO update(ID id, DTO dto) - Atualiza registro existente' },
]

const COMMON_INSTANCE_DOT_SUGGESTIONS = [
  // Optional methods
  { label: 'orElse', insertText: 'orElse(${1:defaultValue})', isSnippet: true, detail: 'Optional: Retorna valor ou fallback' },
  { label: 'orElseThrow', insertText: 'orElseThrow(() -> new RuntimeException("${1:Registro não encontrado}"))', isSnippet: true, detail: 'Optional: Lança exceção se vazio' },
  { label: 'ifPresent', insertText: 'ifPresent(${1:item} -> {\n\t${2}\n})', isSnippet: true, detail: 'Optional: Executa ação se presente' },
  { label: 'ifPresentOrElse', insertText: 'ifPresentOrElse(${1:item} -> {\n\t${2}\n}, () -> {\n\t${3}\n})', isSnippet: true, detail: 'Optional: Executa ação ou fallback' },
  { label: 'map', insertText: 'map(${1:item} -> ${2:item})', isSnippet: true, detail: 'Optional / Stream: Mapeia valor' },
  { label: 'flatMap', insertText: 'flatMap(${1:item} -> ${2})', isSnippet: true, detail: 'Optional / Stream: Achata valor' },
  { label: 'filter', insertText: 'filter(${1:item} -> ${2})', isSnippet: true, detail: 'Optional / Stream: Filtra por predicado' },
  { label: 'isPresent', insertText: 'isPresent()', isSnippet: true, detail: 'Optional: Verifica se não é vazio' },
  { label: 'isEmpty', insertText: 'isEmpty()', isSnippet: true, detail: 'Optional / String / Collection: Verifica se é vazio' },
  { label: 'get', insertText: 'get()', isSnippet: true, detail: 'Optional: Retorna valor interno' },
  // Common Object / String / Collection methods
  { label: 'toString', insertText: 'toString()', isSnippet: true, detail: 'Converte para String' },
  { label: 'equals', insertText: 'equals(${1:obj})', isSnippet: true, detail: 'Compara igualdade' },
  { label: 'hashCode', insertText: 'hashCode()', isSnippet: true, detail: 'Código hash do objeto' },
  { label: 'size', insertText: 'size()', isSnippet: true, detail: 'Quantidade de elementos' },
  { label: 'length', insertText: 'length()', isSnippet: true, detail: 'Comprimento da String/Array' },
  { label: 'stream', insertText: 'stream()', isSnippet: true, detail: 'Inicia Stream da coleção' },
]

// Cache de fontes de classes Java para extração dinâmica de métodos
const classSourceCache = new Map<string, string>()

export const updateJavaClassSource = (className: string, source: string) => {
  if (className && source) {
    classSourceCache.set(className, source)
  }
}

export interface JavaMethodSuggestion {
  label: string
  insertText: string
  isSnippet?: boolean
  kind: 'Method'
  detail: string
}

/**
 * Extrai todos os métodos públicos declarados em um arquivo fonte Java
 */
export function parseJavaMethodsFromSource(source: string): JavaMethodSuggestion[] {
  if (!source) return []
  const methods: JavaMethodSuggestion[] = []
  const seen = new Set<string>()

  // Regex para declarações de métodos públicos:
  // public [static] [<T>] ReturnType methodName(Type1 param1, Type2 param2) [throws ...] {
  const methodRegex = /public\s+(?:static\s+)?(?:<[^>]+>\s+)?([A-Za-z0-9_<>[\],\s]+?)\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*(?:throws\s+[^{]+)?\s*\{/g

  let match: RegExpExecArray | null
  while ((match = methodRegex.exec(source)) !== null) {
    const returnType = match[1].trim()
    const methodName = match[2].trim()
    const rawParams = match[3].trim()

    // Ignora construtores (iniciados com maiúscula)
    if (/^[A-Z]/.test(methodName)) continue

    let label = `${methodName}()`
    let insertText = `${methodName}()`
    let isSnippet = false

    if (rawParams) {
      const params = rawParams.split(',').map(p => {
        const cleaned = p.replace(/@\w+(?:\([^)]*\))?\s*/g, '').trim()
        const parts = cleaned.split(/\s+/)
        return {
          type: parts.slice(0, -1).join(' ') || 'Object',
          name: parts[parts.length - 1] || 'param'
        }
      })

      const paramNames = params.map(p => p.name).join(', ')
      label = `${methodName}(${paramNames})`

      const snippetParams = params.map((p, idx) => `\${${idx + 1}:${p.name}}`).join(', ')
      insertText = `${methodName}(${snippetParams})`
      isSnippet = true
    }

    if (!seen.has(label)) {
      seen.add(label)
      methods.push({
        label,
        insertText,
        isSnippet,
        kind: 'Method',
        detail: `${returnType} ${methodName}(${rawParams.replace(/\s+/g, ' ')})`
      })
    }
  }

  return methods
}

/**
 * Obtém os métodos de uma classe Java (do cache de fontes ou modelos abertos do Monaco)
 */
export function getMethodsForClass(className: string, monaco?: any): JavaMethodSuggestion[] {
  if (!className) return []

  let source = classSourceCache.get(className) || null
  if (!source && monaco && monaco.editor) {
    const models = monaco.editor.getModels()
    for (const m of models) {
      const p = (m.uri ? m.uri.path || '' : '').replace(/\\/g, '/')
      if (p.endsWith(`/${className}.java`)) {
        source = m.getValue()
        if (source) {
          classSourceCache.set(className, source)
          break
        }
      }
    }
  }

  if (source) {
    return parseJavaMethodsFromSource(source)
  }

  return []
}

/**
 * Detecta se o trecho digitado imediatamente antes da palavra atual representa um Tipo Java.
 * Quando verdadeiro, o usuário está nomeando uma variável/atributo (ex: "private CategoriasProdutosService ")
 */
export function detectTypeBeforeCursor(textBeforeWord: string): string | null {
  const trimmed = textBeforeWord.trim()
  if (!trimmed) return null

  // Palavras-chave ou caracteres que precedem identificadores mas NÃO são tipos de variáveis
  const nonTypeKeywords = [
    'package', 'import', 'class', 'interface', 'enum', 'record', 'extends', 'implements',
    'throws', 'throw', 'new', 'return', 'instanceof', 'case', 'default', 'if', 'else',
    'while', 'for', 'do', 'switch', 'try', 'catch', 'finally', 'synchronized',
    'assert', 'goto', 'const', 'true', 'false', 'null', 'this', 'super'
  ]

  // Se terminar com operadores (=, ==, +, -, etc.), parênteses de chamada ou pontuação
  if (/[=+\-*/%&|^!<>?:;,()\[\]{}]$/.test(trimmed)) return null

  // Pega a última palavra do trecho
  const lastWordMatch = trimmed.match(/([a-zA-Z0-9_]+)$/)
  if (!lastWordMatch) return null
  const lastWord = lastWordMatch[1]
  if (nonTypeKeywords.includes(lastWord)) return null

  // Se a última palavra for um modificador (ex: "private", "final", "public"), o usuário ainda vai digitar o tipo
  const modifiers = ['private', 'protected', 'public', 'static', 'final', 'transient', 'volatile', 'abstract']
  if (modifiers.includes(lastWord)) return null

  // Se for instanciação: ex: new ClientesService
  if (/\bnew\s+[A-Za-z0-9_<>]+$/.test(trimmed)) return null

  // Se for anotação isolada: ex: @GetMapping
  if (/^@\w+$/.test(trimmed)) return null

  // 1. Tipo genérico no final: Ex: Map<String, String>, List<Item>, ResponseEntity<Page<X>>
  const genericMatch = trimmed.match(/(?:^|[\s,(])(?:@\w+(?:\([^)]*\))?\s+)*(?:(?:private|protected|public|static|final|transient|volatile)\s+)*([A-Z][A-Za-z0-9_]*<.+>)$/)
  if (genericMatch) {
    return genericMatch[1].trim()
  }

  // 2. Tipo simples (PascalCase ou tipo primitivo) com possíveis modificadores
  // Ex: "private CategoriasProdutosService" -> "CategoriasProdutosService"
  // Ex: "private final PedidosService" -> "PedidosService"
  // Ex: "String" -> "String"
  // Ex: "int" -> "int"
  const simpleMatch = trimmed.match(/(?:^|[\s,(])(?:@\w+(?:\([^)]*\))?\s+)*(?:(?:private|protected|public|static|final|transient|volatile)\s+)*([A-Z][A-Za-z0-9_]*(?:\[\s*\])*|\b(?:int|long|boolean|double|float|byte|char|short|void)(?:\[\s*\])*)$/)
  if (simpleMatch) {
    return simpleMatch[1].trim()
  }

  return null
}

/**
 * Gera sugestões inteligentes de nomes de variáveis/atributos a partir do tipo declarado
 */
export function generateVariableNameSuggestions(typeStr: string): string[] {
  const suggestions: string[] = []
  const seen = new Set<string>()

  const add = (name: string) => {
    if (!name || seen.has(name) || !/^[a-z][a-zA-Z0-9_]*$/.test(name)) return
    const reserved = ['abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new', 'package', 'private', 'protected', 'public', 'return', 'short', 'static', 'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws', 'transient', 'try', 'void', 'volatile', 'while']
    if (reserved.includes(name)) return
    seen.add(name)
    suggestions.push(name)
  }

  const lowerType = typeStr.toLowerCase()

  // Tipos primitivos e básicos
  if (lowerType === 'string') {
    ['str', 'name', 'value', 'text', 'title', 'description'].forEach(add)
    return suggestions
  }
  if (['int', 'integer', 'long'].includes(lowerType)) {
    ['id', 'count', 'total', 'index', 'size', 'number'].forEach(add)
    return suggestions
  }
  if (['boolean', 'bool'].includes(lowerType)) {
    ['active', 'enabled', 'isValid', 'hasAccess', 'success'].forEach(add)
    return suggestions
  }
  if (['double', 'float', 'bigdecimal'].includes(lowerType)) {
    ['amount', 'price', 'total', 'value', 'balance'].forEach(add)
    return suggestions
  }
  if (lowerType === 'uuid') {
    ['id', 'uuid', 'token'].forEach(add)
    return suggestions
  }

  // Genéricos: List<X>, Set<X>, Page<X>, Map<K,V>
  const genericMatch = typeStr.match(/^([A-Za-z0-9_]+)<(.+)>$/)
  if (genericMatch) {
    const outer = genericMatch[1]
    const inner = genericMatch[2].trim()

    if (['List', 'Set', 'Collection', 'Iterable', 'Page'].includes(outer)) {
      const innerClean = inner.replace(/<.*>/, '').replace(/.*[.]/, '').trim()
      if (innerClean && /^[A-Z]/.test(innerClean)) {
        const innerCamel = innerClean.charAt(0).toLowerCase() + innerClean.slice(1)
        const plural = innerCamel.endsWith('s') ? innerCamel : `${innerCamel}s`
        add(plural)
        add(`${innerCamel}List`)
        if (outer === 'Page') add(`${innerCamel}Page`)
        add('items')
        add('list')
        return suggestions
      }
    }

    if (['Map', 'HashMap', 'ConcurrentMap'].includes(outer)) {
      ['map', 'params', 'filters', 'data', 'summary', 'payload'].forEach(add)
      return suggestions
    }

    if (outer === 'Optional') {
      const innerClean = inner.replace(/<.*>/, '').replace(/.*[.]/, '').trim()
      if (innerClean && /^[A-Z]/.test(innerClean)) {
        const innerCamel = innerClean.charAt(0).toLowerCase() + innerClean.slice(1)
        add(`opt${innerClean}`)
        add(`${innerCamel}Opt`)
        add(innerCamel)
        return suggestions
      }
    }
  }

  // Classes (PascalCase): Ex: CategoriasProdutosService, ClientesRepository
  const cleanType = typeStr.replace(/\[\s*\]/g, '').replace(/<.*>/g, '').trim()
  if (!cleanType) return suggestions

  const words = cleanType.match(/[A-Z][a-z0-9]*/g) || [cleanType]

  // 1. camelCase completo (ex: "categoriasProdutosService")
  const fullCamel = cleanType.charAt(0).toLowerCase() + cleanType.slice(1)
  add(fullCamel)

  // 2. Sufixo arquitetural (ex: "service", "repository", "controller")
  const lastWord = words[words.length - 1]
  const archSuffixes = ['Service', 'Repository', 'Controller', 'DTO', 'Dto', 'Record', 'Entity', 'Mapper', 'Helper', 'Client', 'Spec', 'Specification', 'Config', 'Producer', 'Consumer']
  if (archSuffixes.includes(lastWord) && words.length > 1) {
    add(lastWord.toLowerCase()) // ex: "service"

    // 3. Primeira palavra + sufixo (ex: "categoriasService")
    if (words.length > 2) {
      const firstWord = words[0]
      add(firstWord.charAt(0).toLowerCase() + firstWord.slice(1) + lastWord)
    }

    // 4. Sem sufixo (ex: "categoriasProdutos")
    const withoutSuffix = words.slice(0, -1).join('')
    const withoutSuffixCamel = withoutSuffix.charAt(0).toLowerCase() + withoutSuffix.slice(1)
    add(withoutSuffixCamel)

    // 5. Singular da primeira palavra (ex: "categoria")
    const firstSingular = words[0].replace(/s$/, '')
    if (firstSingular !== words[0]) {
      add(firstSingular.charAt(0).toLowerCase() + firstSingular.slice(1))
    }
  } else if (words.length > 1) {
    const lastCamel = lastWord.charAt(0).toLowerCase() + lastWord.slice(1)
    add(lastCamel)

    const firstSingular = words[0].replace(/s$/, '')
    if (firstSingular !== words[0]) {
      add(firstSingular.charAt(0).toLowerCase() + firstSingular.slice(1))
    }
  }

  // 6. Abreviação curta de 4 ou 3 letras (ex: "cate" ou "cat")
  if (words[0].length >= 4) {
    add(words[0].substring(0, 4).toLowerCase())
    add(words[0].substring(0, 3).toLowerCase())
  }

  return suggestions
}

export interface ScopeSymbol {
  name: string
  type: string
  kind: 'Field' | 'Variable' | 'Parameter'
  detail: string
}

/**
 * Extrai campos da classe, parâmetros de método e variáveis locais do arquivo atual
 */
export function extractInScopeSymbols(source: string, currentLineNumber: number): ScopeSymbol[] {
  const symbols: ScopeSymbol[] = []
  const seen = new Set<string>()

  const add = (sym: ScopeSymbol) => {
    if (!sym.name || seen.has(sym.name)) return
    const reserved = ['this', 'super', 'null', 'true', 'false', 'class', 'return', 'if', 'else', 'for', 'while', 'new', 'try', 'catch', 'throw']
    if (reserved.includes(sym.name)) return
    seen.add(sym.name)
    symbols.push(sym)
  }

  const lines = source.split('\n')

  // 1. Atributos/Campos da Classe (Fields)
  // Ex: private final ClientesService service;
  // Ex: private CategoriasProdutosService cate;
  const fieldRegex = /^\s*(?:@\w+(?:\([^)]*\))?\s+)*(?:(?:private|protected|public|static|final|transient|volatile)\s+)+([A-Za-z0-9_<>[\],\s]+?)\s+([a-zA-Z0-9_]+)\s*(?:=[^;]+)?;/
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.includes('(') || line.includes('class ') || line.includes('interface ')) continue
    const match = line.match(fieldRegex)
    if (match) {
      const type = match[1].trim()
      const name = match[2].trim()
      if (name !== 'serialVersionUID') {
        add({
          name,
          type,
          kind: 'Field',
          detail: `${type} ${name} (Campo da Classe)`
        })
      }
    }
  }

  // 2. Parâmetros do Método Atual (se o cursor estiver dentro de um método)
  let methodStartLine = -1
  let methodParamsRaw = ''

  for (let i = currentLineNumber - 1; i >= 0; i--) {
    const line = lines[i]
    if (line.includes('class ') || line.includes('interface ')) break

    const chunk = lines.slice(Math.max(0, i - 4), i + 1).join(' ')
    const methodMatch = chunk.match(/(?:public|protected|private|static)\s+(?:<[^>]+>\s+)?(?:[A-Za-z0-9_<>[\],\s]+?)\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*(?:throws\s+[^{]+)?\s*\{/)
    if (methodMatch) {
      methodParamsRaw = methodMatch[2]
      methodStartLine = i
      break
    }
  }

  if (methodParamsRaw) {
    const rawList = methodParamsRaw.split(',')
    for (const raw of rawList) {
      const cleaned = raw.replace(/@\w+(?:\([^)]*\))?\s*/g, '').trim()
      if (!cleaned) continue
      const parts = cleaned.split(/\s+/)
      const name = parts[parts.length - 1]
      const type = parts.slice(0, -1).join(' ') || 'Object'
      if (name && /^[a-zA-Z0-9_]+$/.test(name)) {
        add({
          name,
          type,
          kind: 'Parameter',
          detail: `${type} ${name} (Parâmetro do Método)`
        })
      }
    }
  }

  // 3. Variáveis Locais declaradas acima do cursor no método
  const localStart = methodStartLine !== -1 ? methodStartLine : 0
  const varRegex = /^\s*(?:final\s+)?([A-Za-z0-9_<>[\],]+|var)\s+([a-zA-Z0-9_]+)\s*(?:=|;)/
  for (let i = localStart; i < currentLineNumber - 1 && i < lines.length; i++) {
    const line = lines[i]
    if (line.includes('return ') || line.includes('throw ')) continue
    const match = line.match(varRegex)
    if (match) {
      const type = match[1].trim()
      const name = match[2].trim()
      add({
        name,
        type,
        kind: 'Variable',
        detail: `${type} ${name} (Variável Local)`
      })
    }
  }

  return symbols
}

/**
 * Infere o tipo de uma variável inspecionando o código-fonte Java local (0ms, sem necessidade de JVM/LSP externo)
 */
export function inferVariableType(source: string, variableName: string): string | null {
  if (!variableName) return null

  // 1. Injeção de dependência / Atributo com ou sem anotações (@Inject, @Autowired, private, final, etc.)
  // Ex: private ClientesRepository clientesRepository;
  // Ex: private final ClientesService service;
  // Ex: private CategoriasProdutosService cate;
  const fieldRegex = new RegExp(
    `(?:@\\w+(?:\\([^)]*\\))?\\s+)*(?:(?:private|protected|public|static|final|transient|volatile)\\s+)+([A-Z][A-Za-z0-9_<>]+)\\s+${variableName}\\b`,
    'm'
  )
  const fieldMatch = source.match(fieldRegex)
  if (fieldMatch) {
    const rawType = fieldMatch[1]
    const genericMatch = rawType.match(/<([A-Za-z0-9_]+)>/)
    return genericMatch ? genericMatch[1] : rawType
  }

  // 2. Declaração local de variável ou parâmetro
  // Ex: ClientesEntity cliente = new ClientesEntity();
  // Ex: public void salvar(Clientes cliente)
  const localRegex = new RegExp(`\\b([A-Z][A-Za-z0-9_<>]+)\\s+${variableName}\\b`, 'm')
  const localMatch = source.match(localRegex)
  if (localMatch) {
    const rawType = localMatch[1]
    const genericMatch = rawType.match(/<([A-Za-z0-9_]+)>/)
    return genericMatch ? genericMatch[1] : rawType
  }

  // 3. Instanciação com new
  // Ex: var cliente = new ClientesEntity();
  const newRegex = new RegExp(`\\b${variableName}\\s*=\\s*new\\s+([A-Z][A-Za-z0-9_]+)\\b`, 'm')
  const newMatch = source.match(newRegex)
  if (newMatch) return newMatch[1]

  return null
}

export const registerJavaSnippets = (monaco: any) => {
  if (javaSnippetsRegistered) return
  javaSnippetsRegistered = true

  monaco.languages.registerCompletionItemProvider('java', {
    triggerCharacters: ['@', '.'],
    provideCompletionItems: (model: any, position: any) => {
      const lineContent = model.getLineContent(position.lineNumber)
      const textBeforeCursor = lineContent.substring(0, position.column - 1)

      // Detecta se o usuário acabou de digitar um ponto ou está digitando após um ponto (ex: "Integer." ou "cliente." ou "cate.")
      const dotMatch = textBeforeCursor.match(/([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]*)$/)

      if (dotMatch) {
        const caller = dotMatch[1]
        const typedAfterDot = dotMatch[2]
        const dotRange = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - typedAfterDot.length,
          endColumn: position.column
        }

        // 1. Se for uma classe Wrapper estática (ex: Integer., ResponseEntity., UUID., Optional.)
        const callerSuggestions = WRAPPER_DOT_SUGGESTIONS[caller]
        if (callerSuggestions) {
          return {
            suggestions: callerSuggestions.map(s => ({
              label: s.label,
              kind: s.kind === 'Field' 
                ? monaco.languages.CompletionItemKind.Field 
                : monaco.languages.CompletionItemKind.Method,
              insertText: s.insertText,
              insertTextRules: s.isSnippet 
                ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet 
                : undefined,
              range: dotRange,
              detail: s.detail || `${caller}.${s.label}`
            }))
          }
        }

        // 2. Análise de escopo e inferência de tipo para instâncias (cliente., clientesRepository., cate., etc.)
        const fullSource = model.getValue()
        const inferredType = inferVariableType(fullSource, caller)
        const targetType = inferredType || caller
        const targetTypeLower = targetType.toLowerCase()

        // 2.1 Verifica se há métodos extraídos diretamente do código-fonte da classe
        const parsedClassMethods = getMethodsForClass(targetType, monaco)

        // 2.2 É um Repository do Spring Data JPA?
        if (targetTypeLower.endsWith('repository') || targetTypeLower.endsWith('repo')) {
          const repoMethods = [...parsedClassMethods]
          const existingLabels = new Set(repoMethods.map(m => m.label.split('(')[0]))
          SPRING_DATA_JPA_METHODS.forEach(m => {
            const base = m.label.split('(')[0]
            if (!existingLabels.has(base)) {
              repoMethods.push(m as any)
            }
          })
          return {
            suggestions: repoMethods.map(s => ({
              label: s.label,
              kind: monaco.languages.CompletionItemKind.Method,
              insertText: s.insertText,
              insertTextRules: s.isSnippet 
                ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet 
                : undefined,
              range: dotRange,
              detail: s.detail
            }))
          }
        }

        // 2.3 É um Service do Spring?
        if (targetTypeLower.endsWith('service')) {
          const serviceMethods = [...parsedClassMethods]
          const existingLabels = new Set(serviceMethods.map(m => m.label.split('(')[0]))

          SPRING_SERVICE_METHODS.forEach(m => {
            const baseName = m.label.split('(')[0]
            if (!existingLabels.has(baseName)) {
              serviceMethods.push(m as any)
            }
          })

          return {
            suggestions: serviceMethods.map(s => ({
              label: s.label,
              kind: monaco.languages.CompletionItemKind.Method,
              insertText: s.insertText,
              insertTextRules: s.isSnippet 
                ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet 
                : undefined,
              range: dotRange,
              detail: s.detail
            }))
          }
        }

        // 2.4 Se foram encontrados métodos no fonte da classe (qualquer outra classe do projeto)
        if (parsedClassMethods.length > 0) {
          return {
            suggestions: parsedClassMethods.map(s => ({
              label: s.label,
              kind: monaco.languages.CompletionItemKind.Method,
              insertText: s.insertText,
              insertTextRules: s.isSnippet 
                ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet 
                : undefined,
              range: dotRange,
              detail: s.detail
            }))
          }
        }

        // 2.5 É uma Entidade JPA (ou DTO correspondente) do projeto?
        const matchedEntity = findEntityByNameOrVariable(targetType)
        if (matchedEntity) {
          const entityMethods = generateEntityInstanceMethods(matchedEntity)
          return {
            suggestions: entityMethods.map(s => ({
              label: s.label,
              kind: s.kind === 'Field' 
                ? monaco.languages.CompletionItemKind.Field 
                : monaco.languages.CompletionItemKind.Method,
              insertText: s.insertText,
              insertTextRules: s.isSnippet 
                ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet 
                : undefined,
              range: dotRange,
              detail: s.detail
            }))
          }
        }

        // 2.6 Fallback para métodos comuns de instâncias (Optional, String, Object, Collection)
        return {
          suggestions: COMMON_INSTANCE_DOT_SUGGESTIONS.map(s => ({
            label: s.label,
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: s.insertText,
            insertTextRules: s.isSnippet 
              ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet 
              : undefined,
            range: dotRange,
            detail: s.detail || 'Método'
          }))
        }
      }

      // Autocomplete Geral (palavras-chave, anotações, tipos, classes do projeto)
      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      }

      // Detecta se o cursor está após a declaração de um Tipo (ex: "private CategoriasProdutosService ")
      // Neste caso o desenvolvedor está dando nome à variável e NÃO deve sugerir classes Java!
      const textBeforeWord = textBeforeCursor.substring(0, textBeforeCursor.length - word.word.length).trimEnd()
      const declaredType = detectTypeBeforeCursor(textBeforeWord)

      if (declaredType) {
        const varSuggestions = generateVariableNameSuggestions(declaredType)
        return {
          suggestions: varSuggestions.map((name, idx) => ({
            label: name,
            kind: monaco.languages.CompletionItemKind.Variable,
            insertText: name,
            range,
            detail: `${declaredType} ${name} (Sugestão de atributo/variável)`,
            sortText: `00_${String(idx).padStart(2, '0')}_${name}`
          }))
        }
      }

      // Se o usuário já digitou '@' antes da palavra/cursor, ajusta o range para substituir o '@'
      const charBefore = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: Math.max(1, word.startColumn - 1),
        endLineNumber: position.lineNumber,
        endColumn: word.startColumn
      })
      const isPrecededByAt = charBefore === '@'
      const annotationRange = isPrecededByAt ? {
        ...range,
        startColumn: Math.max(1, word.startColumn - 1)
      } : range

      const suggestions = [
        // Java Keywords / Modifiers
        { label: 'private', insertText: 'private ', kind: monaco.languages.CompletionItemKind.Keyword, detail: 'Modificador de acesso privado' },
        { label: 'public', insertText: 'public ', kind: monaco.languages.CompletionItemKind.Keyword, detail: 'Modificador de acesso público' },
        { label: 'protected', insertText: 'protected ', kind: monaco.languages.CompletionItemKind.Keyword, detail: 'Modificador de acesso protegido' },
        { label: 'static', insertText: 'static ', kind: monaco.languages.CompletionItemKind.Keyword, detail: 'Modificador de escopo estático' },
        { label: 'final', insertText: 'final ', kind: monaco.languages.CompletionItemKind.Keyword, detail: 'Modificador de imutabilidade' },

        // Spring Boot & Web Annotations
        { label: '@RequiredArgsConstructor', insertText: '@RequiredArgsConstructor', isAnnotation: true, detail: 'Lombok: Injeta dependências final' },
        { label: '@PathVariable', insertText: '@PathVariable("${1:id}") ${2:Long} ${3:id}', isAnnotation: true, isSnippet: true, detail: 'Spring: Extrai parâmetro da URI' },
        { label: '@RequestParam', insertText: '@RequestParam(value = "${1:param}", required = ${2:false}) ${3:String} ${4:param}', isAnnotation: true, isSnippet: true, detail: 'Spring: Extrai query param' },
        { label: '@RequestBody', insertText: '@RequestBody ${1:Object} ${2:body}', isAnnotation: true, isSnippet: true, detail: 'Spring: Converte payload HTTP' },
        { label: '@RestController', insertText: '@RestController', isAnnotation: true, detail: 'Spring: Controller REST' },
        { label: '@RequestMapping', insertText: '@RequestMapping("${1:/api}")', isAnnotation: true, isSnippet: true, detail: 'Spring: Mapeamento de rota' },
        { label: '@GetMapping', insertText: '@GetMapping("${1:/path}")', isAnnotation: true, isSnippet: true, detail: 'Spring: Rota GET' },
        { label: '@PostMapping', insertText: '@PostMapping("${1:/path}")', isAnnotation: true, isSnippet: true, detail: 'Spring: Rota POST' },
        { label: '@PutMapping', insertText: '@PutMapping("${1:/path}")', isAnnotation: true, isSnippet: true, detail: 'Spring: Rota PUT' },
        { label: '@DeleteMapping', insertText: '@DeleteMapping("${1:/path}")', isAnnotation: true, isSnippet: true, detail: 'Spring: Rota DELETE' },
        { label: '@Autowired', insertText: '@Autowired', isAnnotation: true, detail: 'Spring: Injeção de dependência' },
        { label: '@Service', insertText: '@Service', isAnnotation: true, detail: 'Spring: Camada de serviço' },
        { label: '@Repository', insertText: '@Repository', isAnnotation: true, detail: 'Spring: Camada de repositório' },
        { label: '@Component', insertText: '@Component', isAnnotation: true, detail: 'Spring: Bean gerenciado' },
        
        // JPA Annotations
        { label: '@Entity', insertText: '@Entity', isAnnotation: true, detail: 'JPA: Entidade de banco de dados' },
        { label: '@Table', insertText: '@Table(name = "${1:table_name}")', isAnnotation: true, isSnippet: true, detail: 'JPA: Mapeamento da tabela' },
        { label: '@Id', insertText: '@Id', isAnnotation: true, detail: 'JPA: Chave primária' },
        { label: '@GeneratedValue', insertText: '@GeneratedValue(strategy = GenerationType.IDENTITY)', isAnnotation: true, isSnippet: true, detail: 'JPA: Auto-incremento' },
        { label: '@Column', insertText: '@Column(name = "${1:column_name}")', isAnnotation: true, isSnippet: true, detail: 'JPA: Mapeamento de coluna' },
        { label: '@ManyToOne', insertText: '@ManyToOne(fetch = FetchType.LAZY)', isAnnotation: true, isSnippet: true, detail: 'JPA: Relacionamento N:1' },
        { label: '@OneToMany', insertText: '@OneToMany(mappedBy = "${1:field}", cascade = CascadeType.ALL, orphanRemoval = true)', isAnnotation: true, isSnippet: true, detail: 'JPA: Relacionamento 1:N' },
        { label: '@JoinColumn', insertText: '@JoinColumn(name = "${1:column_id}")', isAnnotation: true, isSnippet: true, detail: 'JPA: Chave estrangeira' },
        
        // Lombok & Jackson
        { label: '@Data', insertText: '@Data', isAnnotation: true, detail: 'Lombok: Getters, Setters, ToString, Equals' },
        { label: '@JsonIgnore', insertText: '@JsonIgnore', isAnnotation: true, detail: 'Jackson: Ignora na serialização JSON' },

        // Primitive Wrappers
        { label: 'Integer', insertText: 'Integer', kind: monaco.languages.CompletionItemKind.Class, detail: 'Wrapper int (32-bit)' },
        { label: 'Long', insertText: 'Long', kind: monaco.languages.CompletionItemKind.Class, detail: 'Wrapper long (64-bit)' },
        { label: 'Double', insertText: 'Double', kind: monaco.languages.CompletionItemKind.Class, detail: 'Wrapper double (64-bit float)' },
        { label: 'Boolean', insertText: 'Boolean', kind: monaco.languages.CompletionItemKind.Class, detail: 'Wrapper boolean' },
        { label: 'Character', insertText: 'Character', kind: monaco.languages.CompletionItemKind.Class, detail: 'Wrapper char' },
        { label: 'Byte', insertText: 'Byte', kind: monaco.languages.CompletionItemKind.Class, detail: 'Wrapper byte (8-bit)' },

        // Spring & Java 21 Wrappers & Types
        { label: 'Optional', insertText: 'Optional<${1:Type}>', isSnippet: true, kind: monaco.languages.CompletionItemKind.Class, detail: 'Wrapper anti-NullPointerException' },
        { label: 'ResponseEntity', insertText: 'ResponseEntity<${1:Type}>', isSnippet: true, kind: monaco.languages.CompletionItemKind.Class, detail: 'Wrapper de resposta HTTP Spring' },
        { label: 'HttpEntity', insertText: 'HttpEntity<${1:Type}>', isSnippet: true, kind: monaco.languages.CompletionItemKind.Class, detail: 'Wrapper HTTP com body e headers' },
        { label: 'RequestEntity', insertText: 'RequestEntity<${1:Type}>', isSnippet: true, kind: monaco.languages.CompletionItemKind.Class, detail: 'Wrapper de requisição HTTP' },
        { label: 'String', insertText: 'String', kind: monaco.languages.CompletionItemKind.Class, detail: 'Cadeia de caracteres' },
        { label: 'List', insertText: 'List<${1:Type}>', isSnippet: true, kind: monaco.languages.CompletionItemKind.Interface, detail: 'Coleção ordenada java.util.List' },
        { label: 'ArrayList', insertText: 'ArrayList<>()', isSnippet: true, kind: monaco.languages.CompletionItemKind.Class, detail: 'Implementação de List' },
        { label: 'UUID', insertText: 'UUID', kind: monaco.languages.CompletionItemKind.Class, detail: 'java.util.UUID' },
        { label: 'LocalDateTime', insertText: 'LocalDateTime', kind: monaco.languages.CompletionItemKind.Class, detail: 'Data e hora sem timezone' },
        { label: 'OffsetDateTime', insertText: 'OffsetDateTime', kind: monaco.languages.CompletionItemKind.Class, detail: 'Data e hora com offset UTC' },
        // Jakarta Validation Annotations
        { label: '@Valid', insertText: '@Valid', isAnnotation: true, detail: 'Jakarta: Dispara validação de DTO/Bean' },
        { label: '@NotNull', insertText: '@NotNull(message = "${1:Campo obrigatório}")', isAnnotation: true, isSnippet: true, detail: 'Jakarta: Não permite valor nulo' },
        { label: '@NotEmpty', insertText: '@NotEmpty(message = "${1:Não pode ser vazio}")', isAnnotation: true, isSnippet: true, detail: 'Jakarta: Não nulo e não vazio' },
        { label: '@NotBlank', insertText: '@NotBlank(message = "${1:Campo não pode ficar em branco}")', isAnnotation: true, isSnippet: true, detail: 'Jakarta: String com caracteres visíveis' },
        { label: '@Size', insertText: '@Size(min = ${1:1}, max = ${2:100}, message = "${3:Tamanho inválido}")', isAnnotation: true, isSnippet: true, detail: 'Jakarta: Limites de tamanho' },
        { label: '@Min', insertText: '@Min(value = ${1:0}, message = "${2:Valor mínimo é 0}")', isAnnotation: true, isSnippet: true, detail: 'Jakarta: Valor numérico mínimo' },
        { label: '@Max', insertText: '@Max(value = ${1:100}, message = "${2:Valor máximo é 100}")', isAnnotation: true, isSnippet: true, detail: 'Jakarta: Valor numérico máximo' },
        { label: '@Email', insertText: '@Email(message = "${1:E-mail inválido}")', isAnnotation: true, isSnippet: true, detail: 'Jakarta: Formato de e-mail' },

        // Spring MVC Exceptions & Responses
        { label: '@RestControllerAdvice', insertText: '@RestControllerAdvice', isAnnotation: true, detail: 'Spring: Tratamento global de exceções' },
        { label: '@ExceptionHandler', insertText: '@ExceptionHandler(${1:Exception}.class)', isAnnotation: true, isSnippet: true, detail: 'Spring: Captura exceção em ControllerAdvice' },
        { label: '@ResponseStatus', insertText: '@ResponseStatus(org.springframework.http.HttpStatus.${1:NOT_FOUND})', isAnnotation: true, isSnippet: true, detail: 'Spring: Status HTTP padrão da exceção' },

        // Spring Security & Transactions
        { label: '@PreAuthorize', insertText: '@PreAuthorize("hasRole(\'${1:ADMIN}\')")', isAnnotation: true, isSnippet: true, detail: 'Spring Security: Controle de acesso' },
        { label: '@Transactional', insertText: '@Transactional', isAnnotation: true, detail: 'Spring: Gerenciamento de transação' },
        { label: '@Transactional(readOnly)', insertText: '@Transactional(readOnly = true)', isAnnotation: true, detail: 'Spring: Transação otimizada somente-leitura' },

        // Spring Data Domain
        { label: 'Page', insertText: 'Page<${1:Type}>', isSnippet: true, kind: monaco.languages.CompletionItemKind.Interface, detail: 'Spring Data: Interface de página' },
        { label: 'Pageable', insertText: 'Pageable', kind: monaco.languages.CompletionItemKind.Interface, detail: 'Spring Data: Interface de paginação' },
        { label: 'PageRequest', insertText: 'PageRequest.of(${1:0}, ${2:10})', isSnippet: true, kind: monaco.languages.CompletionItemKind.Class, detail: 'Spring Data: Instância de Pageable' },
        { label: 'Sort', insertText: 'Sort.by("${1:property}")', isSnippet: true, kind: monaco.languages.CompletionItemKind.Class, detail: 'Spring Data: Ordenação de consulta' },

        // Spring Database Exceptions & Error Handling Snippets
        { label: 'try-catch-db', insertText: 'try {\n\t${1:// Operação de persistência}\n} catch (org.springframework.dao.DataIntegrityViolationException ex) {\n\tthrow new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT, "${2:Violação de integridade nos dados}", ex);\n} catch (jakarta.persistence.EntityNotFoundException ex) {\n\tthrow new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "${3:Registro não encontrado}", ex);\n}', isSnippet: true, kind: monaco.languages.CompletionItemKind.Snippet, detail: 'Spring: try/catch para DataIntegrityViolation e EntityNotFound' },
        { label: 'DataIntegrityViolationException', insertText: 'DataIntegrityViolationException', kind: monaco.languages.CompletionItemKind.Class, detail: 'Spring DAO: Violação de integridade relacional' },
        { label: 'EntityNotFoundException', insertText: 'EntityNotFoundException', kind: monaco.languages.CompletionItemKind.Class, detail: 'Jakarta: Entidade não encontrada' },
        { label: 'ResponseStatusException', insertText: 'new ResponseStatusException(HttpStatus.${1:NOT_FOUND}, "${2:Mensagem}")', isSnippet: true, kind: monaco.languages.CompletionItemKind.Class, detail: 'Spring: Lança exceção com status HTTP' },

        // Modern Java 21 / 17 Constructs & Snippets
        { label: 'record', insertText: 'public record ${1:RecordName}(${2:Long id, String nome}) {}', isSnippet: true, kind: monaco.languages.CompletionItemKind.Snippet, detail: 'Java 17/21: Definição de Record imutável' },
        { label: 'switch-pattern', insertText: 'switch (${1:obj}) {\n\tcase ${2:String s} -> ${3:System.out.println(s);}\n\tdefault -> ${4:throw new IllegalStateException();}\n}', isSnippet: true, kind: monaco.languages.CompletionItemKind.Snippet, detail: 'Java 21: Pattern Matching no switch' },
        { label: 'virtual-threads', insertText: 'try (var executor = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {\n\texecutor.submit(() -> {\n\t\t${1:// Código concorrente em Virtual Thread}\n\t});\n}', isSnippet: true, kind: monaco.languages.CompletionItemKind.Snippet, detail: 'Java 21: Executor de Virtual Threads' },

        // Spring Data JPA Query Methods
        { label: 'findBy', insertText: 'findBy${1:Field}(${2:Type} ${3:field});', isSnippet: true, kind: monaco.languages.CompletionItemKind.Method, detail: 'Spring Data: Query method por campo' },
        { label: 'existsBy', insertText: 'existsBy${1:Field}(${2:Type} ${3:field});', isSnippet: true, kind: monaco.languages.CompletionItemKind.Method, detail: 'Spring Data: Verifica existência' },
        { label: 'countBy', insertText: 'countBy${1:Field}(${2:Type} ${3:field});', isSnippet: true, kind: monaco.languages.CompletionItemKind.Method, detail: 'Spring Data: Contagem por campo' },
        { label: 'deleteBy', insertText: 'deleteBy${1:Field}(${2:Type} ${3:field});', isSnippet: true, kind: monaco.languages.CompletionItemKind.Method, detail: 'Spring Data: Exclusão por campo' },

        // Collections & Utilities
        { label: 'Map', insertText: 'Map<${1:String}, ${2:Object}>', isSnippet: true, kind: monaco.languages.CompletionItemKind.Interface, detail: 'java.util.Map' },
        { label: 'HashMap', insertText: 'new HashMap<>()', isSnippet: true, kind: monaco.languages.CompletionItemKind.Class, detail: 'Instanciação java.util.HashMap' },
        { label: 'Set', insertText: 'Set<${1:Type}>', isSnippet: true, kind: monaco.languages.CompletionItemKind.Interface, detail: 'java.util.Set (elementos únicos)' },
        { label: 'HashSet', insertText: 'new HashSet<>()', isSnippet: true, kind: monaco.languages.CompletionItemKind.Class, detail: 'Instanciação java.util.HashSet' },
        { label: 'Collectors', insertText: 'Collectors.toList()', isSnippet: true, kind: monaco.languages.CompletionItemKind.Class, detail: 'java.util.stream.Collectors' },
        { label: 'BigDecimal', insertText: 'BigDecimal', kind: monaco.languages.CompletionItemKind.Class, detail: 'Ponto flutuante exato monetário' }
      ]

      // Extrai o package do arquivo atualmente aberto para resolver importações relativas
      const fullText = model.getValue()
      const currentPkgMatch = fullText.match(/^\s*package\s+([a-zA-Z0-9_.]+)\s*;/m)
      const currentFilePkg = currentPkgMatch ? currentPkgMatch[1] : ''
      const basePackage = currentFilePkg ? currentFilePkg.replace(/\.[^.]+$/, '') : ''

      // Extrai símbolos de escopo locais (atributos de classe, parâmetros de método e variáveis locais)
      const inScopeSymbols = extractInScopeSymbols(fullText, position.lineNumber)
      const inScopeSuggestions = inScopeSymbols.map((sym, idx) => ({
        label: sym.name,
        kind: sym.kind === 'Field' 
          ? monaco.languages.CompletionItemKind.Field 
          : monaco.languages.CompletionItemKind.Variable,
        insertText: sym.name,
        range,
        detail: sym.detail,
        sortText: `01_${String(idx).padStart(3, '0')}_${sym.name}`
      }))

      const mappedStaticSuggestions = suggestions.map(s => {
        const importTarget = STANDARD_JAVA_IMPORTS[s.label]
        const autoImportEdit = importTarget ? getAutoImportEdit(model, importTarget) : undefined

        return {
          label: s.label,
          kind: s.kind || (s.isAnnotation ? monaco.languages.CompletionItemKind.Snippet : monaco.languages.CompletionItemKind.Snippet),
          insertText: s.insertText,
          insertTextRules: s.isSnippet ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
          range: s.isAnnotation ? annotationRange : range,
          detail: s.detail || (s.isAnnotation ? 'Anotação' : 'Tipo'),
          additionalTextEdits: autoImportEdit,
          sortText: `07_${s.label}`
        }
      })

      // Classes dinâmicas do projeto (extraídas da árvore de arquivos) com auto-import
      const dynamicSuggestions = javaClasses.map(item => {
        let fullImport = ''
        if (item.packageName) {
          if (item.packageName.includes('.')) {
            fullImport = `${item.packageName}.${item.name}`
          } else if (basePackage) {
            fullImport = `${basePackage}.${item.packageName}.${item.name}`
          } else {
            fullImport = `${item.packageName}.${item.name}`
          }
        }

        const autoImportEdit = fullImport ? getAutoImportEdit(model, fullImport) : undefined

        return {
          label: item.name,
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: item.name,
          range,
          detail: fullImport ? `${fullImport}` : 'Classe do Projeto',
          additionalTextEdits: autoImportEdit,
          sortText: `05_${item.name}`
        }
      })

      // Sugestões inteligentes contextuais baseadas em Entidades (DTOs, Records, Services)
      const filename = model.uri.path.split('/').pop() || ''
      const entityName = resolveEntityNameFromFilename(filename)
      let entitySuggestions: any[] = []

      if (entityName) {
        const entityInfo = getCachedEntity(entityName)
        if (entityInfo) {
          entitySuggestions = generateEntityContextSuggestions(filename, entityInfo, range, monaco).map(s => ({
            ...s,
            sortText: `04_${s.label}`
          }))
        }
      }

      return { suggestions: [...inScopeSuggestions, ...mappedStaticSuggestions, ...dynamicSuggestions, ...entitySuggestions] }
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
