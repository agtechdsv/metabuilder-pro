import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  FAMILY_APPS, LEGACY_OWN_REF_PREFIXES, OWN_APP_CODE, appOfRef, buildPaymentRef, isOwnRef, parsePaymentRef, type FamilyCycleCode,
} from '../../../supabase/functions/_shared/familyRefs'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

const WS = '646311ab0c4d4e5f8a9b0c1d2e3f4a5b' // 32 hex, como o id do workspace sem hífen
const WS_UUID = '646311ab-0c4d-4e5f-8a9b-0c1d2e3f4a5b'

// Padrão de referências da Família PRO: <app>_<entidade>_<id>[_<rótulo>_<valor>]...
describe('padrão de referências da Família PRO', () => {
  it('os códigos dos apps têm 2 letras, são únicos e nenhum é prefixo do outro', () => {
    const codes = Object.keys(FAMILY_APPS)
    expect(codes).toEqual(['mb', 'tm', 'vt'])
    for (const c of codes) expect(c).toMatch(/^[a-z]{2}$/)
    expect(new Set(codes).size).toBe(codes.length)
    expect(OWN_APP_CODE).toBe('mb')
  })

  it('monta a referência de pagamento: app, entidade, id e rótulos (l ou u, cy, t)', () => {
    const ref = buildPaymentRef({ workspaceId: WS_UUID, licenses: 3, upgrade: false, cycleCode: 'mo', timestamp: 1763000000.9 })
    expect(ref).toBe(`mb_ws_${WS}_l_3_cy_mo_t_1763000000`)
    expect(buildPaymentRef({ workspaceId: WS, licenses: 2, upgrade: true, cycleCode: 'ye', timestamp: 1763000000 })).toBe(`mb_ws_${WS}_u_2_cy_ye_t_1763000000`)
    // uuid com hífen e maiúsculas vira os mesmos 32 hex minúsculos
    expect(buildPaymentRef({ workspaceId: WS_UUID.toUpperCase(), licenses: 1, upgrade: false, cycleCode: 'qu', timestamp: 1 })).toContain(`_ws_${WS}_`)
  })

  it('cabe no limite de 100 caracteres do Asaas, mesmo com números grandes', () => {
    const big = buildPaymentRef({ workspaceId: WS, licenses: 999999, upgrade: true, cycleCode: 'se', timestamp: 9_999_999_999_999 })
    expect(big.length).toBeLessThanOrEqual(100)
    expect(buildPaymentRef({ workspaceId: WS, licenses: 3, upgrade: false, cycleCode: 'mo', timestamp: 1763000000 }).length).toBeLessThanOrEqual(70)
  })

  it('lê de volta o que montou (ida e volta) para os 4 ciclos, compra e upgrade', () => {
    for (const cycleCode of ['mo', 'qu', 'se', 'ye'] as FamilyCycleCode[]) {
      for (const upgrade of [false, true]) {
        const ref = buildPaymentRef({ workspaceId: WS, licenses: 7, upgrade, cycleCode, timestamp: 1763000123 })
        expect(parsePaymentRef(ref), ref).toEqual({ workspaceId: WS, licenses: 7, upgrade, cycleCode, timestamp: 1763000123, legacy: false })
      }
    }
  })

  it('não lê o que não for o formato (outro app, id curto, ciclo inventado, lixo)', () => {
    for (const ref of [
      `tm_ws_${WS}_l_3_cy_mo_t_1763000000`, // outro app
      `mb_ws_${WS.slice(0, 31)}_l_3_cy_mo_t_1`, // id com 31 caracteres
      `mb_ws_${WS}_l_3_cy_xx_t_1`, // ciclo desconhecido
      `mb_ws_${WS}_x_3_cy_mo_t_1`, // rótulo desconhecido
      `mb_ws_${WS}_l_3_cy_mo_t_1_extra`, `mb_us_${WS_UUID}`, '', 'mb_', null, undefined, 42,
    ]) expect(parsePaymentRef(ref), String(ref)).toBeNull()
  })

  it('reconhece de quem é a referência: deste app, de outro da família, ou fora do padrão', () => {
    expect(isOwnRef(`mb_ws_${WS}_l_3_cy_mo_t_1`)).toBe(true)
    expect(isOwnRef(`mb_us_${WS_UUID}`)).toBe(true)
    expect(isOwnRef(`tm_ws_${WS}`)).toBe(false)
    expect(isOwnRef(`vt_x`)).toBe(false)
    expect(isOwnRef('tmp_x')).toBe(false)
    expect(appOfRef(`mb_ws_${WS}`)).toBe('mb')
    expect(appOfRef(`tm_ws_${WS}`)).toBe('tm')
    expect(appOfRef(`vt_us_x`)).toBe('vt')
    expect(appOfRef('tmp_x')).toBeNull() // "tmp_" não é "tm_": o separador faz parte do código
    expect(appOfRef('')).toBeNull()
    expect(appOfRef(null)).toBeNull()
  })
})

// LEGADO: dados de TESTE de antes do padrão. Remover este bloco (e o legado do módulo) na primeira limpeza geral, quando os dados forem zerados.
describe('LEGADO (remover na primeira limpeza geral): formato anterior ao padrão', () => {
  const legacy = `w_${WS}_l_3_c_mo_1763000000` // o formato que as 5 cobranças de teste têm (54 caracteres)

  it('o formato antigo ainda é lido e marcado como legado', () => {
    expect(legacy.length).toBe(54)
    expect(parsePaymentRef(legacy)).toEqual({ workspaceId: WS, licenses: 3, upgrade: false, cycleCode: 'mo', timestamp: 1763000000, legacy: true })
    expect(parsePaymentRef(`w_${WS}_u_2_c_ye_1763000000`)?.upgrade).toBe(true)
  })

  it('os prefixos antigos (w_, ws_, u_) contam como deste app', () => {
    expect([...LEGACY_OWN_REF_PREFIXES]).toEqual(['w_', 'ws_', 'u_'])
    for (const ref of [legacy, 'ws_x_pl_1_cy_monthly_t_1', 'u_1234']) {
      expect(isOwnRef(ref), ref).toBe(true)
      expect(appOfRef(ref), ref).toBe('mb')
    }
  })
})

describe('uso no código (sem ler letra por posição)', () => {
  it('o checkout escreve a referência pelo padrão e o webhook lê pelo padrão', () => {
    const co = read('supabase/functions/asaas-checkout/index.ts')
    expect(co).toContain('buildPaymentRef({')
    expect(co).not.toMatch(/`w_\$\{/) // acabou a montagem à mão no formato antigo
    const hook = read('supabase/functions/asaas-webhook/index.ts')
    expect(hook).toContain('parsePaymentRef(extRef)')
    expect(hook).toContain('parsePaymentRef(ctx.externalReference)?.upgrade === true')
    expect(hook).not.toContain('includes("_u_")')
    expect(hook).not.toContain('extRef.split("_")')
    expect(hook).not.toContain('[S3]') // a estratégia 3 nunca resolvia nada (a referência traz o workspace, não o usuário)
    expect(read('scripts/bundle-edge-functions.mjs')).toContain("'familyRefs'")
  })
})
