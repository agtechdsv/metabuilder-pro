import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter'
import { eventLine, statusFromPlaywright, type TestEvent } from '../../src/lib/testing/results'

/**
 * Relator para o painel "Ambiente de Testes" da IDE: escreve uma linha por evento (começou / terminou / acabou) na saída, em JSON, depois do prefixo
 * @@MB@@. O painel lê a saída, separa estas linhas e atualiza a tela ao vivo. Não substitui o relatório HTML: roda ao lado dele.
 */
export default class IdeReporter implements Reporter {
  private total = 0
  private passed = 0
  private failed = 0
  private skipped = 0

  // o grupo é o "describe" (caso de uso) e o título é o do teste: os dois últimos itens do caminho (projeto, arquivo, grupo, teste)
  private names(test: TestCase) {
    const p = test.titlePath()
    return { group: p[p.length - 2] ?? '', title: p[p.length - 1] ?? '' }
  }

  private emit(ev: TestEvent) { process.stdout.write(eventLine(ev) + '\n') }

  onTestBegin(test: TestCase) {
    this.emit({ t: 'begin', ...this.names(test) })
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const status = statusFromPlaywright(result.status)
    this.total++
    if (status === 'passed') this.passed++
    else if (status === 'skipped') this.skipped++
    else this.failed++
    const message = result.error?.message ?? ''
    // sem os códigos de cor do terminal, e só o começo: o relatório HTML tem o resto
    const error = message ? message.replace(/\u001b\[[0-9;]*m/g, '').split('\n').slice(0, 6).join('\n') : undefined
    const anexo = (nome: string) => result.attachments.find(a => a.name === nome)?.body?.toString()
    const shot = anexo('mb-shot')
    const video = anexo('mb-video')
    this.emit({ t: 'end', ...this.names(test), status, ms: result.duration, ...(error ? { error } : {}), ...(shot ? { shot } : {}), ...(video ? { video } : {}) })
  }

  onEnd(_result: FullResult) {
    this.emit({ t: 'done', total: this.total, passed: this.passed, failed: this.failed, skipped: this.skipped })
  }
}
