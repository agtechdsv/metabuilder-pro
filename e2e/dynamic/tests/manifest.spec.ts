import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { entrar } from '../../real/tests/helpers'
import { realQuery } from '../../real/guard'
import type { TestManifest, ManifestField, ManifestView } from '../../../src/lib/testing/manifestTypes'

/**
 * Testes DINÂMICOS: não há um teste escrito por caso de uso. Este arquivo lê o manifesto (o que o dev configurou no Studio) e gera os testes de cada
 * caso de uso a partir dele. Caso de uso novo ou alterado no Studio → manifesto novo → testes novos, sem escrever nada.
 * Nesta primeira versão: Pesquisa + Cadastro (lista: filtros e colunas; formulário: campos, obrigatórios, somente leitura, máscaras).
 * Outros tipos de tela aparecem como "ainda sem teste automático" até ganharem seu gabarito.
 *
 * Segurança: nenhum teste daqui grava dado. O único que poderia (salvar o formulário vazio) só passa se o app RECUSAR; se algum registro for criado
 * por engano o teste apaga o que foi criado e falha. O guard (banco local da lista permitida, contagens e ligações conferidas no fim) vale como nos demais.
 */
const MANIFEST_PATH = process.env.E2E_MANIFEST || path.join(import.meta.dirname, '..', 'manifests', 'vendas-pg.sample.json')
const manifest: TestManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** "00.000.000/0000-00" + dígitos → "11.111.111/1111-11" (cada 0 consome um dígito; o resto é literal). */
export function aplicarMascara(digitos: string, mascara: string): string {
  let out = ''; let i = 0
  for (const ch of mascara) {
    if (i >= digitos.length) break
    if (ch === '0') out += digitos[i++]
    else out += ch
  }
  return out
}
/** Só máscaras de padrão fixo (0 = dígito; . - / ( ) e espaço literais). Máscaras numéricas (0.000,00) têm outra regra e não entram aqui. */
const mascaraDePadrao = (m?: string) => !!m && /^[0.\-/() ]+$/.test(m) && /0{2}/.test(m) && !/^0\.0+,0+$/.test(m)

const ehTela = (v: ManifestView) => v.logicType === 'pesquisa_cadastro'
const camposEditaveis = (v: ManifestView): ManifestField[] => v.form.filter(f => !f.isPrimaryKey)

async function abrir(page: Page, rota: string) {
  await page.goto(rota)
  await page.waitForLoadState('networkidle').catch(() => {})
}

for (const view of manifest.views) {
  test.describe(`${view.title} (${view.slug}) · ${view.logicType}`, () => {
    if (!ehTela(view)) {
      test('tipo de tela ainda sem teste automático', () => { test.skip(true, `logic_type "${view.logicType}" ainda não tem gabarito de teste`) })
      return
    }

    test.beforeEach(async ({ page }) => { await entrar(page) })

    test('lista: os filtros e as colunas do caso de uso estão na tela', async ({ page }) => {
      await abrir(page, view.path)
      for (const f of view.filter) {
        await expect.soft(page.locator(`[name="${f.column}_filter"]`).first(), `filtro "${f.label}" (${f.column}_filter)`).toBeVisible()
      }
      for (const f of view.grid) {
        await expect.soft(page.locator('thead th').filter({ hasText: new RegExp(escapar(f.label), 'i') }).first(), `coluna "${f.label}" no grid`).toBeVisible()
      }
    })

    test('formulário novo: os campos existem, com obrigatório e somente leitura como configurado', async ({ page }) => {
      await abrir(page, `${view.path}/new`)
      for (const f of camposEditaveis(view)) {
        const campo = page.locator(`[name="${f.column}"]`).first()
        await expect.soft(campo, `campo "${f.label}" (${f.column})`).toBeVisible()
        if (!(await campo.count())) continue
        if (f.dataType !== 'boolean') {
          const obrigatorio = (await campo.getAttribute('required')) !== null
          expect.soft(obrigatorio, `"${f.label}": obrigatório esperado ${f.required}`).toBe(f.required)
        }
        if (f.readOnly) {
          const travado = (await campo.getAttribute('readonly')) !== null || (await campo.isDisabled())
          expect.soft(travado, `"${f.label}": deveria ser somente leitura`).toBe(true)
        }
      }
    })

    for (const f of camposEditaveis(view).filter(x => mascaraDePadrao(x.mask))) {
      test(`máscara de "${f.label}" (${f.mask}) formata o que se digita`, async ({ page }) => {
        await abrir(page, `${view.path}/new`)
        const digitos = '1234567890123456789'.slice(0, (f.mask as string).split('0').length - 1)
        const campo = page.locator(`[name="${f.column}"]`).first()
        await campo.click()
        await campo.pressSequentially(digitos)
        await expect(campo).toHaveValue(aplicarMascara(digitos, f.mask as string))
      })
    }

    if (camposEditaveis(view).some(f => f.required)) {
      test('obrigatórios: salvar o formulário vazio não cria registro', async ({ page }) => {
        const ids = async () => new Set((await realQuery(`select ${view.primaryKey}::text as id from ${view.table}`)).map(r => String(r.id)))
        const antes = await ids()
        await abrir(page, `${view.path}/new`)
        await page.getByRole('button', { name: 'Criar Registro' }).first().click()
        await page.waitForTimeout(1500)
        const novos = [...(await ids())].filter(id => !antes.has(id))
        if (novos.length > 0) {
          // o app aceitou salvar vazio: apaga só o que esta tela criou e falha
          for (const id of novos) await realQuery(`delete from ${view.table} where ${view.primaryKey}::text = $1`, [id])
        }
        expect(novos, `o app criou ${novos.length} registro(s) com os campos obrigatórios vazios`).toEqual([])
      })
    }
  })
}
