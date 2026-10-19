// Gera um PDF a partir do HTML do relatório de testes (usado pelo botão Download > PDF do painel da IDE).
// Uso: node dynamic/make-pdf.mjs <relatorio.html> <saida.pdf>
import { chromium } from '@playwright/test'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const [html, pdf] = process.argv.slice(2)
if (!html || !pdf) {
  console.error('Uso: node dynamic/make-pdf.mjs <relatorio.html> <saida.pdf>')
  process.exit(2)
}

const browser = await chromium.launch({ channel: 'chrome' })
try {
  const page = await browser.newPage()
  await page.goto(pathToFileURL(path.resolve(html)).href)
  await page.emulateMedia({ media: 'print' })
  await page.pdf({ path: path.resolve(pdf), format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' } })
} finally {
  await browser.close()
}
