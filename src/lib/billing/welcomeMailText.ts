/**
 * E-mail de boas-vindas ao cliente novo (modelo da marca), em pt, en e es. Texto puro e testável; a fila e o envio ficam em billingService.ts.
 * O nome de quem se cadastrou é sempre escapado.
 */
import { SALES_WHATSAPP_DISPLAY as WA } from '../contact'
import { button, esc, infoBox, mailShell, type MailContent, type MailLang } from '../security/securityMailText'

export interface WelcomeMailData {
  /** primeiro nome (ou o e-mail, se a conta não tiver nome) */
  name: string
  /** endereço do site (sem barra no fim) */
  appUrl: string
}

const TEXTS = {
  pt: {
    subject: 'Bem-vindo ao MetaBuilder PRO',
    title: 'Bem-vindo ao MetaBuilder PRO!',
    intro: (n: string) => `Olá, ${n}! A sua conta foi criada. O MetaBuilder PRO monta telas (cadastros, Kanban, Gantt, BI, mapas e mais) a partir de configuração e as executa como aplicativo ou as exporta como app Node ou Java.`,
    box: 'Primeiros passos',
    steps: [['1', 'Entre no seu painel e crie o seu primeiro workspace.'], ['2', 'Monte uma tela no Studio, a partir de configuração.'], ['3', `Precisa de ajuda? Escreva para suporte@metabuilderpro.com ou chame no WhatsApp ${WA}.`]] as [string, string][],
    button: 'ABRIR O MEU PAINEL',
    why: 'Você recebeu este e-mail porque criou uma conta no MetaBuilder PRO.',
  },
  en: {
    subject: 'Welcome to MetaBuilder PRO',
    title: 'Welcome to MetaBuilder PRO!',
    intro: (n: string) => `Hello, ${n}! Your account has been created. MetaBuilder PRO builds screens (forms, Kanban, Gantt, BI, maps and more) from configuration and runs them as an app or exports them as a Node or Java app.`,
    box: 'First steps',
    steps: [['1', 'Open your dashboard and create your first workspace.'], ['2', 'Build a screen in the Studio, from configuration.'], ['3', `Need help? Write to suporte@metabuilderpro.com or message us on WhatsApp ${WA}.`]] as [string, string][],
    button: 'OPEN MY DASHBOARD',
    why: 'You received this e-mail because you created an account on MetaBuilder PRO.',
  },
  es: {
    subject: 'Bienvenido a MetaBuilder PRO',
    title: '¡Bienvenido a MetaBuilder PRO!',
    intro: (n: string) => `¡Hola, ${n}! Su cuenta fue creada. MetaBuilder PRO construye pantallas (formularios, Kanban, Gantt, BI, mapas y más) a partir de configuración y las ejecuta como aplicación o las exporta como app Node o Java.`,
    box: 'Primeros pasos',
    steps: [['1', 'Entre a su panel y cree su primer workspace.'], ['2', 'Construya una pantalla en el Studio, a partir de configuración.'], ['3', `¿Necesita ayuda? Escriba a suporte@metabuilderpro.com o hable por WhatsApp ${WA}.`]] as [string, string][],
    button: 'ABRIR MI PANEL',
    why: 'Recibió este e-mail porque creó una cuenta en MetaBuilder PRO.',
  },
} as const

/** Boas-vindas ao cliente novo. O botão leva ao painel (/workspace). */
export function welcomeMail(lang: MailLang, d: WelcomeMailData): MailContent {
  const L = TEXTS[lang] || TEXTS.pt
  const url = `${d.appUrl}/workspace`
  const html = mailShell(L.title,
    `<p style="margin:0 0 20px 0;">${esc(L.intro(d.name))}</p>` + infoBox(L.box, L.steps.map(([n, s]) => [n, s] as [string, string])) + button(L.button, url),
    `© ${new Date().getFullYear()} METABUILDER PRO · ${L.why}`)
  const text = [L.title, '', L.intro(d.name), '', L.box, ...L.steps.map(([n, s]) => `${n}. ${s}`), '', `${L.button}: ${url}`].join('\n')
  return { subject: L.subject, html, text }
}
