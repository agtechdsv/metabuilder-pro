import { describe, it, expect } from 'vitest'
import { translateTunnelLog, translateLogLevel } from '../tunnelLogTranslator'

describe('tradução do log do túnel na hora de exibir', () => {
  it('comando recebido: a parte fixa e o que o comando faz saem no idioma da tela, sem mexer em nomes de tabela e schema', () => {
    const l = "Comando Recebido no schema 'crm': SELECT na tabela 'clientes'"
    expect(translateTunnelLog(l, 'en')).toBe("Command Received on schema 'crm': SELECT on table 'clientes'")
    expect(translateTunnelLog(l, 'es')).toBe("Comando Recibido en schema 'crm': SELECT en la tabla 'clientes'")
    expect(translateTunnelLog(l, 'pt')).toBe(l)
    expect(translateTunnelLog("Comando Recebido no schema 'crm': Executar trigger_bpm_sync", 'en')).toBe("Command Received on schema 'crm': Run trigger_bpm_sync")
    expect(translateTunnelLog("Comando Recebido no schema 'crm': Sincronizar BPM", 'en')).toBe("Command Received on schema 'crm': Sync BPM")
    expect(translateTunnelLog("Comando Recebido no schema 'crm': Validar Login", 'es')).toBe("Comando Recibido en schema 'crm': Validar Inicio de Sesión")
  })

  it('resultados de consulta e gravação', () => {
    expect(translateTunnelLog('SELECT: Retornou 160 linhas (Limit: 50, Offset: 0).', 'en')).toBe('SELECT: Returned 160 rows (Limit: 50, Offset: 0).')
    expect(translateTunnelLog('SELECT: Retornou 6 linhas (Limit: 1000, Offset: 0).', 'es')).toBe('SELECT: Devolvió 6 filas (Limit: 1000, Offset: 0).')
    expect(translateTunnelLog('COUNT: Retornou total de 120 linhas.', 'en')).toBe('COUNT: Returned a total of 120 rows.')
    expect(translateTunnelLog('INSERT: 1 linha criada.', 'en')).toBe('INSERT: 1 row created.')
    expect(translateTunnelLog('UPDATE: 1 linha atualizada.', 'es')).toBe('UPDATE: 1 fila actualizada.')
    expect(translateTunnelLog('DELETE: 1 linha removida.', 'en')).toBe('DELETE: 1 row removed.')
  })

  it('o SQL e os dados nunca são traduzidos: só o prefixo da linha', () => {
    const sql = 'SELECT "nome", "id" FROM "clientes" WHERE "status" = \'Retornou\' LIMIT 1000 OFFSET 0'
    expect(translateTunnelLog(`Executando: ${sql}`, 'en')).toBe(`Executing: ${sql}`)
    expect(translateTunnelLog(`Executando COUNT: ${sql}`, 'es')).toBe(`Ejecutando COUNT: ${sql}`)
    expect(translateTunnelLog('Params: ["a","b"]', 'en')).toBe('Params: ["a","b"]')
    expect(translateTunnelLog(sql, 'en')).toBe(sql)
  })

  it('a linha gravada em outro idioma (pelo CLI) volta para o idioma da tela, em qualquer direção', () => {
    const en = "Command Received on schema 'crm': SELECT on table 'clientes'"
    expect(translateTunnelLog(en, 'pt')).toBe("Comando Recebido no schema 'crm': SELECT na tabela 'clientes'")
    expect(translateTunnelLog(en, 'es')).toBe("Comando Recibido en schema 'crm': SELECT en la tabla 'clientes'")
    const es = 'Motor en ejecución. Escuchando 2 flujos activos.'
    expect(translateTunnelLog(es, 'pt')).toBe('Motor rodando. Escutando 2 fluxos ativos.')
    expect(translateTunnelLog(es, 'en')).toBe('Engine running. Listening to 2 active flows.')
  })

  it('etiqueta de nível junto com o texto: ambos são traduzidos (e a etiqueta sozinha também)', () => {
    expect(translateTunnelLog('[ OK ] SELECT: Retornou 6 linhas (Limit: 1000, Offset: 0).', 'en')).toBe('[ OK ] SELECT: Returned 6 rows (Limit: 1000, Offset: 0).')
    expect(translateTunnelLog('[ ERRO ] Falha na query: Senha incorreta', 'en')).toBe('[ ERROR ] Query failed: Incorrect password')
    expect(translateTunnelLog('[ AVISO ] Falha ao enviar broadcast \'sql_result\': timeout', 'en')).toBe("[ WARNING ] Failed to send broadcast 'sql_result': timeout")
    expect(translateLogLevel('ERRO', 'en')).toBe('ERROR')
    expect(translateLogLevel('ERROR', 'pt')).toBe('ERRO')
    expect(translateLogLevel('AVISO', 'en')).toBe('WARNING')
    expect(translateLogLevel('WARNING', 'es')).toBe('AVISO')
    expect(translateLogLevel('SEGURANÇA', 'en')).toBe('SECURITY')
    // níveis desconhecidos ou técnicos ficam como estão
    expect(translateLogLevel('BPM-DEBUG', 'en')).toBe('BPM-DEBUG')
    expect(translateLogLevel('SQL', 'es')).toBe('SQL')
  })

  it('segurança do túnel: a linha longa e os valores de estado', () => {
    const pt = 'Comandos assinados: obrigatórios | formato antigo (token no comando): RECUSADO | respostas em tópico privado: ativas | comandos em tópico privado: ativos | acesso por tabela do usuário final: ativo'
    expect(translateTunnelLog(pt, 'en')).toBe('Signed commands: required | legacy format (token in the command): REFUSED | private-topic replies: active | private-topic commands: active | end-user table access: active')
    expect(translateTunnelLog(translateTunnelLog(pt, 'es'), 'pt')).toBe(pt)
    expect(translateTunnelLog("Comando sem tópico de resposta válido: a resposta 'sql_result' não foi enviada.", 'en')).toBe("Command without a valid reply topic: the reply 'sql_result' was not sent.")
  })

  it('símbolos na frente da linha (✓ 🎧 ⏰) são mantidos', () => {
    expect(translateTunnelLog('✓ Conexão contínua estabelecida com sucesso! (crm)', 'en')).toBe('✓ Continuous connection established successfully! (crm)')
    expect(translateTunnelLog('🎧 Agente MetaBuilderPRO ouvindo ativamente comandos no canal: tunnel:abc...', 'en')).toBe('🎧 MetaBuilderPRO Agent actively listening for commands on channel: tunnel:abc...')
    expect(translateTunnelLog('⏰ Agendamento disparado para o fluxo "Relatório"!', 'en')).toBe('⏰ Schedule triggered for flow "Relatório"!')
    expect(translateTunnelLog('⏰ Schedule triggered for flow "Relatório"!', 'pt')).toBe('⏰ Agendamento disparado para o fluxo "Relatório"!')
  })

  it('automações (BPM): disparos, e-mail, consulta e condição', () => {
    expect(translateTunnelLog('Disparando fluxo "Aviso" para a tabela pedidos...', 'en')).toBe('Triggering flow "Aviso" for table pedidos...')
    expect(translateTunnelLog('Disparando fluxo SÍNCRONO "Negar" para a tabela pedidos...', 'es')).toBe('Disparando flujo SÍNCRONO "Negar" para la tabla pedidos...')
    expect(translateTunnelLog('E-mail disparado com sucesso!', 'en')).toBe('Email sent successfully!')
    expect(translateTunnelLog('Disparando e-mail para: a@x.com (Template: modern)', 'es')).toBe('Enviando correo a: a@x.com (Plantilla: modern)')
    expect(translateTunnelLog('Fluxo SÍNCRONO bloqueou a ação!', 'en')).toBe('SYNCHRONOUS flow blocked the action!')
    expect(translateTunnelLog('Consulta "consulta": 12 linha(s).', 'en')).toBe('Query "consulta": 12 row(s).')
    expect(translateTunnelLog("Regra: Campo 'status' (Cancelado) == Valor Esperado (Cancelado) => Resultado: true", 'en')).toBe("Rule: Field 'status' (Cancelado) == Expected Value (Cancelado) => Result: true")
    expect(translateTunnelLog('Condição final resultou em: true', 'es')).toBe('La condición final resultó en: true')
    expect(translateTunnelLog('Erro ao buscar os fluxos no servidor: Credenciais inválidas (secret_token).', 'en')).toBe('Error fetching the flows from the server: Credenciais inválidas (secret_token).')
  })

  it('linhas dos padrões antigos continuam funcionando como reserva', () => {
    expect(translateTunnelLog('Lendo tabelas...', 'en')).toBe('Reading tables...')
    expect(translateTunnelLog('Lendo chaves primárias...', 'es')).toBe('Leyendo claves primarias...')
  })

  it('linha desconhecida passa intacta em qualquer idioma; português na tela não muda o que já é português', () => {
    const l = 'algo que o catálogo não conhece 123'
    for (const lang of ['pt', 'en', 'es'] as const) expect(translateTunnelLog(l, lang)).toBe(l)
    const pt = 'E-mail disparado com sucesso!'
    expect(translateTunnelLog(pt, 'pt')).toBe(pt)
    expect(translateTunnelLog('', 'en')).toBe('')
  })

  it('trocar de idioma várias vezes dá sempre o mesmo resultado (sem restos do idioma anterior)', () => {
    const base = "Comando Recebido no schema 'crm': UPDATE na tabela 'pedidos'"
    let text = base
    for (const lang of ['en', 'es', 'pt', 'en', 'pt'] as const) text = translateTunnelLog(text, lang)
    expect(text).toBe(base)
  })
})
