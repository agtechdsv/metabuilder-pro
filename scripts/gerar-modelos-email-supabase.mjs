// Gera os modelos de e-mail do Supabase Auth (Authentication > Emails > Templates) em pt, en e es, no padrão visual da marca.
//
//   node scripts/gerar-modelos-email-supabase.mjs
//
// Saída: docs/emails-supabase/<modelo>.html (corpo) e docs/emails-supabase/assuntos.md (assunto de cada modelo), prontos para colar no painel.
// Cada modelo escolhe o idioma por `user_metadata.lang` (gravado no cadastro, no convite e no login). Sem idioma gravado: português.
// Os textos ficam AQUI: para mudar uma frase, edite este arquivo e gere de novo (não edite os .html à mão).
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..')
const outDir = path.join(root, 'docs', 'emails-supabase')

const SUPPORT = 'suporte@metabuilderpro.com'
/** Início de todo assunto (uma vez só, fora do texto nos 3 idiomas, para caber nos 255 caracteres que o Supabase aceita no campo Subject). */
const BRAND = 'MetaBuilder PRO: '
const SUBJECT_MAX = 255
// Mesmo número de src/lib/contact.ts (um teste confere que os dois batem). Só os modelos com `whatsapp: true` mostram o contato.
const WHATSAPP = '5531989560146'
const WHATSAPP_SHOWN = '(31) 98956-0146'

// Declaração do idioma (uma vez por modelo). `.Data` pode não existir: cada passo confere antes de usar.
const DECLARE = '{{ $l := "pt" }}{{ if .Data }}{{ if .Data.lang }}{{ $l = .Data.lang }}{{ end }}{{ end }}'
/** Texto nos 3 idiomas, escolhido pelo idioma do usuário (português se não houver ou for outro). */
const T = ({ pt, en, es }) => `{{ if eq $l "en" }}${en}{{ else if eq $l "es" }}${es}{{ else }}${pt}{{ end }}`

const COMMON = {
  fallback: { pt: 'Se o botão não funcionar, copie e cole este endereço no navegador:', en: 'If the button does not work, copy and paste this address into your browser:', es: 'Si el botón no funciona, copie y pegue esta dirección en su navegador:' },
  help: { pt: 'Precisa de ajuda? Escreva para', en: 'Need help? Write to', es: '¿Necesita ayuda? Escriba a' },
  tagline: { pt: 'Plataforma de Desenvolvimento Avançada.', en: 'Advanced Development Platform.', es: 'Plataforma de Desarrollo Avanzada.' },
}

/** Monta o HTML de um modelo. `button` e `code` são opcionais (a reautenticação mostra um código, sem botão). */
function build({ title, intro, boxLabel, boxText, button, note, why, code, whatsapp }) {
  const whatsappHtml = whatsapp ? ` &middot; WhatsApp <a href="https://wa.me/${WHATSAPP}" style="color: #3b82f6; text-decoration: none;">${WHATSAPP_SHOWN}</a>` : ''
  const buttonHtml = button ? `
              <!-- Botão principal -->
              <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin-top: 28px; margin-bottom: 8px;">
                <tr>
                  <td align="center" bgcolor="#10b981" style="border-radius: 12px; background-color: #10b981;">
                    <a href="{{ .ConfirmationURL }}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 12px;">${T(button)}</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 22px 0 0 0; font-size: 12px; line-height: 1.5; color: #94a3b8;">${T(COMMON.fallback)}<br><a href="{{ .ConfirmationURL }}" target="_blank" style="color: #3b82f6; word-break: break-all;">{{ .ConfirmationURL }}</a></p>` : ''
  const codeHtml = code ? `
              <p style="margin: 8px 0 0 0; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #0f172a;">{{ .Token }}</p>` : ''
  return `${DECLARE}<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MetaBuilder PRO</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- Card principal -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; width: 100%; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">

          <!-- Faixa superior: cor sólida de reserva + gradiente (alguns clientes de e-mail ignoram o gradiente) -->
          <tr>
            <td align="center" bgcolor="#10b981" style="background-color: #10b981; background-image: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); padding: 50px 20px;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.025em;">MetaBuilder <span style="color: #d1fae5;">PRO</span></h1>
            </td>
          </tr>

          <!-- Conteúdo -->
          <tr>
            <td style="padding: 40px; text-align: center;">
              <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 800; color: #111827; letter-spacing: -0.025em;">${T(title)}</h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #4b5563;">${T(intro)}</p>

              <!-- Bloco de destaque -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 16px; margin: 24px 0;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <span style="font-size: 10px; font-weight: 800; color: #10b981; letter-spacing: 0.1em; text-transform: uppercase;">${T(boxLabel)}</span>
                    <p style="margin: 6px 0 0 0; font-size: 14px; font-weight: 700; color: #1e293b;">${T(boxText)}</p>${codeHtml}
                  </td>
                </tr>
              </table>${buttonHtml}
              <p style="margin: 24px 0 0 0; font-size: 12px; line-height: 1.5; color: #b45309;">${T(note)}</p>
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td style="padding: 0 40px 40px 40px; text-align: center; border-top: 1px solid #f1f5f9;">
              <p style="margin: 24px 0 8px 0; font-size: 12px; color: #64748b;">${T(COMMON.help)} <a href="mailto:${SUPPORT}" style="color: #3b82f6; text-decoration: none;">${SUPPORT}</a>${whatsappHtml}</p>
              <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">&copy; MetaBuilder PRO</p>
              <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #94a3b8;">${T(why)}<br>${T(COMMON.tagline)}</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

const TEMPLATES = {
  'confirm-signup': {
    whatsapp: true,
    subject: { pt: 'Confirme o seu cadastro', en: 'Confirm your sign-up', es: 'Confirme su registro' },
    title: { pt: 'Confirme o seu e-mail', en: 'Confirm your e-mail', es: 'Confirme su e-mail' },
    intro: { pt: 'Olá! Falta só um passo para ativar a sua conta no <strong>MetaBuilder PRO</strong>. Confirme que este e-mail é seu clicando no botão abaixo.', en: 'Hello! Just one more step to activate your <strong>MetaBuilder PRO</strong> account. Confirm this e-mail is yours by clicking the button below.', es: '¡Hola! Falta solo un paso para activar su cuenta en <strong>MetaBuilder PRO</strong>. Confirme que este e-mail es suyo haciendo clic en el botón de abajo.' },
    boxLabel: { pt: 'Último passo', en: 'Last step', es: 'Último paso' },
    boxText: { pt: 'Confirme o seu e-mail para entrar', en: 'Confirm your e-mail to sign in', es: 'Confirme su e-mail para entrar' },
    button: { pt: 'CONFIRMAR E-MAIL', en: 'CONFIRM E-MAIL', es: 'CONFIRMAR E-MAIL' },
    note: { pt: 'Se você não criou uma conta, pode ignorar este e-mail com segurança.', en: 'If you did not create an account, you can safely ignore this e-mail.', es: 'Si no creó una cuenta, puede ignorar este e-mail con seguridad.' },
    why: { pt: 'Você recebeu este e-mail porque este endereço foi usado para criar uma conta na plataforma.', en: 'You received this e-mail because this address was used to create an account on the platform.', es: 'Recibió este e-mail porque esta dirección se usó para crear una cuenta en la plataforma.' },
  },
  'invite-user': {
    whatsapp: true,
    subject: { pt: 'Você foi convidado', en: 'You have been invited', es: 'Lo invitaron' },
    title: { pt: 'Você foi convidado!', en: 'You have been invited!', es: '¡Lo invitaron!' },
    intro: { pt: 'Olá! Preparamos tudo para você. Alguém acabou de te dar acesso à equipe e aos projetos no <strong>MetaBuilder PRO</strong>.', en: 'Hello! We have everything ready for you. Someone just gave you access to the team and projects on <strong>MetaBuilder PRO</strong>.', es: '¡Hola! Preparamos todo para usted. Alguien acaba de darle acceso al equipo y a los proyectos en <strong>MetaBuilder PRO</strong>.' },
    boxLabel: { pt: 'Acesso garantido', en: 'Access granted', es: 'Acceso garantizado' },
    boxText: { pt: 'Junte-se ao workspace agora mesmo', en: 'Join the workspace right now', es: 'Únase al workspace ahora mismo' },
    button: { pt: 'ACEITAR CONVITE', en: 'ACCEPT INVITATION', es: 'ACEPTAR INVITACIÓN' },
    note: { pt: 'Se você não esperava este convite, pode ignorar este e-mail.', en: 'If you were not expecting this invitation, you can ignore this e-mail.', es: 'Si no esperaba esta invitación, puede ignorar este e-mail.' },
    why: { pt: 'Você recebeu este e-mail devido ao seu convite na plataforma.', en: 'You received this e-mail because of your invitation to the platform.', es: 'Recibió este e-mail por su invitación a la plataforma.' },
  },
  'magic-link': {
    subject: { pt: 'Seu link de acesso', en: 'Your sign-in link', es: 'Su enlace de acceso' },
    title: { pt: 'Entre no MetaBuilder PRO', en: 'Sign in to MetaBuilder PRO', es: 'Ingrese a MetaBuilder PRO' },
    intro: { pt: 'Use o botão abaixo para entrar na sua conta sem digitar a senha. O link vale uma única vez.', en: 'Use the button below to sign in to your account without typing your password. The link works only once.', es: 'Use el botón de abajo para ingresar a su cuenta sin escribir la contraseña. El enlace vale una sola vez.' },
    boxLabel: { pt: 'Acesso seguro', en: 'Secure access', es: 'Acceso seguro' },
    boxText: { pt: 'Entrar sem senha', en: 'Sign in without a password', es: 'Ingresar sin contraseña' },
    button: { pt: 'ENTRAR', en: 'SIGN IN', es: 'INGRESAR' },
    note: { pt: 'Se você não pediu este acesso, ignore este e-mail.', en: 'If you did not request this access, ignore this e-mail.', es: 'Si no pidió este acceso, ignore este e-mail.' },
    why: { pt: 'Você recebeu este e-mail devido a um pedido de acesso na plataforma.', en: 'You received this e-mail because of an access request on the platform.', es: 'Recibió este e-mail por una solicitud de acceso en la plataforma.' },
  },
  'change-email': {
    subject: { pt: 'Confirme a troca de e-mail', en: 'Confirm your e-mail change', es: 'Confirme el cambio de e-mail' },
    title: { pt: 'Confirmar o novo e-mail', en: 'Confirm your new e-mail', es: 'Confirme su nuevo e-mail' },
    intro: { pt: 'Recebemos um pedido para trocar o e-mail da sua conta de <strong>{{ .Email }}</strong> para <strong>{{ .NewEmail }}</strong>. Confirme clicando no botão abaixo.', en: 'We received a request to change your account e-mail from <strong>{{ .Email }}</strong> to <strong>{{ .NewEmail }}</strong>. Confirm by clicking the button below.', es: 'Recibimos una solicitud para cambiar el e-mail de su cuenta de <strong>{{ .Email }}</strong> a <strong>{{ .NewEmail }}</strong>. Confirme haciendo clic en el botón de abajo.' },
    boxLabel: { pt: 'Segurança da conta', en: 'Account security', es: 'Seguridad de la cuenta' },
    boxText: { pt: 'Confirme a troca de e-mail', en: 'Confirm the e-mail change', es: 'Confirme el cambio de e-mail' },
    button: { pt: 'CONFIRMAR TROCA', en: 'CONFIRM CHANGE', es: 'CONFIRMAR CAMBIO' },
    note: { pt: 'Se não foi você, não clique e troque a sua senha.', en: 'If it was not you, do not click and change your password.', es: 'Si no fue usted, no haga clic y cambie su contraseña.' },
    why: { pt: 'Você recebeu este e-mail devido a um pedido de troca de e-mail na plataforma.', en: 'You received this e-mail because of an e-mail change request on the platform.', es: 'Recibió este e-mail por una solicitud de cambio de e-mail en la plataforma.' },
  },
  'reset-password': {
    subject: { pt: 'Redefina a sua senha', en: 'Reset your password', es: 'Restablezca su contraseña' },
    title: { pt: 'Redefinir a sua senha', en: 'Reset your password', es: 'Restablecer su contraseña' },
    intro: { pt: 'Olá! Recebemos uma solicitação para redefinir a senha da sua conta no <strong>MetaBuilder PRO</strong>. O link vale por 1 hora.', en: 'Hello! We received a request to reset the password of your <strong>MetaBuilder PRO</strong> account. The link is valid for 1 hour.', es: '¡Hola! Recibimos una solicitud para restablecer la contraseña de su cuenta en <strong>MetaBuilder PRO</strong>. El enlace vale por 1 hora.' },
    boxLabel: { pt: 'Acesso de segurança', en: 'Security access', es: 'Acceso de seguridad' },
    boxText: { pt: 'Defina uma nova senha para a sua conta', en: 'Set a new password for your account', es: 'Defina una nueva contraseña para su cuenta' },
    button: { pt: 'REDEFINIR SENHA', en: 'RESET PASSWORD', es: 'RESTABLECER CONTRASEÑA' },
    note: { pt: 'Se você não realizou esta solicitação, pode ignorar este e-mail com segurança.', en: 'If you did not make this request, you can safely ignore this e-mail.', es: 'Si no realizó esta solicitud, puede ignorar este e-mail con seguridad.' },
    why: { pt: 'Você recebeu este e-mail devido a uma solicitação de redefinição de senha na plataforma.', en: 'You received this e-mail because of a password reset request on the platform.', es: 'Recibió este e-mail por una solicitud de restablecimiento de contraseña en la plataforma.' },
  },
  reauthentication: {
    subject: { pt: 'Seu código de confirmação', en: 'Your confirmation code', es: 'Su código de confirmación' },
    title: { pt: 'Confirme que é você', en: 'Confirm it is you', es: 'Confirme que es usted' },
    intro: { pt: 'Para continuar com uma operação sensível na sua conta do <strong>MetaBuilder PRO</strong>, digite o código abaixo.', en: 'To continue with a sensitive operation on your <strong>MetaBuilder PRO</strong> account, enter the code below.', es: 'Para continuar con una operación sensible en su cuenta de <strong>MetaBuilder PRO</strong>, escriba el código de abajo.' },
    boxLabel: { pt: 'Código de confirmação', en: 'Confirmation code', es: 'Código de confirmación' },
    boxText: { pt: 'Use este código na tela aberta', en: 'Use this code on the open screen', es: 'Use este código en la pantalla abierta' },
    code: true,
    note: { pt: 'Se você não pediu este código, ignore este e-mail e proteja a sua conta trocando a senha.', en: 'If you did not request this code, ignore this e-mail and protect your account by changing your password.', es: 'Si no pidió este código, ignore este e-mail y proteja su cuenta cambiando la contraseña.' },
    why: { pt: 'Você recebeu este e-mail devido a uma operação sensível na sua conta.', en: 'You received this e-mail because of a sensitive operation on your account.', es: 'Recibió este e-mail por una operación sensible en su cuenta.' },
  },
}

fs.mkdirSync(outDir, { recursive: true })
const subjects = []
for (const [name, t] of Object.entries(TEMPLATES)) {
  fs.writeFileSync(path.join(outDir, `${name}.html`), build(t))
  const subject = `${DECLARE}${BRAND}${T(t.subject)}`
  // o campo Subject do Supabase recusa mais de 255 caracteres ("Failed to validate template: subject: Too big"): por isso a marca fica fora
  // das três versões do texto e o gerador para se algum assunto passar do limite
  if (subject.length > SUBJECT_MAX) { console.error(`ERRO: o assunto de ${name} tem ${subject.length} caracteres (máximo ${SUBJECT_MAX}). Encurte o texto.`); process.exitCode = 1 }
  subjects.push(`## ${name}\n\n\`\`\`\n${subject}\n\`\`\`\n`)
  console.log('ok docs/emails-supabase/' + name + '.html')
}
fs.writeFileSync(path.join(outDir, 'assuntos.md'), `# Assuntos dos e-mails do Supabase (GERADO por scripts/gerar-modelos-email-supabase.mjs)\n\nCole cada bloco no campo **Subject** do modelo de mesmo nome. Cada um escolhe o idioma pelo cadastro do usuário. O Supabase aceita no máximo 255 caracteres neste campo (todos os blocos abaixo cabem).\n\n${subjects.join('\n')}`)
console.log('ok docs/emails-supabase/assuntos.md')
