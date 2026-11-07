/**
 * Ajuda da PLATAFORMA: tours e dicas escritos pela equipe do MetaBuilder para quem usa o Studio e as demais áreas (dev e owner).
 * Não confundir com a ajuda do USUÁRIO FINAL de um app (lib/interactiveHelp), que o dev escreve e fica no caso de uso dele.
 *
 * Um tour é GUIADO: destaca elementos da tela e explica, mas quem clica é a pessoa (nada é executado sozinho, nada é gravado).
 * Cada elemento é achado por um identificador estável (`data-help-id`), nunca pelo texto da tela, que muda com o idioma.
 */

import type { HelpText } from '../helpText'

export interface PlatformStep {
  id: string
  /** valor do atributo `data-help-id` do elemento a destacar; sem ele, o balão aparece no centro */
  target?: string
  title?: HelpText
  body: HelpText
  /** antes de mostrar o passo, clica neste elemento (só para NAVEGAR: abrir uma aba ou o assistente, nunca para gravar) */
  enterClick?: string
  /** o passo só avança quando a pessoa clica no próprio elemento destacado (ex.: "Próximo passo" do assistente) */
  advanceOnClick?: boolean
  /** deixa a pessoa usar o item destacado sem avançar (preencher o nome, escolher a lógica). Os outros passos bloqueiam a tela */
  interactive?: boolean
}

export interface PlatformTour {
  id: string
  /** onde ele aparece: caminho com `:param` (um trecho) e `*` no fim (qualquer coisa depois). Ex.: /admin/:ws/:proj/studio/data */
  route: string
  title: HelpText
  summary: HelpText
  steps: PlatformStep[]
  /**
   * Como voltar ao ponto de partida do tour se a pessoa saiu dele (abriu o assistente, a IA, outra aba): `data-help-id` de botões que
   * levam de volta ("Voltar ao Studio", aba Casos de Uso...). O primeiro visível é clicado quando o alvo do passo não aparece.
   */
  recover?: string[]
}

export interface ActiveTour { tour: PlatformTour; index: number; /** página em que o tour começou: se a pessoa navegar para outra, o tour termina */ path?: string }
