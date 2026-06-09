const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/erp_local' });
client.connect().then(() => {
  client.query('SELECT "produtos".* FROM "produtos" LEFT JOIN "itens_pedido" ON "produtos"."id" = "itens_pedido"."produto_id" LEFT JOIN "pedidos" ON "itens_pedido"."pedido_id" = "pedidos"."id" WHERE "pedidos"."id" = $1 GROUP BY "produtos"."id" ORDER BY "produtos"."id" DESC LIMIT 15', ['1a2b3c4d-1234-1234-1234-1234567890ab'])
    .then(res => console.log(res.rows))
    .catch(console.error)
    .finally(() => client.end());
});
