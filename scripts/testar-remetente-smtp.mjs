// Testa se o SMTP do site consegue enviar "como" cada alias do domínio (financeiro@, suporte@...) e mostra como o servidor respondeu.
//
//   node --env-file=.env.local scripts/testar-remetente-smtp.mjs seu.email.de.teste@gmail.com
//   node --env-file=.env.local scripts/testar-remetente-smtp.mjs seu.email@gmail.com financeiro suporte   (só alguns aliases)
//
// Usa as MESMAS variáveis do site (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS). Não imprime a senha. Envia um e-mail curto por alias, SÓ para o
// endereço que você informar. Depois, no destino (ex.: Gmail), abra cada e-mail > "Mostrar original" e confira: De (From), Return-Path e os
// resultados de SPF, DKIM e DMARC (devem ser PASS).
import nodemailer from 'nodemailer'

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env
const [to, ...only] = process.argv.slice(2)
if (!to || !to.includes('@')) { console.error('Informe o e-mail de destino do teste. Ex.: node --env-file=.env.local scripts/testar-remetente-smtp.mjs voce@gmail.com'); process.exit(1) }
if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) { console.error('Faltam SMTP_HOST, SMTP_USER ou SMTP_PASS no .env.local.'); process.exit(1) }

const domain = SMTP_USER.split('@')[1]
const ALIASES = ['admin', 'comercial', 'engenharia', 'feedback', 'financeiro', 'lgpd', 'noreply', 'suporte', 'contato']
const list = (only.length ? only : ALIASES).map(a => (a.includes('@') ? a : `${a}@${domain}`))

const transporter = nodemailer.createTransport({ host: SMTP_HOST, port: Number(SMTP_PORT || 465), secure: Number(SMTP_PORT || 465) === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } })

console.log(`Conta SMTP: ${SMTP_USER} em ${SMTP_HOST}. Destino: ${to}\n`)
try { await transporter.verify(); console.log('Login no SMTP: OK\n') } catch (e) { console.error('Login no SMTP FALHOU:', e.message); process.exit(1) }

let ok = 0
for (const from of list) {
  try {
    const info = await transporter.sendMail({
      from: `"MetaBuilder PRO (teste)" <${from}>`,
      to,
      subject: `Teste de remetente: ${from}`,
      text: `Este é um teste. Enviado pela conta ${SMTP_USER} como ${from}.\nAbra "Mostrar original" e confira De, Return-Path, SPF, DKIM e DMARC.`,
    })
    const accepted = info.accepted?.length > 0
    console.log(`${accepted ? 'ACEITO  ' : 'RECUSADO'} ${from}  ->  ${info.response}`)
    if (accepted) ok++
  } catch (e) {
    console.log(`RECUSADO ${from}  ->  ${e.message}`)
  }
}
console.log(`\n${ok}/${list.length} aceitos pelo servidor. "Aceito" só diz que o Hostinger recebeu: o que vale é o que aparece no e-mail que chegou (veja De e Return-Path).`)
