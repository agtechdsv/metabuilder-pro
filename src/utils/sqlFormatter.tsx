import React from 'react'

/**
 * Splits a comma-separated string by commas that are outside of parentheses or quotes.
 */
function splitTopLevelCommas(str: string): string[] {
  const parts: string[] = []
  let current = ''
  let depth = 0
  let inQuotes = false
  let quoteChar = ''

  for (let i = 0; i < str.length; i++) {
    const ch = str[i]
    if (inQuotes) {
      current += ch
      if (ch === quoteChar) inQuotes = false
    } else if (ch === "'" || ch === '"' || ch === '`') {
      inQuotes = true
      quoteChar = ch
      current += ch
    } else if (ch === '(') {
      depth++
      current += ch
    } else if (ch === ')') {
      if (depth > 0) depth--
      current += ch
    } else if (ch === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) {
    parts.push(current.trim())
  }
  return parts
}

/**
 * Capitalizes known SQL keywords.
 */
export function capitalizeKeywords(str: string): string {
  return str.replace(
    /\b(select|from|where|and|or|as|on|like|escape|offset|rows?|fetch|first|next|only|left\s+(?:outer\s+)?join|right\s+(?:outer\s+)?join|inner\s+join|cross\s+join|join|group\s+by|order\s+by|asc|desc|nulls\s+first|nulls\s+last|insert\s+into|values|update|set|delete\s+from|is\s+null|is\s+not\s+null|in|not\s+in|distinct|count|sum|avg|min|max|coalesce|lower|upper|trim|union\s+all|union)\b/gi,
    (match) => match.toUpperCase()
  )
}

/**
 * Formats an SQL query with 7-space column indentation and clause line-breaks,
 * matching standard enterprise SQL formatting (Image 2).
 */
export function formatSql(sql: string): string {
  if (!sql) return ''
  const trimmed = sql.trim()

  // Match SELECT <columns> FROM <rest>
  const selectMatch = trimmed.match(/^\s*select\s+([\s\S]*?)\s+from\s+([\s\S]*)$/i)
  if (selectMatch) {
    const rawCols = selectMatch[1]
    const rest = selectMatch[2]

    const cols = splitTopLevelCommas(rawCols)
    const formattedSelect = cols.length > 0
      ? `SELECT ${cols[0]}` + (cols.length > 1 ? ',\n' + cols.slice(1).map((c, idx, arr) => `       ${c}${idx < arr.length - 1 ? ',' : ''}`).join('\n') : '')
      : `SELECT ${rawCols}`

    let formattedRest = rest
      .replace(/\b(left\s+(?:outer\s+)?join)\b/gi, '\nLEFT JOIN')
      .replace(/\b(right\s+(?:outer\s+)?join)\b/gi, '\nRIGHT JOIN')
      .replace(/\b(inner\s+join)\b/gi, '\nINNER JOIN')
      .replace(/\b(cross\s+join)\b/gi, '\nCROSS JOIN')
      .replace(/\b(join)\b/gi, '\nJOIN')
      .replace(/\b(where)\b/gi, '\nWHERE')
      .replace(/\b(and)\b/gi, '\n  AND')
      .replace(/\b(or)\b/gi, '\n  OR')
      .replace(/\b(group\s+by)\b/gi, '\nGROUP BY')
      .replace(/\b(having)\b/gi, '\nHAVING')
      .replace(/\b(order\s+by)\b/gi, '\nORDER BY')
      .replace(/\b(offset\s+\S+\s+rows\s+fetch\s+(?:first|next)\s+\S+\s+rows\s+only)\b/gi, '\n$1')
      .replace(/\b(offset\s+\S+(?:\s+rows)?)(?!\s+fetch)\b/gi, '\n$1')
      .replace(/\b(fetch\s+(?:first|next)\s+\S+\s+rows\s+only)\b/gi, '\n$1')
      .replace(/\b(limit\s+\S+)\b/gi, '\nLIMIT $1')

    const fullSql = `${formattedSelect}\nFROM ${formattedRest.trim()}`
    return capitalizeKeywords(fullSql)
  }

  // Match INSERT INTO ... VALUES ...
  const insertMatch = trimmed.match(/^\s*insert\s+into\s+([\s\S]*?)\s+values\s*([\s\S]*)$/i)
  if (insertMatch) {
    return `INSERT INTO ${insertMatch[1].trim()}\nVALUES ${insertMatch[2].trim()}`
  }

  // Match UPDATE ... SET ... WHERE ...
  const updateMatch = trimmed.match(/^\s*update\s+([\s\S]*?)\s+set\s+([\s\S]*?)(?:\s+where\s+([\s\S]*))?$/i)
  if (updateMatch) {
    let res = `UPDATE ${updateMatch[1].trim()}\nSET ${updateMatch[2].trim()}`
    if (updateMatch[3]) {
      res += `\nWHERE ${updateMatch[3].trim()}`
    }
    return capitalizeKeywords(res)
  }

  // Match DELETE FROM ... WHERE ...
  const deleteMatch = trimmed.match(/^\s*delete\s+from\s+([\s\S]*?)(?:\s+where\s+([\s\S]*))?$/i)
  if (deleteMatch) {
    let res = `DELETE FROM ${deleteMatch[1].trim()}`
    if (deleteMatch[2]) {
      res += `\nWHERE ${deleteMatch[2].trim()}`
    }
    return capitalizeKeywords(res)
  }

  return capitalizeKeywords(trimmed)
}

/**
 * Parses a raw database log line (e.g., Hibernate SQL or parameter binding)
 * into a clean header and body, separating padding spaces before ':'.
 */
export interface ParsedDbLog {
  isDbLog: boolean
  isQuery: boolean
  isParameterBind: boolean
  header?: string
  content: string
}

export function parseDbLogLine(rawText: string): ParsedDbLog {
  const clean = rawText.trim()

  // 1. Match Logback logger with padded spaces before ':':
  // e.g. "2026-09-15T19:31:01.259-03:00 DEBUG 9236 --- [mcat-handler-16] org.hibernate.SQL                        : select..."
  // e.g. "2026-09-15T19:31:01.259-03:00 TRACE 9236 --- [mcat-handler-16] org.hibernate.orm.jdbc.bind              : binding parameter..."
  const dbLoggerMatch = clean.match(/^(.*?\b(?:[a-zA-Z0-9_.]*(?:hibernate|sql|jdbc|hikari)[a-zA-Z0-9_.]*))\s*:\s*([\s\S]*)$/i)
  if (dbLoggerMatch) {
    const header = `${dbLoggerMatch[1].trim()}:`
    const body = dbLoggerMatch[2].trim()
    const isQuery = /^(select|insert|update|delete|create|alter|drop)\b/i.test(body)
    const isParameterBind = /binding parameter/i.test(body)
    return {
      isDbLog: true,
      isQuery,
      isParameterBind,
      header,
      content: body
    }
  }

  // 2. Generic Spring Logback line with 2+ spaces before ':' followed by query or parameter binding
  const genericPaddedMatch = clean.match(/^(.*?)\s{2,}:\s*([\s\S]*)$/)
  if (genericPaddedMatch) {
    const body = genericPaddedMatch[2].trim()
    const isQuery = /^(select|insert|update|delete|create|alter|drop)\b/i.test(body)
    const isParameterBind = /binding parameter/i.test(body)
    if (isQuery || isParameterBind) {
      return {
        isDbLog: true,
        isQuery,
        isParameterBind,
        header: `${genericPaddedMatch[1].trim()}:`,
        content: body
      }
    }
  }

  // 3. [Hibernate] prefix
  const hibernatePrefixMatch = clean.match(/^(\[Hibernate\])\s*:?\s*([\s\S]*)$/i)
  if (hibernatePrefixMatch) {
    const body = hibernatePrefixMatch[2].trim()
    const isQuery = /^(select|insert|update|delete|create|alter|drop)\b/i.test(body)
    const isParameterBind = /binding parameter/i.test(body)
    return {
      isDbLog: true,
      isQuery,
      isParameterBind,
      header: '[Hibernate]:',
      content: body
    }
  }

  // 4. Executed query from Node.js (Prisma / Sequelize / TypeORM)
  const queryMatch = clean.match(/^(Executing \(default\)|Executed query.*?|prisma:query)\s*:?\s*([\s\S]*)$/i)
  if (queryMatch) {
    const header = queryMatch[1].trim().endsWith(':') ? queryMatch[1].trim() : `${queryMatch[1].trim()}:`
    return {
      isDbLog: true,
      isQuery: true,
      isParameterBind: false,
      header,
      content: queryMatch[2].trim()
    }
  }

  const isQuery = /^\s*(select|insert into|update|delete from|create table|alter table)\b/i.test(clean)
  const isParameterBind = /binding parameter/i.test(clean)
  return {
    isDbLog: isQuery || isParameterBind,
    isQuery,
    isParameterBind,
    content: clean
  }
}

/**
 * Tokenizes SQL for syntax highlighting:
 * - Keywords in Fuchsia/Pink
 * - Parameters '?', '$1', ':param' and numbers in Amber
 * - String literals in Emerald
 * - Columns / Identifiers in Cyan
 */
export function SqlHighlight({ sql }: { sql: string }) {
  const lines = sql.split('\n')
  return (
    <div className="font-mono text-[11px] leading-relaxed select-text">
      {lines.map((line, lineIdx) => {
        const indentMatch = line.match(/^(\s*)(.*)$/)
        const indent = indentMatch ? indentMatch[1] : ''
        const rest = indentMatch ? indentMatch[2] : line

        const tokens = rest.split(/(\b(?:SELECT|FROM|WHERE|AND|OR|AS|ON|LIKE|ESCAPE|OFFSET|ROWS?|FETCH|FIRST|NEXT|ONLY|LEFT|RIGHT|INNER|CROSS|JOIN|GROUP BY|ORDER BY|ASC|DESC|INSERT INTO|INSERT|VALUES|UPDATE|SET|DELETE FROM|DELETE|IS NULL|IS NOT NULL|NOT|IN|DISTINCT)\b|\?|\$[0-9]+|:[a-zA-Z_][a-zA-Z0-9_]*|'[^']*'|"[^"]*"|\b\d+\b)/g)

        return (
          <div key={lineIdx} className="whitespace-pre">
            {indent}
            {tokens.map((token, tokIdx) => {
              if (!token) return null
              const upper = token.toUpperCase()
              if (
                ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'AS', 'ON', 'LIKE', 'ESCAPE', 'OFFSET', 'ROWS', 'ROW', 'FETCH', 'FIRST', 'NEXT', 'ONLY', 'LEFT', 'RIGHT', 'INNER', 'CROSS', 'JOIN', 'GROUP BY', 'ORDER BY', 'ASC', 'DESC', 'INSERT INTO', 'INSERT', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'DELETE', 'IS NULL', 'IS NOT NULL', 'NOT', 'IN', 'DISTINCT'].includes(upper)
              ) {
                return (
                  <span key={tokIdx} className="text-fuchsia-400 font-bold">
                    {token}
                  </span>
                )
              }
              if (token === '?' || /^\$[0-9]+$/.test(token) || /^:[a-zA-Z_][a-zA-Z0-9_]*$/.test(token) || /^\d+$/.test(token)) {
                return (
                  <span key={tokIdx} className="text-amber-400 font-semibold">
                    {token}
                  </span>
                )
              }
              if (/^'[^']*'$/.test(token) || /^"[^"]*"$/.test(token)) {
                return (
                  <span key={tokIdx} className="text-emerald-400">
                    {token}
                  </span>
                )
              }
              return (
                <span key={tokIdx} className="text-cyan-200/90">
                  {token}
                </span>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Beautifully highlights parameter bindings:
 * e.g. "binding parameter (1:INTEGER) <- [0]"
 */
export function ParameterBindHighlight({ text }: { text: string }) {
  const match = text.match(/^(binding parameter\s*)(\([^)]+\))(\s*<-\s*)(\[[\s\S]*\])$/i)
  if (match) {
    return (
      <div className="font-mono text-[11px] leading-relaxed select-text flex items-center gap-1.5 flex-wrap">
        <span className="text-neutral-400">{match[1]}</span>
        <span className="text-amber-300 font-semibold bg-amber-950/40 px-1 py-0.5 rounded border border-amber-800/40">{match[2]}</span>
        <span className="text-fuchsia-400 font-bold">{match[3].trim()}</span>
        <span className="text-emerald-300 font-semibold bg-emerald-950/40 px-1 py-0.5 rounded border border-emerald-800/40">{match[4]}</span>
      </div>
    )
  }

  return (
    <div className="font-mono text-[11px] text-emerald-300/90 leading-relaxed select-text">
      {text}
    </div>
  )
}
