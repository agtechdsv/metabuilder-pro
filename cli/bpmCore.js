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

class BpmCore {
  constructor(ports) {
    if (!ports || !ports.db || typeof ports.db.query !== 'function') throw new Error('BpmCore: a porta "db" é obrigatória.')
    if (!ports.models || typeof ports.models.tableOf !== 'function') throw new Error('BpmCore: a porta "models" é obrigatória.')
    this.ports = ports
    const noop = () => {}
    this.log = { debug: noop, info: noop, ok: noop, warn: noop, error: noop, sql: noop, danger: noop, mail: noop, ...(ports.log || {}) }
    this.verbose = ports.verbose !== false
    this.runCtx = new AsyncLocalStorage()
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

            if (sched.type === 'recurring') {
              // days: [0, 1, 2] (Dom, Seg, Ter)
              const days = (sched.days && sched.days.length > 0) ? sched.days.join(',') : '*'
              const time = sched.time || '00:00'
              const [hour, min] = time.split(':')
              cronStr = `${min || '0'} ${hour || '0'} * * ${days}`
            } else if (sched.type === 'once') {
              // dateTime: "2026-06-04T18:30"
              const dt = new Date(sched.dateTime)
              if (!isNaN(dt.getTime())) {
                cronStr = `${dt.getMinutes()} ${dt.getHours()} ${dt.getDate()} ${dt.getMonth() + 1} *`
              }
            }

            if (cronStr) {
              if (!scheduler || typeof scheduler.schedule !== 'function') {
                this.log.warn(`[BPM] Fluxo "${flow.name}" tem agendamento, mas este ambiente não tem agendador: ignorado.`)
                continue
              }
              const job = scheduler.schedule(cronStr, async () => {
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
    const p = n => String(n).padStart(2, '0')
    const date = `${p(v.getDate())}/${p(v.getMonth() + 1)}/${v.getFullYear()}`
    return v.getHours() || v.getMinutes() || v.getSeconds() ? `${date} ${p(v.getHours())}:${p(v.getMinutes())}` : date
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
        if (table !== triggerTable && table !== actionTable && table !== 'webhook') {
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
      const actualValue = (triggerData || {})[field]

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

  async runNodeAction(node, triggerTable, triggerData) {
    const data = node.data || {}
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
          await this.ports.mail.send({ to, subject, body: String(body).replace(/\n/g, '<br/>'), template: templateType })
          this.log.ok('[BPM] E-mail disparado com sucesso!')
        } catch (err) {
          this.log.error(`[BPM] Erro ao enviar e-mail: ${err.message}`)
          this.noteIssue(`E-mail para ${this.verbose ? to : '[omitido]'}: ${err.message}`)
        }
      }
    }
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
        await this.runNodeAction(currentNode, triggerTable, triggerData)
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
    await this.runReported(flow, tableName, source, async () => {
      const result = await this.traverseGraph(flow.flow_data, triggerNode, tableName, rowData)
      return { steps: result?.steps || 0, loop: !!result?.loop }
    })
  }

  /**
   * Executa fn (que percorre o fluxo) e reporta o resultado: success, error (exceção ou falha anotada em webhook/e-mail)
   * ou loop (passou de 100 passos). fn devolve { steps, loop, details? }.
   */
  async runReported(flow, tableName, source, fn) {
    const startedAt = new Date()
    let status = 'success'
    let errorMessage = null
    let extra = { table: tableName, source }
    await this.runCtx.run({ issues: [] }, async () => {
      try {
        const result = await fn()
        extra = { ...extra, steps: result?.steps || 0, ...(result?.details || {}) }
        if (result?.loop) { status = 'loop'; errorMessage = `O fluxo passou de ${MAX_STEPS} passos (possível laço infinito) e foi interrompido.` }
      } catch (e) {
        status = 'error'
        errorMessage = (e && e.message) ? e.message : String(e)
        this.log.error(`[BPM] Falha na execução do fluxo ${flow.name}: ${errorMessage}`)
      }
      const issues = this.runCtx.getStore().issues
      if (issues.length > 0) {
        extra.issues = issues
        if (status === 'success') { status = 'error'; errorMessage = issues.join(' | ') }
      }
    })
    if (status === 'loop') this.log.error(`[BPM] Fluxo "${flow.name}" interrompido: ${errorMessage}`)
    await this.reportRun(flow, status, startedAt, errorMessage, extra)
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

  async processEvent(tableName, actionType, rowData, oldRow = null) {
    this.log.debug(`[BPM-DEBUG] processEvent chamado: tableName=${tableName}, actionType=${actionType}`)

    if (!this.workflows || this.workflows.length === 0) {
      this.log.debug('[BPM-DEBUG] Nenhum fluxo ativo encontrado.')
      return
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
          await this.runFlow(flow, triggerNode, tableName, rowData, `evento ${actionType.toUpperCase()}`)
        }
      }
    }
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

  async processCustomAction(workflowIds, tableName, rowData) {
    this.log.debug(`[BPM-DEBUG] processCustomAction chamado para fluxos: ${workflowIds.join(', ')}`)

    if (!this.workflows || this.workflows.length === 0) {
      this.log.debug('[BPM-DEBUG] Nenhum fluxo ativo encontrado.')
      return
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

      await this.runFlow(flow, triggerNode, tableName, fullRowData, 'ação de interface')
    }
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
      await this.runNodeAction(node, triggerTable, triggerData)
      return null
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
        const actionResult = await this.runNodeActionSync(currentNode, triggerTable, currentData)
        if (actionResult && actionResult.mutatedData) {
          currentData = actionResult.mutatedData
        }

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

  async processSyncEvent(tableName, actionType, rowData, oldRow = null) {
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
            // reporta a execução; bloquear a ação é um resultado normal do fluxo (vai nos detalhes), não uma falha
            await this.runReported(flow, tableName, `validação ${actionType.toUpperCase()}`, async () => {
              result = await this.traverseGraphSync(flowData, triggerNode, tableName, currentData)
              return { steps: result.steps, loop: result.loop, details: { sync: true, blocked: !result.success, ...(result.success ? {} : { message: result.error }) } }
            })
            if (!result) throw new Error('fluxo síncrono sem resultado')
            currentData = result.data
            if (result.message) message = result.message // Last message wins
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

module.exports = { BpmCore, MAX_STEPS, WEBHOOK_TIMEOUT_MS }
