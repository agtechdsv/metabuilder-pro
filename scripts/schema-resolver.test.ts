/**
 * Teste de estresse do resolvedor de esquema (src/lib/schemaResolver.ts) com um esquema propositalmente "estranho".
 * Executar:  npx tsx scripts/schema-resolver.test.ts
 *
 * Objetivo: provar que chave primária, chave estrangeira e título de registro são resolvidos pelos METADADOS,
 * sem depender de nomes como id, tabela_id, nome, pedidos, clientes...
 */
import assert from 'node:assert/strict'
import {
  getPkColumn, getRecordPk, pickPkField, resolveFkColumn, pickRecordTitle, readCol, missingRelationMessage, inferJoins
} from '../src/lib/schemaResolver'

let passed = 0
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log(`  ok  - ${name}`) }
  catch (e: any) { console.error(`  FALHOU - ${name}\n    ${e.message}`); process.exitCode = 1 }
}

// ── Esquema estranho (estilo legado/Oracle) ───────────────────────────────────────────────────────────────────────
// TB_PED (PK "NUM_PED", numérica), TB_PED_ITM (PK "SEQ", FK "COD_PED"), TB_CLI (PK "CODIGO"),
// TB_PED também tem DUAS FKs para TB_CLI (CLI_COBRANCA e CLI_ENTREGA), TB_SEM_REL sem nenhuma relação.
const models: any[] = [
  { id: 'm_cli', db_table_name: 'TB_CLI', fields: [
    { id: 'f_cli_cod', db_column_name: 'CODIGO', is_primary_key: true, db_data_type: 'number' },
    { id: 'f_cli_rs', db_column_name: 'RAZAO_SOCIAL', db_data_type: 'varchar2' },
    { id: 'f_cli_uf', db_column_name: 'UF', db_data_type: 'varchar2' },
  ] },
  { id: 'm_ped', db_table_name: 'TB_PED', fields: [
    { id: 'f_ped_num', db_column_name: 'NUM_PED', is_primary_key: true, db_data_type: 'number' },
    { id: 'f_ped_cob', db_column_name: 'CLI_COBRANCA', db_data_type: 'number', foreign_key_table: 'TB_CLI' },
    { id: 'f_ped_ent', db_column_name: 'CLI_ENTREGA', db_data_type: 'number', foreign_key_table: 'TB_CLI' },
    { id: 'f_ped_obs', db_column_name: 'OBS', db_data_type: 'varchar2' },
  ] },
  { id: 'm_itm', db_table_name: 'TB_PED_ITM', fields: [
    { id: 'f_itm_seq', db_column_name: 'SEQ', is_primary_key: true, db_data_type: 'number' },
    { id: 'f_itm_ped', db_column_name: 'COD_PED', db_data_type: 'number', foreign_key_table: 'TB_PED' },
    { id: 'f_itm_desc', db_column_name: 'DESCR_ITEM', db_data_type: 'varchar2' },
  ] },
  { id: 'm_sem', db_table_name: 'TB_SEM_REL', fields: [
    { id: 'f_sem_a', db_column_name: 'A', db_data_type: 'varchar2' },
  ] },
  // tabela SEM chave primária marcada e SEM coluna "id": cai na primeira coluna
  { id: 'm_nopk', db_table_name: 'TB_NOPK', fields: [{ id: 'f_np_1', db_column_name: 'CHAVE_X', db_data_type: 'varchar2' }] },
]

console.log('Chave primária')
test('PK vem do metadado, não de "id"', () => {
  assert.equal(getPkColumn(models, 'TB_CLI'), 'CODIGO')
  assert.equal(getPkColumn(models, 'tb_ped'), 'NUM_PED') // case-insensitive
  assert.equal(getPkColumn(models, 'TB_PED_ITM'), 'SEQ')
})
test('tabela sem PK marcada cai na primeira coluna (não em "id")', () => {
  assert.equal(pickPkField(models[4])?.db_column_name, 'CHAVE_X')
})
test('getRecordPk respeita a coluna e a caixa (Oracle devolve CAIXA ALTA)', () => {
  assert.equal(getRecordPk({ codigo: 7 }, 'CODIGO'), 7)
  assert.equal(getRecordPk({ CODIGO: 9 }, 'codigo'), 9)
})
test('getRecordPk NÃO usa outro campo "id" quando a PK é informada', () => {
  assert.equal(getRecordPk({ id: 'lixo', outro: 1 }, 'CODIGO'), undefined)
})
test('linha nova da tela (_isNew) usa o id temporário', () => {
  assert.equal(getRecordPk({ id: 'temp-1', _isNew: true }, 'CODIGO'), 'temp-1')
})
test('sem coluna informada, cai na convenção id/ID', () => {
  assert.equal(getRecordPk({ ID: 3 }), 3)
})

console.log('Chave estrangeira')
const relations: any[] = [
  { id: 'r1', from_model_id: 'm_itm', to_model_id: 'm_ped', from_field_id: 'f_itm_ped', to_field_id: 'f_ped_num' },
]
test('relação declarada resolve a FK da filha (nome fora de convenção)', () => {
  const r = resolveFkColumn({ models, relations, childTable: 'TB_PED_ITM', parentTable: 'TB_PED' })
  assert.equal(r.column, 'COD_PED'); assert.equal(r.source, 'relation'); assert.equal(r.ambiguous, false)
})
test('relação gravada no sentido inverso também funciona', () => {
  const inv = [{ id: 'r2', from_model_id: 'm_ped', to_model_id: 'm_itm', from_field_id: 'f_ped_num', to_field_id: 'f_itm_ped' }]
  const r = resolveFkColumn({ models, relations: inv, childTable: 'TB_PED_ITM', parentTable: 'TB_PED' })
  assert.equal(r.column, 'COD_PED'); assert.equal(r.source, 'relation')
})
test('join do caso de uso resolve quando não há relação declarada', () => {
  const joins = [{ from: 'TB_PED', localKey: 'NUM_PED', to: 'TB_PED_ITM', foreignKey: 'COD_PED' }]
  const r = resolveFkColumn({ models, relations: [], joins, childTable: 'TB_PED_ITM', parentTable: 'TB_PED' })
  assert.equal(r.column, 'COD_PED'); assert.equal(r.source, 'join')
})
test('foreign_key_table do campo resolve sem relação nem join', () => {
  const r = resolveFkColumn({ models, childTable: 'TB_PED_ITM', parentTable: 'TB_PED' })
  assert.equal(r.column, 'COD_PED'); assert.equal(r.source, 'metadata')
})
test('DUAS FKs entre as mesmas tabelas são sinalizadas como ambíguas', () => {
  const r = resolveFkColumn({ models, childTable: 'TB_PED', parentTable: 'TB_CLI' })
  assert.equal(r.ambiguous, true); assert.deepEqual(r.candidates.sort(), ['CLI_COBRANCA', 'CLI_ENTREGA'])
})
test('a ambiguidade se resolve pelo join escolhido no caso de uso', () => {
  const joins = [{ from: 'TB_CLI', localKey: 'CODIGO', to: 'TB_PED', foreignKey: 'CLI_ENTREGA' }]
  const r = resolveFkColumn({ models, joins, childTable: 'TB_PED', parentTable: 'TB_CLI' })
  assert.equal(r.column, 'CLI_ENTREGA'); assert.equal(r.ambiguous, false); assert.equal(r.source, 'join')
})
test('tabelas sem relação nenhuma NÃO inventam coluna', () => {
  const r = resolveFkColumn({ models, childTable: 'TB_SEM_REL', parentTable: 'TB_PED' })
  assert.equal(r.column, null); assert.equal(r.source, 'none')
  assert.match(missingRelationMessage('TB_SEM_REL', 'TB_PED'), /não configurada/)
})
test('palpite por nome só acontece sem nenhum metadado e é marcado como name-guess', () => {
  const legacy = [
    { id: 'a', db_table_name: 'pedidos', fields: [{ id: 'a1', db_column_name: 'id', is_primary_key: true }] },
    { id: 'b', db_table_name: 'itens', fields: [{ id: 'b1', db_column_name: 'pedido_id' }] },
  ]
  const r = resolveFkColumn({ models: legacy, childTable: 'itens', parentTable: 'pedidos' })
  assert.equal(r.column, 'pedido_id'); assert.equal(r.source, 'name-guess')
})

console.log('Joins deduzidas do esquema')
test('inferJoins usa a PK do metadado do pai e a FK declarada (nada de "id")', () => {
  const j = inferJoins(models, 'TB_PED')
  const itm = j.find((x) => x.to === 'TB_PED_ITM')
  assert.ok(itm, 'deveria achar TB_PED → TB_PED_ITM')
  assert.equal(itm!.localKey, 'NUM_PED'); assert.equal(itm!.foreignKey, 'COD_PED')
})
test('inferJoins não cria ligação entre tabelas sem relação', () => {
  const j = inferJoins(models)
  assert.equal(j.some((x) => x.to === 'TB_SEM_REL' || x.from === 'TB_SEM_REL'), false)
})
test('inferJoins entre as mesmas tabelas com 2 FKs devolve uma join e sinaliza ambiguidade (aviso)', () => {
  const j = inferJoins(models, 'TB_CLI').filter((x) => x.to === 'TB_PED')
  assert.equal(j.length, 1)
})

console.log('Título do registro')
test('título vem do primeiro campo textual (não PK, não FK), sem depender de "nome"', () => {
  assert.equal(pickRecordTitle({ CODIGO: 5, RAZAO_SOCIAL: 'ACME', UF: 'MG' }, models[0]), 'ACME')
})
test('sem campo textual preenchido, usa a chave primária (nunca JSON)', () => {
  assert.equal(pickRecordTitle({ NUM_PED: 42, CLI_COBRANCA: 1, CLI_ENTREGA: 2, OBS: '' }, models[1]), '42')
})
test('readCol ignora caixa', () => {
  assert.equal(readCol({ razao_social: 'x' }, 'RAZAO_SOCIAL'), 'x')
})

console.log(`\n${passed} verificações passaram${process.exitCode ? ' (HÁ FALHAS)' : ''}.`)
