import { describe, it, expect } from 'vitest'
import { transform } from 'sucrase'
import { createSandboxRequire } from '../aiSandboxModules'

const Modal = function Modal() { return null }
const modules = () => ({
  React: { createElement: () => null }, lucide: { Package: function Package() { return null } },
  Modal, client: { from: () => ({}) }, toast: { toast: () => {} }, i18n: { t: (k: string) => k },
})

// Executa o código como o renderizador: Sucrase (imports → require) + Function com o require do sandbox
function run(code: string) {
  const js = transform(code, { transforms: ['typescript', 'jsx', 'imports'], jsxRuntime: 'classic' }).code
  const exp: any = {}
  new Function('require', 'exports', 'PROJECT_ID', 'TUNNEL_CHANNEL', js)(createSandboxRequire(modules()), exp, 'p1', null)
  return exp
}

describe('módulos do sandbox da IA', () => {
  it('Modal chega como componente (import default e nomeado)', () => {
    const exp = run(`
import React from 'react'
import Modal from '@/components/ui/Modal'
import { Modal as M2 } from '@/components/ui/Modal'
export const A = Modal
export const B = M2
export default function C() { return null }
`)
    expect(typeof exp.A).toBe('function')
    expect(exp.A).toBe(Modal)
    expect(exp.B).toBe(Modal)
  })

  it('ícones, cliente de dados, toast e i18n estão disponíveis e estáveis', () => {
    const exp = run(`
import { Package } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/useI18n'
export const p = Package
export const c1 = createClient()
export const c2 = createClient()
export const t1 = useToast()
export const t2 = useToast()
export const i1 = useI18n()
export const i2 = useI18n()
export default function C() { return null }
`)
    expect(typeof exp.p).toBe('function')
    expect(exp.c1).toBe(exp.c2)
    expect(exp.t1).toBe(exp.t2)
    expect(exp.i1).toBe(exp.i2)
  })
})
