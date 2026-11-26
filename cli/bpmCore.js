'use strict'

/**
 * Núcleo do motor de BPM (Automações): JavaScript PURO, sem dependências além de módulos nativos do Node, para ser usado em dois lugares com o MESMO comportamento:
 *  - o Agente CLI (cli/bpmEngine.js, que liga as portas à plataforma: Supabase, API de e-mail e de execuções);
 *  - o app Node exportado (lib/bpm/core.js, copiado pelo gerador; ver scripts/gen-bpm-runtime.mjs), com as portas ligadas ao banco do app, ao SMTP do cliente e à
 *    tabela mb_bpm_runs.
 * Tipos em src/lib/bpm/bpmCore.d.ts. Fixtures de conformidade (fluxo + dado -> o que deve acontecer) em src/lib/bpm/conformance/*.json: o porte para Java
 * precisa passar nas mesmas.
 *
 * O núcleo não conhece Supabase, axios, chalk, node-cron nem banco nenhum: tudo isso chega pelas PORTAS (objeto passado ao construtor):
 *   db         { dialect: 'postgres' | 'oracle', query(sql, params) -> Promise<linhas[]> }            (obrigatória)
 *   models     { tableOf(modelId) -> Promise<string|null>, isKnownTable?(nome) -> Promise<boolean> }  (obrigatória; isKnownTable restringe as tabelas lidas por {{tabela.campo}})
 *   http       { request({ method, url, headers, data, timeout }) } -> { status, statusText }; em falha, lança erro com `status` quando houver
 *   mail       { send({ to, subject, body, template }), fallbackTo?() -> string }                    (body já com <br/>; o adaptador aplica o modelo de e-mail)
 *   recipients { resolveSystem(nodeData) -> Promise<string> }   e-mails (separados por vírgula) dos usuários e grupos do sistema; sem a porta, nenhum
 *   scheduler  { schedule(cron, fn) -> { stop() } }
 *   runs       { report(execução) }                              registro de cada execução; falha aqui nunca derruba nem atrasa o fluxo
 *   log        { debug, info, ok, warn, error, sql, danger, mail }  (todas opcionais)
 *   verbose    false = registro mínimo: os dados dos registros (dados pessoais) não vão para o log (padrão: true, como no CLI)
 */

const { AsyncLocalStorage } = require('async_hooks')

/** Passos máximos de um fluxo; acima disso é "laço" e o fluxo é interrompido. */
const MAX_STEPS = 100
/** Tempo máximo de uma chamada de webhook de saída. */
const WEBHOOK_TIMEOUT_MS = 10000

/** Nome de campo/coluna vindo da configuração do fluxo: só letras, números e _ (o resto é descartado). */
const safeIdent = (name) => String(name == null ? '' : name).replace(/[^a-zA-Z0-9_]/g, '')

const toList = (raw) => {
  const list = typeof raw === 'string' ? [raw] : (Array.isArray(raw) ? raw : [])
  return list.map(t => String(t).toUpperCase())
}

/** Corpo de mensagem (HTML do editor) → texto simples para o aviso na tela. */
const htmlToText = (html) => String(html == null ? '' : html)
  .replace(/<\s*br\s*\/?>/gi, '\n')
  .replace(/<\/\s*(p|div|li|tr|h[1-6])\s*>/gi, '\n')
  .replace(/<\/\s*t[dh]\s*>/gi, ' | ')
  .replace(/<[^>]*>/g, '')
  .replace(/ \| *\n/g, '\n')
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/g, "'")
  .replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n')
  .trim()

// ===== Consultar dados (relatórios agendados) =====
const QUERY_DEFAULT_ROWS = 200
const QUERY_MAX_ROWS = 5000
const QUERY_BODY_ROWS = 200 // linhas da tabela no corpo do e-mail; o restante só vai na planilha anexa
const QUERY_TIMEOUT_MS = 60000
const QUERY_OPS = new Set(['=', '==', '!=', '<>', '>', '<', '>=', '<='])
const AGG_FNS = { count: 'COUNT', sum: 'SUM', avg: 'AVG', min: 'MIN', max: 'MAX' }

/** Identificador de tabela/coluna: só letras, números e "_" (vem da configuração do fluxo e entra no SQL). null se inválido. */
const strictIdent = (name) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(String(name == null ? '' : name)) ? String(name) : null)
/** Nome do resultado da consulta ({{nome.tabela}}): minúsculas, números e "_". */
const datasetNameOf = (name) => {
  const n = String(name || '').trim().toLowerCase()
  return /^[a-z][a-z0-9_]{0,30}$/.test(n) ? n : 'consulta'
}

/**
 * Data relativa de um filtro: "agora menos N horas/dias/semanas/meses" ou o início de hoje, da semana (segunda-feira),
 * da semana passada, do mês, do mês passado e do ano. Usa o relógio da máquina do Agente. null se o tipo for desconhecido.
 */
function relativeDate(cfg, now = new Date()) {
  const d = new Date(now.getTime())
  const midnight = (x) => { x.setHours(0, 0, 0, 0); return x }
  switch (cfg && cfg.relKind) {
    case 'now_minus': {
      const n = Math.max(0, Math.min(100000, Number(cfg.relAmount) || 0))
      if (cfg.relUnit === 'hours') d.setHours(d.getHours() - n)
      else if (cfg.relUnit === 'weeks') d.setDate(d.getDate() - 7 * n)
      else if (cfg.relUnit === 'months') d.setMonth(d.getMonth() - n)
      else d.setDate(d.getDate() - n)
      return d
    }
    case 'start_of_today': return midnight(d)
    case 'start_of_week': midnight(d); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d
    case 'start_of_last_week': midnight(d); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7); return d
    case 'start_of_month': midnight(d); d.setDate(1); return d
    case 'start_of_last_month': midnight(d); d.setDate(1); d.setMonth(d.getMonth() - 1); return d
    case 'start_of_year': midnight(d); d.setMonth(0, 1); return d
    default: return null
  }
}

/**
 * Cron de um agendamento "A cada N minutos/horas/dias". Minutos e horas seguem o relógio (a cada 2 horas: 0h, 2h, 4h...);
 * dias rodam no horário informado. '' se a configuração for inválida.
 */
function intervalCron(sched) {
  const n = Math.floor(Number(sched && sched.every))
  if (!Number.isFinite(n) || n < 1) return ''
  switch (sched.unit) {
    case 'minutes': return n <= 59 ? `*/${n} * * * *` : ''
    case 'hours': return n <= 23 ? `0 */${n} * * *` : ''
    case 'days': {
      if (n > 30) return ''
      const [h, m] = String(sched.time || '00:00').split(':')
      return `${Number(m) || 0} ${Number(h) || 0} */${n} * *`
    }
    default: return ''
  }
}

/** Data para gente: dd/MM/aaaa (com HH:mm se tiver hora). */
const humanDate = (v) => {
  const p = (n) => String(n).padStart(2, '0')
  const date = `${p(v.getDate())}/${p(v.getMonth() + 1)}/${v.getFullYear()}`
  return v.getHours() || v.getMinutes() || v.getSeconds() ? `${date} ${p(v.getHours())}:${p(v.getMinutes())}` : date
}

/** 1234.5 → "1.234,50" (formato brasileiro, sem depender do ICU do Node). */
const fmtNumber = (value, decimals) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return String(value)
  const [int, dec] = Math.abs(n).toFixed(decimals).split('.')
  return (n < 0 ? '-' : '') + int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (dec ? ',' + dec : '')
}

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const NUMERIC_TYPE = /numeric|decimal|double|real|float|money/i
const INTEGER_TYPE = /^(small|big)?int(eger)?\d*$|serial/i

/** Valor de uma célula para ler na tela/e-mail, conforme o tipo da coluna. */
function formatCell(value, type) {
  if (value === null || value === undefined) return ''
  const t = String(type || '')
  if (value instanceof Date) return isNaN(value.getTime()) ? '' : humanDate(value)
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (NUMERIC_TYPE.test(t)) return fmtNumber(value, 2)
  if (INTEGER_TYPE.test(t)) return fmtNumber(value, 0)
  if (/date|time/i.test(t) && typeof value === 'string') {
    const d = new Date(value)
    if (!isNaN(d.getTime())) return humanDate(d)
  }
  return String(value)
}

/**
 * Tabela HTML do resultado, para o corpo do e-mail. SEM quebras de linha (o envio troca "\n" por <br/> e quebraria a tabela).
 * Mostra no máximo `maxRows` linhas e avisa quantas ficaram de fora.
 */
function buildHtmlTable(dataset, maxRows = QUERY_BODY_ROWS) {
  const cols = dataset.columns || []
  const rows = dataset.rows || []
  if (rows.length === 0) return '<p>Nenhum registro encontrado.</p>'
  const th = 'style="text-align:left;padding:6px 8px;background:#f1f5f9;border:1px solid #e2e8f0;font-size:12px"'
  const head = '<tr>' + cols.map((c) => `<th ${th}>${escapeHtml(c.label || c.key)}</th>`).join('') + '</tr>'
  const shown = rows.slice(0, maxRows)
  const body = shown.map((r) => '<tr>' + cols.map((c) => {
    const numeric = NUMERIC_TYPE.test(String(c.type || '')) || INTEGER_TYPE.test(String(c.type || ''))
    return `<td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:12px;${numeric ? 'text-align:right;' : ''}">${escapeHtml(formatCell(r[c.key], c.type))}</td>`
  }).join('') + '</tr>').join('')
  const more = rows.length > shown.length ? `<p style="font-size:12px;color:#64748b">Mostrando ${shown.length} de ${rows.length} linhas.</p>` : ''
  return `<table style="border-collapse:collapse;width:100%">${head}${body}</table>${more}`
}

/** Espera `promise` no máximo `ms`; passado disso rejeita (a consulta não segura o Agente para sempre). */
function withTimeout(promise, ms, message) {
  let timer
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms) })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/** Quem agiu (vindo da sessão assinada): só textos curtos; sem id, não há usuário. */
const cleanActor = (a) => {
  if (!a || typeof a !== 'object' || typeof a.id !== 'string' || !a.id) return null
  const clip = (v) => (typeof v === 'string' && v ? v.slice(0, 200) : undefined)
  return { id: a.id.slice(0, 200), email: clip(a.email), name: clip(a.name) }
}

class BpmCore {
  constructor(ports) {
    if (!ports || !ports.db || typeof ports.db.query !== 'function') throw new Error('BpmCore: a porta "db" é obrigatória.')
    if (!ports.models || typeof ports.models.tableOf !== 'function') throw new Error('BpmCore: a porta "models" é obrigatória.')
    this.ports = ports
    const noop = () => {}
    this.log = { debug: noop, info: noop, ok: noop, warn: noop, error: noop, sql: noop, danger: noop, mail: noop, ...(ports.log || {}) }
    this.verbose = ports.verbose !== false
    this.runCtx = new AsyncLocalStorage()
    this.actorCtx = new AsyncLocalStorage() // quem agiu, durante o processamento de um evento
    this.workflows = []
    this.scheduledJobs = []
  }

  get dbType() { return this.ports.db.dialect }

  /** Os dados de um registro só vão para o log no modo detalhado (no exportado, são dados pessoais). */
  show(value) {
    if (!this.verbose) return '[omitido]'
    try { return JSON.stringify(value) } catch { return '[ilegível]' }
  }

  /** Anota uma falha que não interrompe o fluxo (webhook, e-mail): a execução termina, mas é reportada como erro. */
  noteIssue(message) {
    const ctx = this.runCtx.getStore()
    if (ctx && ctx.issues.length < 5) ctx.issues.push(String(message).slice(0, 400))
  }

  /** Troca a lista de fluxos ativos e refaz os agendamentos. */
  setWorkflows(list) {
    this.workflows = list || []
    this.clearScheduledJobs()
    this.initScheduledJobs()
  }

  clearScheduledJobs() {
    for (const job of this.scheduledJobs) {
      if (job && typeof job.stop === 'function') job.stop()
    }
    this.scheduledJobs = []
  }

  initScheduledJobs() {
    let cronCount = 0
    const scheduler = this.ports.scheduler

    for (const flow of this.workflows) {
      const flowData = flow.flow_data
      if (!flowData || !flowData.nodes) continue

      const triggerNodes = flowData.nodes.filter(n => n.type === 'trigger')
      for (const triggerNode of triggerNodes) {
        const triggerTypes = toList(triggerNode.data?.triggerType)

        if (triggerTypes.includes('SCHEDULED')) {
          const rawSchedules = triggerNode.data?.triggerSchedules || []

          for (const sched of rawSchedules) {
            let cronStr = ''
            let runOnce = false

            if (sched.type === 'recurring') {
              // days: [0, 1, 2] (Dom, Seg, Ter)
              const days = (sched.days && sched.days.length > 0) ? sched.days.join(',') : '*'
              const time = sched.time || '00:00'
              const [hour, min] = time.split(':')
              cronStr = `${min || '0'} ${hour || '0'} * * ${days}`
            } else if (sched.type === 'interval') {
              cronStr = intervalCron(sched)
              if (!cronStr) this.log.warn(`[BPM] Fluxo "${flow.name}": o agendamento "A cada" está inválido (informe um número e a unidade): ignorado.`)
            } else if (sched.type === 'once') {
              // dateTime: "2026-06-04T18:30" (só este campo vale para "Apenas uma vez"; dia da semana e horário são do recorrente)
              const dt = new Date(sched.dateTime)
              if (isNaN(dt.getTime())) {
                this.log.warn(`[BPM] Fluxo "${flow.name}": o agendamento "Apenas uma vez" está sem data e hora específicas: ignorado. Informe a data e a hora.`)
              } else if (dt.getTime() <= Date.now()) {
                this.log.warn(`[BPM] Fluxo "${flow.name}": o agendamento "Apenas uma vez" (${sched.dateTime}) já passou: ignorado.`)
              } else {
                cronStr = `${dt.getMinutes()} ${dt.getHours()} ${dt.getDate()} ${dt.getMonth() + 1} *`
                runOnce = true
              }
            }

            if (cronStr) {
              if (!scheduler || typeof scheduler.schedule !== 'function') {
                this.log.warn(`[BPM] Fluxo "${flow.name}" tem agendamento, mas este ambiente não tem agendador: ignorado.`)
                continue
              }
              let job = null
              job = scheduler.schedule(cronStr, async () => {
                // "Apenas uma vez" é uma vez só: o cron de data fixa repetiria no mesmo dia do ano seguinte
                if (runOnce && job && typeof job.stop === 'function') job.stop()
                this.log.info(`\n[BPM] ⏰ Agendamento disparado para o fluxo "${flow.name}"!`)
                const triggerTable = await this.getModelTable(triggerNode.data?.triggerModelId)
                await this.runFlow(flow, triggerNode, triggerTable || 'global', {}, 'agendamento')
              })
              this.scheduledJobs.push(job)
              cronCount++
            }
          }
        }
      }
    }

    if (cronCount > 0) this.log.ok(`[BPM] ${cronCount} gatilho(s) agendado(s) configurado(s) com sucesso.`)
  }

  /** Valor de um campo do registro (o banco pode devolver a coluna em outra caixa, como no Oracle). */
  rowField(row, name) {
    if (!row || !name) return undefined
    if (Object.prototype.hasOwnProperty.call(row, name)) return row[name]
    const wanted = String(name).toLowerCase()
    const key = Object.keys(row).find(k => k.toLowerCase() === wanted)
    return key === undefined ? undefined : row[key]
  }

  /** Igualdade tolerante entre o valor do banco e o digitado no Studio ("5" e 5.00 são iguais; vazio e nulo também). */
  sameValue(a, b) {
    const norm = (v) => (v === null || v === undefined) ? '' : (v instanceof Date ? v.toISOString() : String(v).trim())
    const x = norm(a), y = norm(b)
    if (x === y) return true
    if (x !== '' && y !== '' && Number.isFinite(Number(x)) && Number.isFinite(Number(y))) return Number(x) === Number(y)
    return false
  }

  /** "Restringir a um campo" (De/Para) do gatilho de edição: o campo precisa ter mudado e, se informados, o valor anterior (De) e o novo (Para) conferem. */
  fieldChangeMatches(triggerNode, actionType, newRow, oldRow) {
    const d = triggerNode.data || {}
    if (!d.triggerSpecificField || !d.triggerField) return true
    if (!/UPDATE/.test(String(actionType).toUpperCase())) return true // só vale para edição
    if (!oldRow || Object.keys(oldRow).length === 0) {
      this.log.warn(`[BPM] Gatilho restrito ao campo "${d.triggerField}", mas o valor anterior do registro não está disponível: não disparado.`)
      return false
    }
    const before = this.rowField(oldRow, d.triggerField)
    const after = this.rowField(newRow, d.triggerField)
    if (after === undefined) return false // a edição não trouxe esse campo: ele não mudou
    if (this.sameValue(before, after)) return false
    const from = d.triggerFromValue, to = d.triggerToValue
    const has = (v) => v !== undefined && v !== null && String(v).trim() !== ''
    if (has(from) && !this.sameValue(before, from)) return false
    if (has(to) && !this.sameValue(after, to)) return false
    return true
  }

  /** Algum fluxo ativo escuta a edição desta tabela restrita a um campo? (quem grava só precisa ler o registro anterior nesse caso) */
  async needsOldRow(tableName) {
    for (const flow of this.workflows || []) {
      for (const node of (flow.flow_data && flow.flow_data.nodes) || []) {
        if (node.type !== 'trigger' || !node.data || !node.data.triggerSpecificField || !node.data.triggerField) continue
        if (!toList(node.data.triggerType).some(t => /UPDATE/.test(t))) continue
        if ((await this.getModelTable(node.data.triggerModelId)) === tableName) return true
      }
    }
    return false
  }

  async getModelTable(modelId) {
    if (!modelId) return null
    const table = await this.ports.models.tableOf(modelId)
    this.log.debug(`[BPM-DEBUG] getModelTable chamou com modelId=${modelId}. Encontrado=${!!table}`)
    return table || null
  }

  async isKnownTable(table) {
    const fn = this.ports.models.isKnownTable
    return typeof fn === 'function' ? !!(await fn.call(this.ports.models, table)) : true
  }

  /**
   * Valor para texto lido por gente (e-mail, mensagem): data vira dd/MM/aaaa (com HH:mm se tiver hora), no lugar do texto cru do JavaScript
   * ("Wed Nov 25 2026 00:00:00 GMT-0300"). Fora disso o valor segue como veio.
   */
  humanValue(v) {
    if (!(v instanceof Date) || isNaN(v.getTime())) return v
    return humanDate(v)
  }

  /**
   * Variáveis do sistema (não vêm de tabela): {{sistema.data}}, {{sistema.hora}}, {{sistema.data_hora}} e do usuário que agiu:
   * {{usuario.id}}, {{usuario.nome}}, {{usuario.email}}. Em texto lido por gente (e-mail, mensagem) a data sai dd/MM/aaaa;
   * nos demais usos (filtro, valor gravado) sai ISO (aaaa-MM-dd), que o banco entende. Desconhecida ou sem usuário: undefined (fica literal).
   */
  specialVariable(table, field, human) {
    // resultado de uma ação "Consultar dados" desta execução: {{nome.tabela}} (HTML) e {{nome.total}} (quantidade de linhas)
    const store = this.runCtx.getStore()
    const dataset = store && store.datasets && store.datasets[table]
    if (dataset) {
      if (field === 'total') return String(dataset.total)
      if (field === 'tabela') return buildHtmlTable(dataset, QUERY_BODY_ROWS)
      return undefined
    }
    if (table === 'sistema') {
      const now = new Date()
      const p = (n) => String(n).padStart(2, '0')
      const iso = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
      const br = `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()}`
      const hm = `${p(now.getHours())}:${p(now.getMinutes())}`
      const hms = `${hm}:${p(now.getSeconds())}`
      if (field === 'data') return human ? br : iso
      if (field === 'hora') return human ? hm : hms
      if (field === 'data_hora') return human ? `${br} ${hm}` : `${iso} ${hms}`
      return undefined
    }
    if (table === 'usuario') {
      const actor = this.actorCtx.getStore()
      if (!actor) return undefined
      if (field === 'id') return actor.id
      if ((field === 'nome' || field === 'name') && actor.name) return actor.name
      if (field === 'email' && actor.email) return actor.email
    }
    return undefined
  }

  async replaceVariables(text, triggerTable, triggerData, actionTable = null, actionData = null, human = false) {
    if (typeof text !== 'string') return text

    // 1. Encontrar quais tabelas extras estão sendo referenciadas
    const regex = /\{\{([^}]+)\}\}/g
    let match
    const extraTables = new Set()
    while ((match = regex.exec(text)) !== null) {
      const parts = match[1].split('.')
      if (parts.length === 2) {
        const table = parts[0]
        if (table !== triggerTable && table !== actionTable && table !== 'webhook' && table !== 'sistema' && table !== 'usuario' && !(this.runCtx.getStore() && this.runCtx.getStore().datasets && this.runCtx.getStore().datasets[table])) {
          extraTables.add(table)
        }
      }
    }

    // 2. Buscar as foreign keys na tabela de trigger
    const extraData = {}
    for (const table of extraTables) {
      // só tabelas dos modelos do projeto: o nome vem do texto do fluxo e entra no SQL
      if (!(await this.isKnownTable(table))) {
        this.log.debug(`[BPM-DEBUG] Tabela '${table}' não é um modelo do projeto: ignorada.`)
        continue
      }
      let fkName = table.endsWith('s') ? table.slice(0, -1) + '_id' : table + '_id'

      // Fallbacks se o fkName padrão não existir em triggerData
      let fkValue = triggerData ? triggerData[fkName] : null

      if (!fkValue) {
        if (triggerData && triggerData[`${table}_id`]) { fkName = `${table}_id`; fkValue = triggerData[fkName] }
        else if (triggerData && triggerData['id_' + table]) { fkName = 'id_' + table; fkValue = triggerData[fkName] }
        else if (actionData && actionData[fkName]) { fkValue = actionData[fkName] }
        else if (actionData && actionData[`${table}_id`]) { fkName = `${table}_id`; fkValue = actionData[fkName] }
        else if (actionData && actionData['id_' + table]) { fkName = 'id_' + table; fkValue = actionData[fkName] }
      }

      this.log.debug(`[BPM-DEBUG] Tentando resolver tabela extra '${table}'. Usando fkName='${fkName}'. Valor='${this.verbose ? fkValue : '[omitido]'}'`)

      if (fkValue) {
        try {
          const q = this.dbType === 'oracle' ? `SELECT * FROM "${table}" WHERE "id" = :1 FETCH FIRST 1 ROWS ONLY` : `SELECT * FROM "${table}" WHERE "id" = $1 LIMIT 1`
          const rows = await this.executeQuery(q, [fkValue])
          if (rows.length > 0) {
            extraData[table] = rows[0]
            this.log.debug(`[BPM-DEBUG] Dados extras carregados para '${table}' com sucesso!`)
          } else {
            this.log.debug(`[BPM-DEBUG] Nenhum registro encontrado na tabela '${table}' com id=${this.verbose ? fkValue : '[omitido]'}`)
          }
        } catch (e) {
          this.log.debug(`[BPM-DEBUG] Erro ao buscar FK ${fkName} na tabela ${table}: ${e.message}`)
        }
      } else {
        this.log.debug(`[BPM-DEBUG] FK '${fkName}' não encontrada nos dados de origem: ${this.show(triggerData)}`)
      }
    }

    // 3. Substituir no texto final
    const out = v => (human ? this.humanValue(v) : v)
    return text.replace(regex, (m, path) => {
      const parts = path.split('.')
      if (parts.length === 2) {
        const table = parts[0]
        const field = parts[1]
        if (table === triggerTable && triggerData && triggerData[field] !== undefined) return out(triggerData[field])
        if (table === actionTable && actionData && actionData[field] !== undefined) return out(actionData[field])
        const special = this.specialVariable(table, field, human)
        if (special !== undefined) return special
        if (extraData[table] && extraData[table][field] !== undefined) return out(extraData[table][field])
      }
      return m // Mantém original se não achar
    })
  }

  async executeQuery(sql, params = []) {
    const rows = await this.ports.db.query(sql, params)
    return rows || []
  }

  evaluateCondition(node, triggerTable, triggerData) {
    // grupo sem nenhuma regra é como se não existisse (o Studio deixa grupos vazios); sem grupo útil, a condição passa
    const groups = (node.data?.conditionGroups || []).filter(g => g && Array.isArray(g.rules) && g.rules.length > 0)
    if (groups.length === 0) return true

    // Cada grupo se resolve sozinho (regras ligadas por E/OU do grupo); os grupos se juntam da esquerda para a direita, pelo E/OU que o
    // Studio guarda em cada grupo a partir do segundo (groupLogic; sem ele, E). Não há precedência: ((G1 op G2) op G3).
    let result = this.evaluateConditionGroup(groups[0], triggerData)
    for (let i = 1; i < groups.length; i++) {
      const next = this.evaluateConditionGroup(groups[i], triggerData)
      result = String(groups[i].groupLogic).toUpperCase() === 'OR' ? (result || next) : (result && next)
    }
    this.log.info(`[BPM-CONDITION] Condição final resultou em: ${result}`)
    return result
  }

  evaluateConditionGroup(group, triggerData) {
    const rules = (group && group.rules) || []

    let isGroupTrue = group.logic === 'AND' ? true : false

    for (const rule of rules) {
      const field = rule.field
      const operator = rule.operator
      let expectedValue = rule.value
      let actualValue = (triggerData || {})[field]
      // "<nome>.total" = quantidade de linhas do resultado de uma ação Consultar dados desta execução
      const dsMatch = /^([a-z][a-z0-9_]*)\.total$/.exec(String(field))
      if (dsMatch) {
        const store = this.runCtx.getStore()
        const ds = store && store.datasets && store.datasets[dsMatch[1]]
        if (ds) actualValue = ds.total
      }

      let isRuleTrue = false

      // Converte expectedValue se for numérico e actualValue for número
      if (typeof actualValue === 'number') {
        expectedValue = Number(expectedValue)
      } else if (actualValue instanceof Date) {
        // Lógica simplificada de data
      } else {
        expectedValue = String(expectedValue)
      }

      const actualStr = String(actualValue)

      switch (operator) {
        case '==': isRuleTrue = actualStr == String(expectedValue); break
        case '!=': isRuleTrue = actualStr != String(expectedValue); break
        case '>': isRuleTrue = Number(actualValue) > Number(expectedValue); break
        case '<': isRuleTrue = Number(actualValue) < Number(expectedValue); break
        case '>=': isRuleTrue = Number(actualValue) >= Number(expectedValue); break
        case '<=': isRuleTrue = Number(actualValue) <= Number(expectedValue); break
        // "contém": o texto do campo contém o valor, sem diferenciar maiúsculas de minúsculas; campo nulo ou ausente nunca contém
        case 'contains': isRuleTrue = actualValue !== null && actualValue !== undefined && String(actualValue).toLowerCase().includes(String(rule.value === undefined || rule.value === null ? '' : rule.value).toLowerCase()); break
      }

      this.log.info(`[BPM-CONDITION] Regra: Campo '${field}' (${this.verbose ? actualValue : '[omitido]'}) ${operator} Valor Esperado (${this.verbose ? expectedValue : '[omitido]'}) => Resultado: ${isRuleTrue}`)

      if (group.logic === 'AND') {
        isGroupTrue = isGroupTrue && isRuleTrue
      } else {
        isGroupTrue = isGroupTrue || isRuleTrue
      }
    }

    this.log.info(`[BPM-CONDITION] Grupo resultou em: ${isGroupTrue}`)
    return isGroupTrue
  }

  async buildFilters(actionFilters, triggerTable, triggerData) {
    if (!actionFilters || actionFilters.length === 0) return { where: '', params: [] }

    const clauses = []
    const params = []
    let paramIndex = 1
    const allowedOps = new Set(['=', '==', '!=', '<>', '>', '<', '>=', '<='])

    for (const filt of actionFilters) {
      if (!filt.field) continue
      const ident = safeIdent(filt.field)
      if (!ident) continue
      const field = `"${ident}"`
      const op = filt.operator === '==' ? '=' : filt.operator
      // operador vem da configuração do fluxo e entra no SQL: só os conhecidos
      if (!allowedOps.has(String(op))) continue
      const val = await this.replaceVariables(filt.value, triggerTable, triggerData)

      if (this.dbType === 'oracle') {
        clauses.push(`${field} ${op} :${paramIndex}`)
        params.push(val)
      } else {
        clauses.push(`${field} ${op} $${paramIndex}`)
        params.push(val)
      }
      paramIndex++
    }

    if (clauses.length === 0) return { where: '', params: [] }
    return { where: `WHERE ${clauses.join(' AND ')}`, params }
  }

  /**
   * SQL de um campo calculado (virtual) do caso de uso, já compilado pelo Studio (src/lib/bpm/virtualFields.ts): uma agregação sobre a
   * tabela filha (subconsulta correlacionada) ou uma fórmula linha a linha. Tudo é validado de novo aqui: o motor nunca interpreta
   * fórmula livre, só colunas (identificadores), números e + - * / ( ).
   */
  async virtualFieldSql(spec, alias) {
    if (!spec || typeof spec !== 'object' || !Array.isArray(spec.expr) || spec.expr.length === 0 || spec.expr.length > 200) {
      throw new Error('Consultar dados: campo calculado inválido.')
    }
    let depth = 0
    const sqlOf = (prefix) => spec.expr.map((tk) => {
      if (tk && tk.t === 'col' && strictIdent(tk.v)) return `"${prefix}"."${tk.v}"`
      if (tk && tk.t === 'num' && /^\d+(\.\d+)?$/.test(String(tk.v))) return String(tk.v)
      if (tk && tk.t === 'op' && ['+', '-', '*', '/', '(', ')'].includes(tk.v)) {
        if (tk.v === '(') depth++
        if (tk.v === ')') depth--
        if (depth < 0) throw new Error('Consultar dados: fórmula do campo calculado com parênteses errados.')
        return tk.v
      }
      throw new Error('Consultar dados: fórmula do campo calculado com termo inválido.')
    }).join(' ')

    if (!spec.fn) {
      const expr = sqlOf(alias)
      if (depth !== 0) throw new Error('Consultar dados: fórmula do campo calculado com parênteses errados.')
      return `(${expr})`
    }
    const fn = AGG_FNS[spec.fn]
    const child = strictIdent(spec.childTable)
    const fk = strictIdent(spec.fk)
    const localKey = strictIdent(spec.localKey)
    if (!fn || !child || !fk || !localKey || !(await this.isKnownTable(child))) throw new Error('Consultar dados: campo calculado com relação inválida.')
    const expr = sqlOf('c')
    if (depth !== 0) throw new Error('Consultar dados: fórmula do campo calculado com parênteses errados.')
    const agg = spec.fn === 'count' ? 'COUNT(*)' : spec.fn === 'sum' ? `COALESCE(SUM(${expr}), 0)` : `${fn}(${expr})`
    return `(SELECT ${agg} FROM "${child}" "c" WHERE "c"."${fk}" = "${alias}"."${localKey}")`
  }

  /**
   * Ação "Consultar dados": lê linhas do banco (SÓ LEITURA) e guarda o resultado na execução para as ações seguintes
   * ({{nome.tabela}}, {{nome.total}} e anexo de planilha/CSV/PDF no e-mail). O SQL é montado só com tabelas dos modelos do projeto,
   * colunas validadas e valores como parâmetros; há limite de linhas e de tempo. Campos calculados do caso de uso entram como
   * subconsulta (filtros sobre eles ficam numa camada externa). Devolve { stop: true } se for para não seguir (sem resultado).
   */
  async runQueryAction(node, triggerTable, triggerData) {
    const d = (node && node.data) || {}
    const name = datasetNameOf(d.queryName)
    const table = d.queryModelId ? await this.getModelTable(d.queryModelId) : null
    if (!table || !strictIdent(table) || !(await this.isKnownTable(table))) throw new Error('Consultar dados: escolha uma tabela do projeto.')

    const oracle = this.dbType === 'oracle'
    const params = []
    const bind = (value) => { params.push(value); return oracle ? `:${params.length}` : `$${params.length}` }

    // campos calculados do caso de uso (compilados pelo Studio) usados em colunas, filtros, valor agregado ou ordem
    const virtuals = d.queryVirtuals && typeof d.queryVirtuals === 'object' ? d.queryVirtuals : {}
    const isVirtual = (f) => typeof f === 'string' && /^virt_[A-Za-z0-9]+$/.test(f) && !!virtuals[f]
    const groupField = strictIdent(d.queryGroupBy)
    const grouping = !!groupField
    if (groupField && isVirtual(groupField)) throw new Error('Consultar dados: não dá para agrupar por um campo calculado (use-o como valor a somar ou calcular).')
    const aggFnName = AGG_FNS[d.queryAggregate] ? d.queryAggregate : 'count'
    const aggField = grouping && aggFnName !== 'count' ? strictIdent(d.queryAggregateField) : null
    const orderField = !grouping ? strictIdent(d.queryOrderBy) : null
    const cols = !grouping ? (d.queryColumns || []).filter((c) => strictIdent(c && c.field)) : []

    // campos de tabelas relacionadas (ex.: nome do cliente do pedido): LEFT JOIN pela chave estrangeira; vêm como colunas extras
    const joins = d.queryJoins && typeof d.queryJoins === 'object' ? d.queryJoins : {}
    const isJoined = (f) => typeof f === 'string' && /^rel_[A-Za-z0-9_]+$/.test(f) && !!joins[f]
    const usedJoins = new Set()
    const joinAlias = new Map()
    const noteJoin = (f) => { if (isJoined(f) && !usedJoins.has(f)) { usedJoins.add(f); joinAlias.set(f, 'rel' + usedJoins.size) } }
    for (const c of cols) noteJoin(c.field)
    for (const f of d.queryFilters || []) noteJoin(strictIdent(f && f.field))
    noteJoin(orderField)

    const used = new Set()
    for (const c of cols) if (isVirtual(c.field)) used.add(c.field)
    for (const f of d.queryFilters || []) if (isVirtual(strictIdent(f && f.field))) used.add(f.field)
    if (aggField && isVirtual(aggField)) used.add(aggField)
    if (orderField && isVirtual(orderField)) used.add(orderField)
    const wrapped = used.size > 0 || usedJoins.size > 0
    const outer = (f) => `"q"."${joinAlias.get(f) || f}"` // coluna da camada externa (quando há campo calculado ou relacionado)
    const plain = (f) => (wrapped ? `"t"."${f}"` : `"${f}"`) // coluna da tabela
    const colRef = (f) => (wrapped ? outer(f) : `"${f}"`) // coluna já no nível do SELECT

    // filtros (os de campo calculado vão para a camada externa)
    const innerWhere = []
    const outerWhere = []
    for (const f of d.queryFilters || []) {
      const field = strictIdent(f && f.field)
      if (!field) continue
      let value
      if (f.valueType === 'relative') {
        value = relativeDate(f)
        if (!value) continue
      } else {
        value = await this.replaceVariables(f.value == null ? '' : String(f.value), triggerTable, triggerData)
      }
      const virt = isVirtual(field) || isJoined(field)
      const ref = virt ? outer(field) : plain(field)
      let cond
      if (f.operator === 'contains') {
        cond = oracle ? `LOWER(${ref}) LIKE LOWER(${bind('%' + String(value) + '%')})` : `CAST(${ref} AS text) ILIKE ${bind('%' + String(value) + '%')}`
      } else {
        const op = f.operator === '==' ? '=' : (f.operator || '=')
        if (!QUERY_OPS.has(String(op))) continue
        cond = `${ref} ${op} ${bind(value)}`
      }
      ;(virt ? outerWhere : innerWhere).push(cond)
    }

    const limit = Math.max(1, Math.min(QUERY_MAX_ROWS, Math.floor(Number(d.queryLimit)) || QUERY_DEFAULT_ROWS))
    const limitSql = oracle ? ` FETCH FIRST ${limit} ROWS ONLY` : ` LIMIT ${limit}`
    const dir = String(d.queryOrderDir).toLowerCase() === 'desc' ? 'DESC' : 'ASC'

    // origem: a tabela, ou (com campo calculado) a tabela com os cálculos como colunas extras
    let from
    if (wrapped) {
      const extra = []
      for (const key of used) extra.push(`${await this.virtualFieldSql(virtuals[key], 't')} AS "${key}"`)
      const joinSql = []
      let n = 0
      for (const key of usedJoins) {
        const spec = joins[key] || {}
        const fk = strictIdent(spec.fk)
        const col = strictIdent(spec.field)
        const pk = strictIdent(spec.pk || 'id')
        const target = spec.modelId ? await this.getModelTable(spec.modelId) : null
        if (!fk || !col || !pk || !target || !strictIdent(target) || !(await this.isKnownTable(target))) throw new Error('Consultar dados: campo de tabela relacionada inválido.')
        n++
        joinSql.push(` LEFT JOIN "${target}" "j${n}" ON "j${n}"."${pk}" = "t"."${fk}"`)
        extra.push(`"j${n}"."${col}" AS "${joinAlias.get(key)}"`)
      }
      const innerSql = `SELECT "t".*, ${extra.join(', ')} FROM "${table}" "t"${joinSql.join('')}${innerWhere.length ? ` WHERE ${innerWhere.join(' AND ')}` : ''}`
      from = `(${innerSql}) "q"`
    } else {
      from = `"${table}"`
    }
    const whereSql = wrapped
      ? (outerWhere.length ? ` WHERE ${outerWhere.join(' AND ')}` : '')
      : (innerWhere.length ? ` WHERE ${innerWhere.join(' AND ')}` : '')

    let sql
    let columns
    if (grouping) {
      // agrupar e calcular: uma linha por grupo
      if (aggFnName !== 'count' && !aggField) throw new Error('Consultar dados: escolha o campo a somar, calcular a média ou comparar.')
      const expr = aggFnName === 'count' ? 'COUNT(*)' : `${AGG_FNS[aggFnName]}(${colRef(aggField)})`
      sql = `SELECT ${colRef(groupField)} AS "grupo", ${expr} AS "valor" FROM ${from}${whereSql} GROUP BY ${colRef(groupField)} ORDER BY "valor" ${dir === 'ASC' && d.queryOrderDir ? 'ASC' : 'DESC'}${limitSql}`
      columns = [
        { key: 'grupo', label: d.queryGroupTitle || 'Grupo', type: 'text' },
        { key: 'valor', label: d.queryValueTitle || (aggFnName === 'count' ? 'Quantidade' : 'Total'), type: aggFnName === 'count' ? 'integer' : (d.queryValueType || 'numeric') },
      ]
    } else {
      if (cols.length === 0) throw new Error('Consultar dados: escolha ao menos uma coluna.')
      sql = `SELECT ${cols.map((c) => colRef(c.field)).join(', ')} FROM ${from}${whereSql}${orderField ? ` ORDER BY ${colRef(orderField)} ${dir}` : ''}${limitSql}`
      columns = cols.map((c) => ({ key: c.field, label: c.label || c.field, type: isVirtual(c.field) ? 'numeric' : (c.type || 'text') }))
    }

    this.log.sql(`[BPM] Consultando dados: ${sql} | Parametros: ${this.show(params)}`)
    const raw = await withTimeout(this.executeQuery(sql, params), QUERY_TIMEOUT_MS, `Consultar dados: tempo limite de ${QUERY_TIMEOUT_MS / 1000} s atingido.`)
    const rows = raw.map((r) => (oracle ? Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), v])) : r))
    // campos relacionados voltam com o apelido curto da junção: devolve a chave que a coluna do resultado usa
    for (const [key, alias] of joinAlias) for (const r of rows) r[key] = r[alias]

    // mostra o nome (em vez do id) quando o grupo é uma chave estrangeira
    if (grouping && d.queryGroupLabelModelId && strictIdent(d.queryGroupLabelField)) {
      const labelTable = await this.getModelTable(d.queryGroupLabelModelId)
      const ids = [...new Set(rows.map((r) => r.grupo).filter((v) => v !== null && v !== undefined))]
      if (labelTable && strictIdent(labelTable) && (await this.isKnownTable(labelTable)) && ids.length > 0) {
        const lp = ids.map((_, i) => (oracle ? `:${i + 1}` : `$${i + 1}`)).join(',')
        const labelRows = await withTimeout(
          this.executeQuery(`SELECT "id", "${d.queryGroupLabelField}" AS "rotulo" FROM "${labelTable}" WHERE "id" IN (${lp})`, ids),
          QUERY_TIMEOUT_MS, `Consultar dados: tempo limite de ${QUERY_TIMEOUT_MS / 1000} s atingido.`)
        const byId = new Map(labelRows.map((r) => [String(r.id ?? r.ID), r.rotulo ?? r.ROTULO]))
        for (const r of rows) r.grupo = byId.get(String(r.grupo)) ?? r.grupo
      }
    }

    const dataset = { name, columns, rows, total: rows.length }
    const store = this.runCtx.getStore()
    if (store) {
      if (!store.datasets) store.datasets = {}
      store.datasets[name] = dataset
    }
    this.log.ok(`[BPM] Consulta "${name}": ${rows.length} linha(s).`)

    if (d.querySkipWhenEmpty && rows.length === 0) {
      this.log.info(`[BPM] Consulta "${name}" sem resultado: o fluxo não continua.`)
      return { stop: true }
    }
    return undefined
  }

  /** Anexos do e-mail: a planilha (ou CSV) do resultado de uma consulta feita antes, no mesmo fluxo. */
  buildEmailAttachments(data) {
    if (!data || !data.emailAttachDataset) return []
    const name = datasetNameOf(data.emailAttachDataset)
    const store = this.runCtx.getStore()
    const dataset = store && store.datasets && store.datasets[name]
    if (!dataset) {
      this.log.error(`[BPM] Anexo: o resultado "${name}" não existe neste fluxo (coloque a ação Consultar dados antes do e-mail).`)
      this.noteIssue(`Anexo: resultado "${name}" não encontrado.`)
      return []
    }
    const format = ['csv', 'pdf'].includes(data.emailAttachFormat) ? data.emailAttachFormat : 'xlsx'
    const now = new Date()
    const p = (n) => String(n).padStart(2, '0')
    return [{ format, filename: `${name}-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.${format}`, dataset }]
  }

  async runNodeAction(node, triggerTable, triggerData) {
    const data = node.data || {}
    if (data.actionType === 'query') return await this.runQueryAction(node, triggerTable, triggerData)
    const actionTable = data.actionModelId ? await this.getModelTable(data.actionModelId) : null

    // Para update, a tabela é obrigatória. Para email, depende do tipo de destinatário.
    if (data.actionType === 'update' && !actionTable) {
      this.log.error('[BPM] Erro: Tabela alvo do UPDATE não encontrada no dicionário.')
      return
    }

    const { where, params } = await this.buildFilters(data.actionFilters, triggerTable, triggerData)

    if (data.actionType === 'update') {
      if (!where) {
        this.log.warn('[BPM] Cuidado: UPDATE ignorado por falta de filtros de segurança.')
        return // Evita update sem WHERE global
      }
      const fieldsToUpdate = data.actionFields || []
      if (fieldsToUpdate.length === 0) return

      const setClauses = []
      const updateParams = []
      let pIdx = 1

      for (const f of fieldsToUpdate) {
        const ident = safeIdent(f.field)
        if (!ident) continue
        const val = await this.replaceVariables(f.value, triggerTable, triggerData)
        setClauses.push(this.dbType === 'oracle' ? `"${ident}" = :${pIdx}` : `"${ident}" = $${pIdx}`)
        updateParams.push(val)
        pIdx++
      }
      if (setClauses.length === 0) return

      // Adiciona os parametros do WHERE no final
      const finalParams = [...updateParams]
      let finalWhere = where
      if (this.dbType === 'oracle') {
        for (const wp of params) {
          finalWhere = finalWhere.replace(`:${pIdx - updateParams.length}`, `:${pIdx}`)
          finalParams.push(wp)
          pIdx++
        }
      } else {
        for (const wp of params) {
          finalWhere = finalWhere.replace(`$${pIdx - updateParams.length}`, `$${pIdx}`)
          finalParams.push(wp)
          pIdx++
        }
      }

      const sql = `UPDATE "${actionTable}" SET ${setClauses.join(', ')} ${finalWhere}`
      this.log.sql(`[BPM] Executando Update: ${sql} | Parametros: ${this.show(finalParams)}`)
      await this.executeQuery(sql, finalParams)
    }
    else if (data.actionType === 'insert') {
      const fieldsToInsert = data.actionFields || []
      if (fieldsToInsert.length === 0) {
        this.log.warn('[BPM] Cuidado: INSERT ignorado pois não há campos mapeados.')
        return
      }

      const columns = []
      const values = []
      const insertParams = []
      let pIdx = 1

      for (const f of fieldsToInsert) {
        const ident = safeIdent(f.field)
        if (!ident) continue
        const val = await this.replaceVariables(f.value, triggerTable, triggerData)
        columns.push(`"${ident}"`)
        values.push(this.dbType === 'oracle' ? `:${pIdx}` : `$${pIdx}`)
        insertParams.push(val)
        pIdx++
      }
      if (columns.length === 0) {
        this.log.warn('[BPM] Cuidado: INSERT ignorado pois não há campos mapeados.')
        return
      }

      const sql = `INSERT INTO "${actionTable}" (${columns.join(', ')}) VALUES (${values.join(', ')})`
      this.log.sql(`[BPM] Executando Insert: ${sql} | Parametros: ${this.show(insertParams)}`)
      await this.executeQuery(sql, insertParams)
    }
    else if (data.actionType === 'delete') {
      if (!where) {
        this.log.warn('[BPM] Cuidado: DELETE ignorado por falta de filtros de segurança.')
        return // Evita delete sem WHERE global
      }

      const sql = `DELETE FROM "${actionTable}" ${where}`
      this.log.danger(`[BPM] Executando Delete: ${sql} | Parametros: ${this.show(params)}`)
      await this.executeQuery(sql, params)
    }
    else if (data.actionType === 'webhook') {
      let finalUrl = await this.replaceVariables(data.webhookUrl || '', triggerTable, triggerData)
      const method = (data.webhookMethod || 'POST').toUpperCase()
      let finalHeadersStr = await this.replaceVariables(data.webhookHeaders || '', triggerTable, triggerData)
      let finalBodyStr = await this.replaceVariables(data.webhookBody || '', triggerTable, triggerData)

      if (!finalUrl) {
        this.log.warn('[BPM] Cuidado: Webhook ignorado por falta de URL.')
        return
      }
      if (!this.ports.http || typeof this.ports.http.request !== 'function') {
        this.log.warn('[BPM] Webhook ignorado: este ambiente não tem a porta de HTTP.')
        this.noteIssue('Webhook não enviado: HTTP indisponível neste ambiente.')
        return
      }

      let headers = {}
      try {
        if (String(finalHeadersStr).trim()) headers = JSON.parse(finalHeadersStr)
      } catch (e) {
        this.log.warn('[BPM] Falha ao fazer parse do Webhook Headers (JSON inválido). Usando vazio.')
      }

      let bodyData = null
      try {
        if (String(finalBodyStr).trim()) bodyData = JSON.parse(finalBodyStr)
      } catch (e) {
        bodyData = finalBodyStr // Manda como texto plano se não for JSON válido
      }

      this.log.info(`[BPM] Disparando Webhook [${method}] para: ${finalUrl}`)

      try {
        const response = await this.ports.http.request({
          method,
          url: finalUrl,
          headers,
          data: ['POST', 'PUT', 'PATCH'].includes(method) ? bodyData : undefined,
          timeout: WEBHOOK_TIMEOUT_MS,
        })
        this.log.ok(`[ OK ] Webhook Retornou: ${response?.status} ${response?.statusText || ''}`.trim())
      } catch (webhookErr) {
        this.log.error(`[ ERRO ] Falha no Webhook: ${webhookErr.message}`)
        this.noteIssue(`Webhook ${method} ${finalUrl}: ${webhookErr.status ? 'HTTP ' + webhookErr.status : webhookErr.message}`)
      }
    }
    else if (data.actionType === 'email') {
      // 1. Busca os registros alvo para ler o e-mail ou variáveis
      let targetRows = [null] // Fallback se não tiver tabela alvo, roda 1 vez

      if (actionTable && where) {
        const sql = `SELECT * FROM "${actionTable}" ${where}`
        this.log.sql(`[BPM] Buscando alvos para e-mail: ${sql} | ${this.show(params)}`)
        targetRows = await this.executeQuery(sql, params)
      }

      if (data.emailRecipientType === 'table' && targetRows.length === 0) {
        this.log.warn('[BPM] Nenhum registro encontrado para disparar o e-mail.')
        return
      }

      for (const targetRow of targetRows) {
        const subject = await this.replaceVariables(data.actionSubject, triggerTable, triggerData, actionTable, targetRow, true)
        const body = await this.replaceVariables(data.actionBody, triggerTable, triggerData, actionTable, targetRow, true)

        let to = ''
        const recipientType = data.emailRecipientType || 'system'

        if (recipientType === 'table' && targetRow && data.actionEmailField) {
          to = targetRow[data.actionEmailField]
        } else if (recipientType === 'custom') {
          to = await this.replaceVariables(data.customEmailField, triggerTable, triggerData)
        } else if (recipientType === 'system') {
          const rec = this.ports.recipients
          if (rec && typeof rec.resolveSystem === 'function') {
            try { to = (await rec.resolveSystem(data)) || '' } catch (e) { this.log.error(`[BPM] Erro ao resolver destinatários do sistema: ${e.message}`) }
          }

          let specificEmails = ''
          if (data.emailSpecificUsers) {
            specificEmails = await this.replaceVariables(data.emailSpecificUsers, triggerTable, triggerData, actionTable, targetRow)
          }
          if (specificEmails) {
            to = to ? `${to},${specificEmails}` : specificEmails
          }

          if (!to) {
            const fallback = this.ports.mail && typeof this.ports.mail.fallbackTo === 'function' ? this.ports.mail.fallbackTo() : ''
            if (fallback) to = fallback
          }
        }

        if (!to) {
          this.log.error('[BPM] E-mail não enviado: Destinatário não encontrado.')
          this.noteIssue('E-mail não enviado: destinatário não encontrado.')
          continue
        }
        if (!this.ports.mail || typeof this.ports.mail.send !== 'function') {
          this.log.error('[BPM] E-mail não enviado: este ambiente não tem envio de e-mail configurado.')
          this.noteIssue('E-mail não enviado: envio de e-mail não configurado.')
          continue
        }

        const templateType = data.emailTemplate || 'free'
        this.log.mail(`[BPM] Disparando e-mail para: ${this.verbose ? to : '[omitido]'} (Template: ${templateType})`)
        try {
          const attachments = this.buildEmailAttachments(data)
          await this.ports.mail.send({ to, subject, body: String(body).replace(/\n/g, '<br/>'), template: templateType, ...(attachments.length ? { attachments } : {}) })
          this.log.ok('[BPM] E-mail disparado com sucesso!')
        } catch (err) {
          this.log.error(`[BPM] Erro ao enviar e-mail: ${err.message}`)
          this.noteIssue(`E-mail para ${this.verbose ? to : '[omitido]'}: ${err.message}`)
        }
      }
    }
  }

  /**
   * Aba "Mensagem" da ação: depois que a ação roda sem problema, monta o texto (assunto + corpo, com as variáveis {{tabela.campo}})
   * e o guarda para ir à tela de quem fez a gravação. Sem assunto e sem corpo, não há mensagem.
   */
  async queueSuccessMessage(node, triggerTable, triggerData) {
    const d = (node && node.data) || {}
    // campo único (successMessage); fluxos antigos têm assunto + corpo: viram as duas linhas do mesmo aviso
    const raw = d.successMessage != null ? [d.successMessage] : [d.successMessageSubject, d.successMessageBody]
    const parts = []
    for (const piece of raw) parts.push(htmlToText(await this.replaceVariables(piece || '', triggerTable, triggerData, null, null, true)))
    const text = parts.filter(Boolean).join('\n')
    if (!text) return
    const type = ['success', 'info', 'warning'].includes(d.successMessageType) ? d.successMessageType : 'success'
    const store = this.runCtx.getStore()
    if (store && store.messages) store.messages.push({ text, type })
  }

  async traverseGraph(flowData, startNode, triggerTable, triggerData) {
    const queue = [startNode]
    let maxSteps = MAX_STEPS

    while (queue.length > 0 && maxSteps > 0) {
      maxSteps--
      const currentNode = queue.shift()

      if (currentNode.type === 'condition') {
        const isTrue = this.evaluateCondition(currentNode, triggerTable, triggerData)
        const edges = flowData.edges.filter(e => e.source === currentNode.id && e.sourceHandle === String(isTrue))

        for (const edge of edges) {
          const targetNode = flowData.nodes.find(n => n.id === edge.target)
          if (targetNode) queue.push(targetNode)
        }
      }
      else if (currentNode.type === 'action') {
        const store = this.runCtx.getStore()
        const issuesBefore = store ? store.issues.length : 0
        const outcome = await this.runNodeAction(currentNode, triggerTable, triggerData)
        if (outcome && outcome.stop) continue // ex.: consulta sem resultado e "não continuar" marcado
        if (!store || store.issues.length === issuesBefore) await this.queueSuccessMessage(currentNode, triggerTable, triggerData)
        const edges = flowData.edges.filter(e => e.source === currentNode.id)

        for (const edge of edges) {
          const targetNode = flowData.nodes.find(n => n.id === edge.target)
          if (targetNode) queue.push(targetNode)
        }
      }
      else {
        // trigger node
        const edges = flowData.edges.filter(e => e.source === currentNode.id)
        for (const edge of edges) {
          const targetNode = flowData.nodes.find(n => n.id === edge.target)
          if (targetNode) queue.push(targetNode)
        }
      }
    }
    // fila ainda com nós ao esgotar os 100 passos = fluxo em laço
    return { steps: MAX_STEPS - maxSteps, loop: queue.length > 0 }
  }

  /**
   * Executa um fluxo e reporta o resultado (porta runs): histórico, aviso por e-mail em caso de erro/laço e retenção de logs.
   */
  async runFlow(flow, triggerNode, tableName, rowData, source) {
    return await this.runReported(flow, tableName, source, async () => {
      const result = await this.traverseGraph(flow.flow_data, triggerNode, tableName, rowData)
      return { steps: result?.steps || 0, loop: !!result?.loop }
    })
  }

  /**
   * Executa fn (que percorre o fluxo) e reporta o resultado: success, error (exceção ou falha anotada em webhook/e-mail)
   * ou loop (passou de 100 passos). fn devolve { steps, loop, details? }.
   */
  /** `awaitReport: false` = não espera o registro da execução (validação síncrona: a tela está esperando a resposta). */
  async runReported(flow, tableName, source, fn, { awaitReport = true } = {}) {
    const startedAt = new Date()
    let status = 'success'
    let errorMessage = null
    let extra = { table: tableName, source }
    let messages = []
    await this.runCtx.run({ issues: [], messages: [], datasets: {} }, async () => {
      try {
        const result = await fn()
        extra = { ...extra, steps: result?.steps || 0, ...(result?.details || {}) }
        if (result?.loop) { status = 'loop'; errorMessage = `O fluxo passou de ${MAX_STEPS} passos (possível laço infinito) e foi interrompido.` }
      } catch (e) {
        status = 'error'
        errorMessage = (e && e.message) ? e.message : String(e)
        this.log.error(`[BPM] Falha na execução do fluxo ${flow.name}: ${errorMessage}`)
      }
      messages = this.runCtx.getStore().messages || []
      const issues = this.runCtx.getStore().issues
      if (issues.length > 0) {
        extra.issues = issues
        if (status === 'success') { status = 'error'; errorMessage = issues.join(' | ') }
      }
    })
    if (status === 'loop') this.log.error(`[BPM] Fluxo "${flow.name}" interrompido: ${errorMessage}`)
    if (awaitReport) await this.reportRun(flow, status, startedAt, errorMessage, extra)
    else void this.reportRun(flow, status, startedAt, errorMessage, extra) // reportRun já trata os próprios erros
    // mensagens de sucesso das ações (aba "Mensagem"): só quando o fluxo terminou bem
    return status === 'success' ? messages : []
  }

  async reportRun(flow, status, startedAt, errorMessage, details) {
    const runs = this.ports.runs
    if (!runs || typeof runs.report !== 'function') return
    try {
      const finishedAt = new Date()
      await runs.report({
        workflow_id: flow.id,
        workflow_name: flow.name,
        status,
        trigger_source: details?.source || null,
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - startedAt.getTime(),
        error_message: errorMessage || undefined,
        details,
      })
    } catch (err) {
      // o registro é um extra: nunca derruba nem atrasa o fluxo
      this.log.debug(`[BPM] Não foi possível registrar a execução: ${err.message}`)
    }
  }

  /** `actor` = quem agiu (sessão assinada): habilita {{usuario.*}} nos fluxos deste evento. */
  processEvent(tableName, actionType, rowData, oldRow = null, actor = null) {
    return this.actorCtx.run(cleanActor(actor), () => this._processEvent(tableName, actionType, rowData, oldRow))
  }

  async _processEvent(tableName, actionType, rowData, oldRow = null) {
    this.log.debug(`[BPM-DEBUG] processEvent chamado: tableName=${tableName}, actionType=${actionType}`)

    const messages = []
    if (!this.workflows || this.workflows.length === 0) {
      this.log.debug('[BPM-DEBUG] Nenhum fluxo ativo encontrado.')
      return messages
    }

    for (const flow of this.workflows) {
      const flowData = flow.flow_data
      if (!flowData || !flowData.nodes) {
        this.log.debug(`[BPM-DEBUG] Fluxo ${flow.name} sem flowData válido.`)
        continue
      }

      const triggerNodes = flowData.nodes.filter(n => n.type === 'trigger')
      this.log.debug(`[BPM-DEBUG] Fluxo ${flow.name} tem ${triggerNodes.length} trigger(s).`)

      for (const triggerNode of triggerNodes) {
        const triggerTypes = toList(triggerNode.data?.triggerType)
        const triggerTable = await this.getModelTable(triggerNode.data?.triggerModelId)

        this.log.debug(`[BPM-DEBUG] Avaliando Trigger: table=${triggerTable} (esperado=${tableName}), types=[${triggerTypes.join(',')}] (esperado=${actionType})`)

        if (triggerTable === tableName && triggerTypes.includes(actionType.toUpperCase())) {
          if (!this.fieldChangeMatches(triggerNode, actionType, rowData, oldRow)) {
            this.log.debug(`[BPM-DEBUG] Fluxo "${flow.name}" ignorado: o campo restrito não mudou como o gatilho pede.`)
            continue
          }
          this.log.info(`[BPM] Disparando fluxo "${flow.name}" para a tabela ${tableName}...`)
          messages.push(...((await this.runFlow(flow, triggerNode, tableName, rowData, `evento ${actionType.toUpperCase()}`)) || []))
        }
      }
    }
    return messages
  }

  /**
   * Webhook de entrada: o servidor já conferiu o segredo do fluxo e repassou o comando.
   * Os campos recebidos ficam disponíveis no fluxo como {{webhook.campo}}.
   */
  async processWebhook(workflowId, data) {
    const flow = (this.workflows || []).find(w => w.id === workflowId)
    if (!flow || !flow.flow_data || !Array.isArray(flow.flow_data.nodes)) throw new Error('Fluxo não encontrado ou inativo neste agente.')
    const triggerNode = flow.flow_data.nodes.find(n => {
      if (n.type !== 'trigger') return false
      const raw = n.data?.triggerType || []
      return (Array.isArray(raw) ? raw : [raw]).some(t => String(t).toLowerCase() === 'webhook')
    })
    if (!triggerNode) throw new Error('O fluxo não tem gatilho de webhook.')

    this.log.info(`[BPM] Webhook recebido: disparando fluxo "${flow.name}"...`)
    await this.runFlow(flow, triggerNode, 'webhook', { ...(data || {}) }, 'WEBHOOK')
  }

  processCustomAction(workflowIds, tableName, rowData, actor = null) {
    return this.actorCtx.run(cleanActor(actor), () => this._processCustomAction(workflowIds, tableName, rowData))
  }

  async _processCustomAction(workflowIds, tableName, rowData) {
    this.log.debug(`[BPM-DEBUG] processCustomAction chamado para fluxos: ${workflowIds.join(', ')}`)
    const customMessages = []

    const messages = []
    if (!this.workflows || this.workflows.length === 0) {
      this.log.debug('[BPM-DEBUG] Nenhum fluxo ativo encontrado.')
      return messages
    }

    const targetedWorkflows = this.workflows.filter(w => workflowIds.includes(w.id))
    if (targetedWorkflows.length === 0) {
      this.log.debug('[BPM-DEBUG] Nenhum dos fluxos solicitados está ativo ou existe.')
      return
    }

    for (const flow of targetedWorkflows) {
      const flowData = flow.flow_data
      if (!flowData || !flowData.nodes) continue

      const triggerNodes = flowData.nodes.filter(n => n.type === 'trigger')
      const triggerNode = triggerNodes.length > 0 ? triggerNodes[0] : null

      if (!triggerNode) {
        this.log.debug(`[BPM-DEBUG] Fluxo ${flow.name} não possui nó de gatilho.`)
        continue
      }

      this.log.info(`[BPM] Disparando fluxo customizado "${flow.name}" via Ação de Interface...`)
      // Garantir que temos o rowData completo caso a interface tenha enviado parcial
      let fullRowData = { ...rowData }
      if (fullRowData && fullRowData.id) {
        try {
          const q = this.dbType === 'oracle' ? `SELECT * FROM "${safeIdent(tableName)}" WHERE "id" = :1 FETCH FIRST 1 ROWS ONLY` : `SELECT * FROM "${safeIdent(tableName)}" WHERE "id" = $1 LIMIT 1`
          const rows = await this.executeQuery(q, [fullRowData.id])
          if (rows.length > 0) fullRowData = { ...fullRowData, ...rows[0] }
        } catch (e) {}
      }

      customMessages.push(...((await this.runFlow(flow, triggerNode, tableName, fullRowData, 'ação de interface')) || []))
    }
    return customMessages
  }

  async runNodeActionSync(node, triggerTable, triggerData) {
    const data = node.data || {}

    if (data.actionType === 'mutate') {
      const fieldsToUpdate = data.actionFields || []
      if (fieldsToUpdate.length === 0) return { mutatedData: triggerData }

      const newData = { ...triggerData }
      for (const f of fieldsToUpdate) {
        if (!f.field) continue
        const val = await this.replaceVariables(f.value, triggerTable, triggerData)
        newData[f.field] = val
      }
      this.log.sql('[BPM] Dados em memória atualizados (Mutate)')
      return { mutatedData: newData }
    } else {
      // Executa a ação padrão no banco (ex: INSERT em outra tabela, Email, Webhook)
      const outcome = await this.runNodeAction(node, triggerTable, triggerData)
      return outcome && outcome.stop ? { stop: true } : null
    }
  }

  async traverseGraphSync(flowData, startNode, triggerTable, triggerData) {
    const queue = [startNode]
    let maxSteps = MAX_STEPS

    let currentData = { ...triggerData }
    let finalSuccess = true
    let finalError = null
    let finalMessage = null

    while (queue.length > 0 && maxSteps > 0) {
      maxSteps--
      const currentNode = queue.shift()

      if (currentNode.type === 'condition') {
        const isTrue = this.evaluateCondition(currentNode, triggerTable, currentData)
        const edges = flowData.edges.filter(e => e.source === currentNode.id && e.sourceHandle === String(isTrue))

        for (const edge of edges) {
          const targetNode = flowData.nodes.find(n => n.id === edge.target)
          if (targetNode) queue.push(targetNode)
        }
      }
      else if (currentNode.type === 'response') {
        const data = currentNode.data || {}
        const allowAction = data.responseAllowAction !== false
        const msg = await this.replaceVariables(data.responseMessage, triggerTable, currentData, null, null, true)

        if (!allowAction) {
          finalSuccess = false
          finalError = msg || 'Ação bloqueada pelo fluxo BPM.'
          // Se bloqueou, aborta imediatamente
          return { success: finalSuccess, data: currentData, error: finalError, message: msg }
        } else {
          if (msg) finalMessage = msg
        }

        const edges = flowData.edges.filter(e => e.source === currentNode.id)
        for (const edge of edges) {
          const targetNode = flowData.nodes.find(n => n.id === edge.target)
          if (targetNode) queue.push(targetNode)
        }
      }
      else if (currentNode.type === 'action') {
        const store = this.runCtx.getStore()
        const issuesBefore = store ? store.issues.length : 0
        const actionResult = await this.runNodeActionSync(currentNode, triggerTable, currentData)
        if (actionResult && actionResult.stop) continue
        if (actionResult && actionResult.mutatedData) {
          currentData = actionResult.mutatedData
        }
        if (!store || store.issues.length === issuesBefore) await this.queueSuccessMessage(currentNode, triggerTable, currentData)

        const edges = flowData.edges.filter(e => e.source === currentNode.id)
        for (const edge of edges) {
          const targetNode = flowData.nodes.find(n => n.id === edge.target)
          if (targetNode) queue.push(targetNode)
        }
      }
      else {
        const edges = flowData.edges.filter(e => e.source === currentNode.id)
        for (const edge of edges) {
          const targetNode = flowData.nodes.find(n => n.id === edge.target)
          if (targetNode) queue.push(targetNode)
        }
      }
    }

    return { success: finalSuccess, data: currentData, error: finalError, message: finalMessage, steps: MAX_STEPS - maxSteps, loop: queue.length > 0 }
  }

  processSyncEvent(tableName, actionType, rowData, oldRow = null, actor = null) {
    return this.actorCtx.run(cleanActor(actor), () => this._processSyncEvent(tableName, actionType, rowData, oldRow))
  }

  async _processSyncEvent(tableName, actionType, rowData, oldRow = null) {
    this.log.debug(`[BPM-DEBUG] processSyncEvent chamado: tableName=${tableName}, actionType=${actionType}`)

    let currentData = { ...rowData }
    const success = true
    let message = null

    if (!this.workflows || this.workflows.length === 0) {
      return { success, data: currentData, message, error: null }
    }

    for (const flow of this.workflows) {
      const flowData = flow.flow_data
      if (!flowData || !flowData.nodes) continue

      const triggerNodes = flowData.nodes.filter(n => n.type === 'trigger')
      for (const triggerNode of triggerNodes) {
        const triggerTypes = toList(triggerNode.data?.triggerType)
        const triggerTable = await this.getModelTable(triggerNode.data?.triggerModelId)

        if (triggerTable === tableName && triggerTypes.includes(actionType.toUpperCase())) {
          if (!this.fieldChangeMatches(triggerNode, actionType, currentData, oldRow)) continue
          this.log.info(`[BPM] Disparando fluxo SÍNCRONO "${flow.name}" para a tabela ${tableName}...`)
          try {
            let result
            let doneMessages = []
            // reporta a execução; bloquear a ação é um resultado normal do fluxo (vai nos detalhes), não uma falha
            doneMessages = await this.runReported(flow, tableName, `validação ${actionType.toUpperCase()}`, async () => {
              result = await this.traverseGraphSync(flowData, triggerNode, tableName, currentData)
              return { steps: result.steps, loop: result.loop, details: { sync: true, blocked: !result.success, ...(result.success ? {} : { message: result.error }) } }
            }, { awaitReport: false })
            if (!result) throw new Error('fluxo síncrono sem resultado')
            currentData = result.data
            if (result.message) message = result.message // Last message wins
            if (result.success && doneMessages && doneMessages.length) message = [message, ...doneMessages.map(m => m.text)].filter(Boolean).join('\n')
            if (!result.success) {
              this.log.error('[BPM] Fluxo SÍNCRONO bloqueou a ação!')
              return { success: false, data: currentData, error: result.error || 'Ação bloqueada pelo fluxo.', message }
            }
          } catch (e) {
            this.log.error(`[BPM] Falha na execução do fluxo SÍNCRONO ${flow.name}: ${e && e.message ? e.message : e}`)
            return { success: false, data: currentData, error: 'Erro interno na execução da automação.', message }
          }
        }
      }
    }

    return { success, data: currentData, message, error: null }
  }
}

module.exports = { BpmCore, MAX_STEPS, WEBHOOK_TIMEOUT_MS, relativeDate, buildHtmlTable, formatCell, intervalCron }
