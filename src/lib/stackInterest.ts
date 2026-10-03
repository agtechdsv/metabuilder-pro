/** Linguagens/stacks do Eject & Sync que aceitam "Quero ser avisado" (public.stack_interest.stack) */
export const STACK_INTEREST_STACKS = [
  { id: 'nodejs', label: 'Node.js', icon: '🟢' },
  { id: 'java', label: 'Java', icon: '☕' },
  { id: 'csharp', label: 'C#', icon: '💜' },
  { id: 'nestjs', label: 'NestJS', icon: '🦅' },
  { id: 'python', label: 'Python', icon: '🐍' },
  { id: 'php', label: 'PHP', icon: '🐘' },
  { id: 'go', label: 'Go', icon: '🐹' },
  { id: 'rails', label: 'Rails', icon: '💎' },
] as const

/**
 * Modelos de mensagem para os interessados. Variáveis trocadas no envio, para cada pessoa:
 * {nome} = primeiro nome, {stack} = nome da linguagem.
 */
export const STACK_MESSAGE_TEMPLATES = [
  {
    id: 'released',
    label: 'Já disponível',
    subject: 'Boa notícia: a exportação {stack} já está disponível!',
    message:
`Você pediu para ser avisado quando a exportação em {stack} estivesse pronta, e ela acaba de ser liberada no MetaBuilder PRO.

Agora é possível gerar o backend do seu projeto em {stack} direto pelo Eject & Sincronizar, com o código completo na sua máquina e conectado ao seu banco.

Atualize a IDE para a versão mais recente, abra o seu projeto e escolha a aba {stack}. Se encontrar qualquer dificuldade, é só responder esta mensagem.

Obrigado por acompanhar o MetaBuilder PRO desde o começo!`,
  },
  {
    id: 'beta',
    label: 'Convite para testar (beta)',
    subject: 'Quer testar a exportação {stack} antes de todo mundo?',
    message:
`Você registrou interesse na exportação em {stack}, e ela já está pronta para os primeiros testes.

Estamos chamando um grupo pequeno para experimentar antes do lançamento e dizer o que funciona e o que ainda precisa melhorar. Quem participar fala direto com o time e ajuda a definir como a {stack} vai funcionar.

Se quiser entrar, responda esta mensagem com "quero testar" e liberamos o acesso para você.`,
  },
  {
    id: 'progress',
    label: 'Novidade de andamento',
    subject: 'Como anda a exportação {stack}',
    message:
`Passando para contar como estão as coisas com a exportação em {stack}, que você pediu para acompanhar.

O desenvolvimento está em andamento e ela segue na nossa lista de próximas entregas. Assim que houver uma versão para testar, você é um dos primeiros a ser avisado.

Se você tiver um caso de uso específico (banco, tipo de sistema, prazo), conte para nós respondendo esta mensagem. Isso ajuda a decidir o que priorizar.`,
  },
  {
    id: 'survey',
    label: 'Pesquisa rápida',
    subject: 'Duas perguntas rápidas sobre {stack}',
    message:
`Obrigado por pedir para ser avisado sobre a exportação em {stack}!

Para entregarmos o que faz sentido para você, pode responder em uma ou duas linhas?

1) Qual banco de dados você usa (Oracle, Postgres ou outro)?
2) Para qual tipo de sistema você pretende gerar o código em {stack}?

Suas respostas ajudam a priorizar o que vem primeiro.`,
  },
] as const

/** Troca {nome} e {stack} no texto */
export function fillStackTemplate(text: string, vars: { nome: string; stack: string }) {
  return text.replace(/\{nome\}/g, vars.nome).replace(/\{stack\}/g, vars.stack)
}

export type StackInterestId = typeof STACK_INTEREST_STACKS[number]['id']

export interface StackInterestSummaryRow { stack: string; total: number }

export interface StackInterestUser {
  userId: string
  name: string
  email: string | null
  avatarUrl: string | null
  createdAt: string
}

export interface StackMessageResult {
  userId: string
  name: string
  email: { ok: boolean; error?: string; skipped?: boolean }
  chat: { ok: boolean; error?: string; skipped?: boolean }
}
