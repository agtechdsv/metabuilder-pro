import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createTunnelSupabaseClient, parseEmbeds, attachEmbed } from '../TunnelSupabaseProxy'

// Canal falso: guarda o que o proxy envia ao túnel
function fakeChannel() {
  const sent: any[] = []
  return { sent, channel: { on: () => {}, send: (m: any) => { sent.push(m.payload) }, bindings: { broadcast: [] } } }
}

const client = (ch: any) => createTunnelSupabaseClient(ch, {}, 'tok', 'crm')

describe('TunnelSupabaseProxy (cliente de dados do sandbox da IA)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('insert(...).select().single() continua sendo um INSERT (não vira SELECT)', () => {
    const { sent, channel } = fakeChannel()
    void (client(channel).from('categorias') as any).insert([{ nome: 'A', project_id: 'p' }]).select().single().then(() => {})
    expect(sent).toHaveLength(1)
    expect(sent[0].action).toBe('insert')
    expect(sent[0].data).toEqual({ nome: 'A' })
    expect(sent[0].sql).toContain('INSERT INTO "categorias"')
  })

  it('select simples ignora project_id e aplica filtros e ordem', () => {
    const { sent, channel } = fakeChannel()
    void (client(channel).from('produtos') as any).select('id, nome').eq('project_id', 'p').eq('categoria_id', '7').order('nome', { ascending: false }).then(() => {})
    expect(sent[0].action).toBe('select')
    expect(sent[0].sql).toBe(`SELECT id, nome FROM "produtos" WHERE "categoria_id" = '7' ORDER BY "nome" DESC`)
  })

  it('in, ilike, is e limit', () => {
    const { sent, channel } = fakeChannel()
    void (client(channel).from('produtos') as any).select('*').in('id', ['a', "b'c"]).ilike('nome', '%tv%').is('deletado', null).limit(5).then(() => {})
    expect(sent[0].sql).toContain(`"id" IN ('a', 'b''c')`)
    expect(sent[0].sql).toContain(`UPPER("nome") LIKE UPPER('%tv%')`)
    expect(sent[0].sql).toContain('"deletado" IS NULL')
    expect(sent[0].limit).toBe(5)
  })

  it('in com lista vazia não casa nada', () => {
    const { sent, channel } = fakeChannel()
    void (client(channel).from('produtos') as any).select('*').in('id', []).then(() => {})
    expect(sent[0].sql).toContain('1=0')
  })

  it('update e delete usam o id como chave e ignoram project_id', () => {
    const { sent, channel } = fakeChannel()
    void (client(channel).from('produtos') as any).update({ nome: 'N', project_id: 'p' }).eq('id', '9').eq('project_id', 'p').then(() => {})
    void (client(channel).from('produtos') as any).delete().eq('id', '9').eq('project_id', 'p').then(() => {})
    expect(sent[0]).toMatchObject({ action: 'update', idColumn: 'id', idValue: '9', data: { nome: 'N' } })
    expect(sent[1]).toMatchObject({ action: 'delete', idColumn: 'id', idValue: '9' })
  })
})

describe('relações embutidas no select', () => {
  it('lê a relação do texto do select', () => {
    expect(parseEmbeds('id, nome, categorias_produtos(nome)')).toEqual([{ rel: 'categorias_produtos', cols: 'nome' }])
    expect(parseEmbeds('*, clientes!fk_cli(nome, cnpj), vendedores(*)')).toEqual([{ rel: 'clientes', cols: 'nome, cnpj' }, { rel: 'vendedores', cols: '*' }])
    expect(parseEmbeds('id, nome')).toEqual([])
  })

  it('liga pela chave estrangeira cujo prefixo começa o nome da tabela relacionada', () => {
    const rows = [{ id: 1, nome: 'TV', categoria_id: 'c1' }, { id: 2, nome: 'Sem', categoria_id: null }, { id: 3, nome: 'X', categoria_id: 'zz' }]
    const out = attachEmbed(rows, 'categorias_produtos', [{ id: 'c1', nome: 'Eletro' }])
    expect(out[0].categorias_produtos).toEqual({ id: 'c1', nome: 'Eletro' })
    expect(out[1].categorias_produtos).toBeNull()
    expect(out[2].categorias_produtos).toBeNull()
  })

  it('sem chave estrangeira reconhecível a relação fica nula', () => {
    expect(attachEmbed([{ id: 1, nome: 'A' }], 'categorias', [{ id: 1 }])[0].categorias).toBeNull()
  })
})
