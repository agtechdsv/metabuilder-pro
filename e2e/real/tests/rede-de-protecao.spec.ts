import { test, expect } from '@playwright/test'
import { PREFIXO, contagemOriginal, limparTeste, realQuery } from '../guard'

// A rede de proteção em si: a limpeza apaga só o que tem o prefixo E2E- e não mexe em mais nada.
test('limpeza apaga só as linhas do teste (prefixo E2E-) e a contagem das originais não muda', async () => {
  const antes = await contagemOriginal()
  const nome = PREFIXO + 'rede-de-protecao'
  await limparTeste(PREFIXO + 'rede-de-protecao')
  const [cli] = await realQuery(`insert into clientes (id, nome_empresa, status_lead, atualizado_em) values (gen_random_uuid(), $1, 'novo', now()) returning id`, [nome])
  const [ped] = await realQuery(`insert into pedidos (id, cliente_id, status, atualizado_em) values (gen_random_uuid(), $1, 'novo', now()) returning id`, [cli.id])
  const [prod] = await realQuery(`select id, preco_unitario from produtos where nome not like $1 limit 1`, [PREFIXO + '%'])
  await realQuery(`insert into itens_pedido (id, pedido_id, produto_id, quantidade, preco_unitario, atualizado_em) values (gen_random_uuid(), $1, $2, 1, $3, now())`, [ped.id, prod.id, prod.preco_unitario])
  // as linhas do teste não entram na contagem das originais
  expect(await contagemOriginal()).toEqual(antes)
  await limparTeste(PREFIXO + 'rede-de-protecao')
  expect(await realQuery('select 1 from clientes where id = $1', [cli.id])).toHaveLength(0)
  expect(await realQuery('select 1 from pedidos where id = $1', [ped.id])).toHaveLength(0)
  expect(await contagemOriginal()).toEqual(antes)
})
