// Simula eventos do Asaas contra o webhook (Edge Function asaas-webhook) para testar o que fazer quando a conta é compartilhada com outros apps.
//
//   node scripts/simular-webhook-asaas.mjs chave-nossa
//   node scripts/simular-webhook-asaas.mjs todos
//
// Variáveis de ambiente (defina no seu terminal; NUNCA coloque no código, no chat ou no repositório):
//   SUPABASE_URL          ex.: https://<projeto>.supabase.co
//   ASAAS_WEBHOOK_TOKEN   o mesmo token que o Asaas manda no cabeçalho asaas-access-token
// Opcionais (nomes das chaves cadastradas em Sistema > Avisos de cobrança > Apps neste Asaas):
//   SIM_OWN_KEY (padrão MetaBuilderPRO)   SIM_OTHER_KEY (padrão TraderMasterPRO)
//
// Os cenários de chave geram avisos de TESTE na fila (o de "chave-nossa" é o alerta de urgência e chega por e-mail ao admin). Nenhum cenário mexe em
// cliente, assinatura ou pagamento reais: o pagamento simulado tem id inventado e é ignorado ou parado antes de gravar.

const url = process.env.SUPABASE_URL?.replace(/\/+$/, '')
const token = process.env.ASAAS_WEBHOOK_TOKEN
const ownKey = process.env.SIM_OWN_KEY || 'MetaBuilderPRO'
const otherKey = process.env.SIM_OTHER_KEY || 'TraderMasterPRO'

if (!url || !token) {
  console.error('Defina SUPABASE_URL e ASAAS_WEBHOOK_TOKEN no ambiente (não os escreva em arquivo).')
  process.exit(1)
}

const stamp = Date.now()
const keyEvent = (name, tag) => ({
  id: `sim-${tag}-${stamp}`,
  event: 'ACCESS_TOKEN_EXPIRED',
  accessToken: { name, expirationDate: '2026-12-01' },
})

const scenarios = {
  'chave-nossa': {
    espera: 'HTTP 200; entra um alerta URGENTE (chave do MetaBuilder) e chega e-mail ao admin: "Chave de API do Asaas expirou".',
    body: keyEvent(ownKey, 'nossa'),
  },
  'chave-outro-app': {
    espera: 'HTTP 200; entra um aviso DISCRETO: assunto "Chave de API do Asaas expirou (outro app)", dizendo que não afeta o MetaBuilder (ou nenhum aviso, se "Não avisar" estiver marcado).',
    body: keyEvent(otherKey, 'outro'),
  },
  'chave-desconhecida': {
    espera: 'HTTP 200; entra o alerta de urgência com a linha "Chave cadastrada? Não. ...", pedindo para cadastrar o nome.',
    body: keyEvent(`App-Teste-${stamp}`, 'desconhecida'),
  },
  'pagamento-outro-app': {
    espera: 'HTTP 200 com {"success":true,"ignored":"other_app"}; NENHUM aviso na fila e nada gravado (no log da função: "[app-externo] ... ignorado").',
    body: {
      event: 'PAYMENT_RECEIVED',
      payment: { id: `pay_simulado_${stamp}`, externalReference: `tmp_simulado_${stamp}`, value: 10, billingType: 'PIX' },
    },
  },
}

const names = process.argv[2] === 'todos' ? Object.keys(scenarios) : [process.argv[2]]
if (names.some(n => !scenarios[n])) {
  console.error(`Cenários: ${Object.keys(scenarios).join(', ')}, todos`)
  process.exit(1)
}

for (const name of names) {
  const sc = scenarios[name]
  const res = await fetch(`${url}/functions/v1/asaas-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'asaas-access-token': token },
    body: JSON.stringify(sc.body),
  })
  const text = await res.text()
  console.log(`\n== ${name}\nHTTP ${res.status} ${text.slice(0, 300)}\nEsperado: ${sc.espera}`)
}
console.log('\nConfira a fila com (SQL Editor): select kind, status, payload from billing_notices order by created_at desc limit 5;')
