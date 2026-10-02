/**
 * Testes de src/lib/slotGroups.ts (blocos de um grupo do Personalizado).
 * Executar:  npx tsx scripts/slot-groups.test.ts
 */
import assert from 'node:assert/strict'
import { getGroupBlocks, flattenGroupChildren, flattenSlots } from '../src/lib/slotGroups'

let passed = 0
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log(`  ok  - ${name}`) }
  catch (e: any) { console.error(`  FALHOU - ${name}\n    ${e.message}`); process.exitCode = 1 }
}

const a = { id: 'a' }, b = { id: 'b' }, c = { id: 'c' }

console.log('Grupo antigo (fase 1) vira UM bloco')
test('children + group_mode=tabs', () => {
  const blocks = getGroupBlocks({ id: 'g1', type: 'group', group_mode: 'tabs', children: [a, b] })
  assert.equal(blocks.length, 1); assert.equal(blocks[0].mode, 'tabs'); assert.deepEqual(blocks[0].children, [a, b])
})
test('children + group_mode=grid', () => {
  assert.equal(getGroupBlocks({ id: 'g1', group_mode: 'grid', children: [a] })[0].mode, 'grid')
})
test('sem group_mode o padrão é subabas; sem children, bloco vazio', () => {
  const blocks = getGroupBlocks({ id: 'g1' })
  assert.equal(blocks[0].mode, 'tabs'); assert.deepEqual(blocks[0].children, [])
})
test('id do bloco legado é estável (necessário para lembrar a subaba ativa)', () => {
  assert.equal(getGroupBlocks({ id: 'g1', children: [] })[0].id, getGroupBlocks({ id: 'g1', children: [] })[0].id)
})

console.log('Grupo novo (blocos)')
test('mistura quadros e subabas na ordem configurada', () => {
  const blocks = getGroupBlocks({ id: 'g2', blocks: [
    { id: 'x', mode: 'grid', children: [a, b] },
    { id: 'y', mode: 'tabs', children: [c] },
  ] })
  assert.deepEqual(blocks.map((bl) => bl.mode), ['grid', 'tabs'])
  assert.deepEqual(blocks.map((bl) => bl.id), ['x', 'y'])
})
test('blocks tem prioridade sobre children/group_mode', () => {
  const blocks = getGroupBlocks({ id: 'g3', group_mode: 'grid', children: [a], blocks: [{ id: 'z', mode: 'tabs', children: [b] }] })
  assert.equal(blocks.length, 1); assert.equal(blocks[0].mode, 'tabs'); assert.deepEqual(blocks[0].children, [b])
})
test('modo inválido cai em subabas; bloco sem id ganha um estável', () => {
  const blocks = getGroupBlocks({ id: 'g4', blocks: [{ mode: 'qualquer', children: [] }] })
  assert.equal(blocks[0].mode, 'tabs'); assert.equal(blocks[0].id, 'g4-b1')
})

console.log('Achatar')
test('flattenGroupChildren junta os filhos de todos os blocos', () => {
  assert.deepEqual(flattenGroupChildren({ id: 'g', blocks: [{ children: [a] }, { children: [b, c] }] }), [a, b, c])
})
test('flattenSlots: grupo + filhos (legado e novo) + abas normais', () => {
  const tab = { id: 't' }
  const legacy = { id: 'g1', type: 'group', children: [a] }
  const modern = { id: 'g2', type: 'group', blocks: [{ children: [b] }] }
  assert.deepEqual(flattenSlots([tab, legacy, modern]).map((s: any) => s.id), ['t', 'g1', 'a', 'g2', 'b'])
})

console.log(`\n${passed} verificações passaram${process.exitCode ? ' (HÁ FALHAS)' : ''}.`)
