-- Dados fixos dos testes de ponta a ponta (sempre os mesmos, para os testes saberem o que esperar).
-- Variedade de tipos (texto, data, data/hora, número, booleano, texto longo, opções fixas) e de relações
-- (mestre > detalhe > subdetalhe, dois detalhes no mesmo mestre e auto-relação).
DROP TABLE IF EXISTS itens, pedidos, contatos, produtos, clientes CASCADE;

CREATE TABLE clientes (
  id SERIAL PRIMARY KEY,
  nome_empresa VARCHAR(120) NOT NULL,
  cnpj VARCHAR(30),
  data_cadastro DATE,
  ativo BOOLEAN DEFAULT FALSE,
  limite_credito NUMERIC(12,2),
  observacoes TEXT,
  status VARCHAR(20),
  cliente_pai_id INTEGER REFERENCES clientes(id)
);
CREATE TABLE produtos (id SERIAL PRIMARY KEY, nome VARCHAR(120) NOT NULL);
CREATE TABLE contatos (id SERIAL PRIMARY KEY, cliente_id INTEGER REFERENCES clientes(id), nome VARCHAR(120), email VARCHAR(120));
CREATE TABLE pedidos  (id SERIAL PRIMARY KEY, cliente_id INTEGER REFERENCES clientes(id), total NUMERIC(12,2), data_pedido TIMESTAMP, status VARCHAR(20));
CREATE TABLE itens    (id SERIAL PRIMARY KEY, pedido_id INTEGER REFERENCES pedidos(id), produto_id INTEGER REFERENCES produtos(id), qtd INTEGER);

INSERT INTO produtos (nome) VALUES ('Parafuso M8'), ('Porca M8'), ('Arruela'), ('Chave Philips'), ('Martelo');

-- 30 clientes: "Cliente 01" ... "Cliente 30" (passa de uma página de 25 linhas)
--   data_cadastro = 2025-01-01 + n dias; ativo nos pares; limite = n * 1000,50; status em rodízio; Cliente 02 é filial do Cliente 01
INSERT INTO clientes (nome_empresa, cnpj, data_cadastro, ativo, limite_credito, observacoes, status)
SELECT 'Cliente ' || lpad(n::text, 2, '0'),
       lpad(n::text, 2, '0') || '.111.111/0001-' || lpad(n::text, 2, '0'),
       DATE '2025-01-01' + n,
       (n % 2 = 0),
       n * 1000.50,
       'Observação do cliente ' || lpad(n::text, 2, '0'),
       (ARRAY['Ativo', 'Inativo', 'Bloqueado'])[1 + (n % 3)]
FROM generate_series(1, 30) n;
UPDATE clientes SET cliente_pai_id = 1 WHERE id = 2;

INSERT INTO contatos (cliente_id, nome, email) VALUES (1, 'Ana Souza', 'ana@cliente01.com'), (1, 'Bruno Lima', 'bruno@cliente01.com');

INSERT INTO pedidos (cliente_id, total, data_pedido, status) VALUES
  (1, 150.00, '2025-03-10 14:30:00', 'Aberto'),
  (1, 80.50,  '2025-03-11 09:00:00', 'Fechado'),
  (2, 300.00, '2025-03-12 16:45:00', 'Aberto');
INSERT INTO itens (pedido_id, produto_id, qtd) VALUES (1, 1, 10), (1, 2, 10), (2, 3, 5);
