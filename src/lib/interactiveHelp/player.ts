/**
 * Motor do player da Ajuda Interativa: executa os passos de um roteiro, um a um, com velocidade ajustável, pausa e passo a passo.
 * Não conhece o DOM: tudo o que toca a tela passa por um `PlayerAdapter` (o de produção está em domAdapter.ts).
 */

import { resolveHelp } from '../helpText'
import { SPEED_FACTOR, type Tour, type TourSpeed, type TourStep } from './types'

export interface PlayerAdapter {
  /** Procura o elemento do passo, esperando até `timeoutMs` (a tela pode estar carregando). `null` = não existe (passo é pulado). */
  find(step: TourStep, timeoutMs: number): Promise<unknown | null>
  /** Destaca o elemento (ou só mostra a legenda, sem elemento) e leva o cursor até ele. */
  showStep(el: unknown | null, caption: string, index: number, total: number): void
  click(el: unknown): void
  /** Define o texto atual do campo (o motor chama a cada letra). */
  setText(el: unknown, text: string): void
  /** Escolhe a primeira opção não vazia (esperando as opções carregarem). Devolve se conseguiu. */
  selectFirst(el: unknown): Promise<boolean>
  /** Escolhe a opção cujo valor é `value`. */
  selectValue(el: unknown, value: string): boolean
  check(el: unknown): void
  /** Limpa o destaque e o balão (fim do tutorial). */
  clear(): void
}

export type PlayerState = 'idle' | 'playing' | 'paused' | 'ended'

export interface PlayerSnapshot {
  state: PlayerState
  index: number
  total: number
  caption: string
  /** passos pulados até agora (elemento ausente, sem permissão, lista vazia...) */
  skipped: number
}

export interface PlayerOptions {
  language?: string
  speed?: TourSpeed
  onChange?: (s: PlayerSnapshot) => void
  /** o usuário prefere menos movimento: sem pausas longas de animação */
  reducedMotion?: boolean
}

// tempos base em ms, multiplicados pelo fator da velocidade
const BASE = { travel: 650, afterClick: 700, between: 350, perChar: 70, find: 2500, readMin: 700, readPerChar: 28, readMax: 4500 }
const SLICE = 40

export class TourPlayer {
  private state: PlayerState = 'idle'
  private index = 0
  private skipped = 0
  private caption = ''
  private factor: number
  private stepBudget = 0 // >0: libera exatamente N passos estando pausado
  private cancelled = false
  private running = false

  constructor(private tour: Tour, private adapter: PlayerAdapter, private opts: PlayerOptions = {}) {
    this.factor = SPEED_FACTOR[opts.speed ?? 'normal']
  }

  get snapshot(): PlayerSnapshot { return { state: this.state, index: this.index, total: this.tour.steps.length, caption: this.caption, skipped: this.skipped } }
  private emit() { this.opts.onChange?.(this.snapshot) }

  setSpeed(speed: TourSpeed) { this.factor = SPEED_FACTOR[speed] }

  /** Começa (ou continua, se estava pausado). */
  play() {
    if (this.state === 'ended' || this.cancelled) return
    if (this.state === 'paused') { this.state = 'playing'; this.emit(); return }
    if (this.state === 'playing') return
    this.state = 'playing'
    this.emit()
    void this.run()
  }

  pause() { if (this.state === 'playing') { this.state = 'paused'; this.emit() } }

  /** Pausado: executa só o próximo passo e volta a pausar. Tocando: pausa. Parado no início: executa o primeiro. */
  step() {
    if (this.state === 'ended' || this.cancelled) return
    if (this.state === 'playing') { this.pause(); return }
    this.stepBudget = 1
    if (this.state === 'idle') { this.state = 'paused'; this.emit(); void this.run() } else this.emit()
  }

  stop() { this.cancelled = true; this.adapter.clear() }

  private scaled(ms: number) { return Math.max(0, Math.round(ms * this.factor * (this.opts.reducedMotion ? 0.5 : 1))) }

  /** Dorme em fatias, para a pausa e o cancelamento terem efeito imediato. */
  private async wait(ms: number) {
    let left = this.scaled(ms)
    while (left > 0 && !this.cancelled) {
      await this.gate()
      const slice = Math.min(SLICE, left)
      await new Promise(r => setTimeout(r, slice))
      left -= slice
    }
  }

  private async gate() {
    while (this.state === 'paused' && this.stepBudget === 0 && !this.cancelled) await new Promise(r => setTimeout(r, SLICE))
  }

  private async run() {
    if (this.running) return
    this.running = true
    try {
      for (; this.index < this.tour.steps.length && !this.cancelled; this.index++) {
        await this.gate()
        if (this.cancelled) break
        await this.runStep(this.tour.steps[this.index], this.index)
        // pausado (passo a passo, ou pausa no meio de um passo): termina aqui e volta a esperar
        if (this.state === 'paused') { this.stepBudget = 0; this.emit() }
      }
      if (!this.cancelled) {
        this.index = this.tour.steps.length
        this.state = 'ended'
        this.caption = ''
        this.adapter.clear()
        this.emit()
      }
    } finally { this.running = false }
  }

  private async runStep(step: TourStep, i: number) {
    const total = this.tour.steps.length
    const caption = resolveHelp(step.caption, this.opts.language)
    this.caption = caption
    let el: unknown | null = null
    if (step.target) {
      el = await this.adapter.find(step, BASE.find)
      if (this.cancelled) return
      if (!el) { this.skipped++; this.emit(); return } // não existe nesta tela (oculto, sem permissão...): segue sem travar
    }
    this.adapter.showStep(el, caption, i, total)
    this.emit()
    await this.wait(BASE.travel)
    // tempo para ler a legenda, proporcional ao tamanho
    await this.wait(Math.min(BASE.readMax, BASE.readMin + caption.length * BASE.readPerChar))
    if (this.cancelled) return

    if (step.kind === 'click' && el) {
      this.adapter.click(el)
      await this.wait(BASE.afterClick)
    } else if (step.kind === 'type' && el && typeof step.value === 'string') {
      this.adapter.setText(el, '')
      for (let c = 1; c <= step.value.length && !this.cancelled; c++) {
        await this.gate()
        this.adapter.setText(el, step.value.slice(0, c))
        await this.wait(BASE.perChar)
      }
    } else if (step.kind === 'select' && el) {
      const ok = step.value && typeof step.value === 'object' ? await this.adapter.selectFirst(el) : this.adapter.selectValue(el, String(step.value ?? ''))
      if (!ok) this.skipped++
      await this.wait(BASE.afterClick / 2)
    } else if (step.kind === 'check' && el) {
      this.adapter.check(el)
      await this.wait(BASE.afterClick / 2)
    }
    await this.wait(BASE.between)
  }
}
