-- =====================================================================================================
-- Votos de EXEMPLO ("Isto ajudou?") para o projeto kika-projetos/vendas-pg, para mostrar o painel de feedback.
--
-- RODE NO BANCO DO CLIENTE (o `crm`, pelo DBeaver), NÃO no Supabase da plataforma.
-- A tabela mb_help_feedback é criada no primeiro voto real; este script a cria igual, se ainda não existir.
--
-- Todos os votos de exemplo usam user_ref começando com 'demo-', então:
--   * rodar de novo NÃO duplica (o script apaga os 'demo-' antes de inserir);
--   * para limpar depois:  DELETE FROM mb_help_feedback WHERE user_ref LIKE 'demo-%';
--   * votos reais (user_ref com o id da sessão) nunca são tocados.
--
-- O que o exemplo mostra no Studio (Central de Ajuda > caso de uso > Feedback dos usuários):
--   * Pedidos > Status: 👍 no formulário e 👎 no grid  -> sugestão "Personalizar nesta zona" (no grid);
--   * Clientes > Cnpj Cpf e Nome Empresa: zonas com opiniões diferentes;
--   * comentários em português, inglês e espanhol, de datas diferentes;
--   * votos dados na própria Central de Ajuda (linha 'Central de Ajuda', separada das zonas reais);
--   * demo-ana votou 👎 e depois 👍 em Pedidos > Status (grid): conta só o último voto dela.
-- =====================================================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS mb_help_feedback (
  id          BIGSERIAL   PRIMARY KEY,
  screen_id   TEXT,
  field_id    TEXT,
  zone        TEXT,
  vote        SMALLINT    NOT NULL CHECK (vote IN (-1, 1)),
  comment     TEXT,
  user_ref    TEXT,
  language    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE mb_help_feedback ADD COLUMN IF NOT EXISTS zone TEXT;
CREATE INDEX IF NOT EXISTS idx_mb_help_feedback_target ON mb_help_feedback (screen_id, field_id, created_at DESC);

DELETE FROM mb_help_feedback WHERE user_ref LIKE 'demo-%';

-- (tela, campo, zona, voto, comentário, usuário, idioma, "há quanto tempo")
-- Votos de formulário não levam a tela (como no app); filtro, grid e ajuda da tela levam.
INSERT INTO mb_help_feedback (screen_id, field_id, zone, vote, comment, user_ref, language, created_at)
SELECT screen_id, field_id, zone, vote, comment, user_ref, language, NOW() - ago::interval
FROM (VALUES
  -- ===== Clientes: Nome Empresa (3 zonas, opiniões diferentes) =====
  (NULL, '7e136b90-fc48-4438-9281-49fa70be1050', 'form',   1, NULL, 'demo-ana',    'pt', '6 days 3 hours'),
  (NULL, '7e136b90-fc48-4438-9281-49fa70be1050', 'form',   1, NULL, 'demo-bruno',  'pt', '5 days 1 hour'),
  (NULL, '7e136b90-fc48-4438-9281-49fa70be1050', 'form',   1, NULL, 'demo-carla',  'pt', '4 days 20 hours'),
  (NULL, '7e136b90-fc48-4438-9281-49fa70be1050', 'form',   1, NULL, 'demo-diego',  'en', '2 days 5 hours'),
  ('33ccc6eb-072c-49be-add6-3228d71508ab', '7e136b90-fc48-4438-9281-49fa70be1050', 'filter', -1, 'Não sei se pesquiso pela razão social ou pelo nome fantasia.', 'demo-ana',   'pt', '3 days 2 hours'),
  ('33ccc6eb-072c-49be-add6-3228d71508ab', '7e136b90-fc48-4438-9281-49fa70be1050', 'filter', -1, 'Aqui eu só queria saber se posso digitar parte do nome.',       'demo-bruno', 'pt', '2 days 8 hours'),
  ('33ccc6eb-072c-49be-add6-3228d71508ab', '7e136b90-fc48-4438-9281-49fa70be1050', 'filter', -1, NULL,                                                       'demo-elisa', 'pt', '1 day 6 hours'),
  ('33ccc6eb-072c-49be-add6-3228d71508ab', '7e136b90-fc48-4438-9281-49fa70be1050', 'grid',    1, NULL,                                                       'demo-carla', 'pt', '1 day 2 hours'),
  ('33ccc6eb-072c-49be-add6-3228d71508ab', '7e136b90-fc48-4438-9281-49fa70be1050', 'grid',    1, NULL,                                                       'demo-fabio', 'es', '20 hours'),

  -- ===== Clientes: Cnpj Cpf =====
  (NULL, '23ffc613-bf8f-411b-89f9-60c4645baabe', 'form',   1, NULL, 'demo-ana',    'pt', '5 days 9 hours'),
  (NULL, '23ffc613-bf8f-411b-89f9-60c4645baabe', 'form',   1, NULL, 'demo-bruno',  'pt', '4 days 4 hours'),
  (NULL, '23ffc613-bf8f-411b-89f9-60c4645baabe', 'form',   1, NULL, 'demo-carla',  'pt', '3 days 7 hours'),
  ('33ccc6eb-072c-49be-add6-3228d71508ab', '23ffc613-bf8f-411b-89f9-60c4645baabe', 'grid', -1, 'Na lista a dica fala de cadastro, mas aqui só quero ver o documento.', 'demo-diego', 'pt', '2 days 3 hours'),
  ('33ccc6eb-072c-49be-add6-3228d71508ab', '23ffc613-bf8f-411b-89f9-60c4645baabe', 'grid', -1, 'The hint does not say how the number is displayed in the list.',        'demo-elisa', 'en', '1 day 9 hours'),
  ('33ccc6eb-072c-49be-add6-3228d71508ab', '23ffc613-bf8f-411b-89f9-60c4645baabe', 'grid', -1, NULL,                                                                'demo-fabio', 'pt', '9 hours'),

  -- ===== Clientes: Status Lead, Latitude, Email =====
  ('33ccc6eb-072c-49be-add6-3228d71508ab', '153b291e-d5fe-4ce0-b62a-4afdc7a10776', 'filter', -1, 'Quais são os status possíveis?', 'demo-ana',   'pt', '2 days 1 hour'),
  ('33ccc6eb-072c-49be-add6-3228d71508ab', '153b291e-d5fe-4ce0-b62a-4afdc7a10776', 'filter', -1, NULL,                             'demo-bruno', 'pt', '1 day 4 hours'),
  (NULL, '153b291e-d5fe-4ce0-b62a-4afdc7a10776', 'form',   1, NULL, 'demo-carla',  'pt', '1 day 1 hour'),
  (NULL, 'e0d39055-f3af-4c14-b1d5-67a0f1f7cda2', 'form',  -1, 'Como descubro a latitude do endereço?', 'demo-diego', 'pt', '3 days 5 hours'),
  (NULL, 'e0d39055-f3af-4c14-b1d5-67a0f1f7cda2', 'form',  -1, '¿Dónde obtengo la latitud de la dirección?', 'demo-fabio', 'es', '1 day 10 hours'),
  (NULL, '3b68b6ab-4fae-4168-b462-f377d396705e', 'form',   1, NULL, 'demo-ana',    'pt', '4 days 2 hours'),
  (NULL, '3b68b6ab-4fae-4168-b462-f377d396705e', 'form',   1, NULL, 'demo-bruno',  'pt', '2 days 12 hours'),
  (NULL, '3b68b6ab-4fae-4168-b462-f377d396705e', 'form',   1, NULL, 'demo-elisa',  'en', '10 hours'),

  -- ===== Clientes: ajuda da tela =====
  ('33ccc6eb-072c-49be-add6-3228d71508ab', NULL, 'screen',  1, NULL, 'demo-ana',    'pt', '6 days'),
  ('33ccc6eb-072c-49be-add6-3228d71508ab', NULL, 'screen',  1, NULL, 'demo-bruno',  'pt', '5 days 6 hours'),
  ('33ccc6eb-072c-49be-add6-3228d71508ab', NULL, 'screen',  1, NULL, 'demo-carla',  'pt', '3 days 1 hour'),
  ('33ccc6eb-072c-49be-add6-3228d71508ab', NULL, 'screen',  1, NULL, 'demo-diego',  'pt', '2 days 6 hours'),
  ('33ccc6eb-072c-49be-add6-3228d71508ab', NULL, 'screen',  1, NULL, 'demo-elisa',  'en', '1 day 3 hours'),
  ('33ccc6eb-072c-49be-add6-3228d71508ab', NULL, 'screen', -1, 'Faltou explicar como importar uma lista de clientes.', 'demo-fabio', 'pt', '7 hours'),

  -- ===== Pedidos: Status (bom no formulário, ruim no grid -> sugestão de texto próprio) =====
  (NULL, '3dd3f409-d711-4224-9c55-b9092bed62fd', 'form',   1, NULL, 'demo-ana',    'pt', '5 days 2 hours'),
  (NULL, '3dd3f409-d711-4224-9c55-b9092bed62fd', 'form',   1, NULL, 'demo-bruno',  'pt', '4 days 8 hours'),
  (NULL, '3dd3f409-d711-4224-9c55-b9092bed62fd', 'form',   1, NULL, 'demo-carla',  'pt', '3 days 4 hours'),
  (NULL, '3dd3f409-d711-4224-9c55-b9092bed62fd', 'form',   1, NULL, 'demo-diego',  'pt', '1 day 8 hours'),
  ('d717d84a-4eb5-4973-a6ee-3144d3f76407', '3dd3f409-d711-4224-9c55-b9092bed62fd', 'grid', -1, 'Nessa coluna eu queria saber o que cada cor significa.', 'demo-ana',   'pt', '2 days 4 hours'),
  ('d717d84a-4eb5-4973-a6ee-3144d3f76407', '3dd3f409-d711-4224-9c55-b9092bed62fd', 'grid',  1, NULL,                                                  'demo-ana',   'pt', '4 hours'),
  ('d717d84a-4eb5-4973-a6ee-3144d3f76407', '3dd3f409-d711-4224-9c55-b9092bed62fd', 'grid', -1, 'A dica fala do processo, mas na lista eu só quero filtrar.', 'demo-bruno', 'pt', '1 day 11 hours'),
  ('d717d84a-4eb5-4973-a6ee-3144d3f76407', '3dd3f409-d711-4224-9c55-b9092bed62fd', 'grid', -1, NULL,                                                     'demo-carla', 'pt', '1 day 1 hour'),
  ('d717d84a-4eb5-4973-a6ee-3144d3f76407', '3dd3f409-d711-4224-9c55-b9092bed62fd', 'grid', -1, 'It would help to see the list of possible statuses here.',   'demo-elisa', 'en', '6 hours'),

  -- ===== Pedidos: Cliente, Quantidade, ajuda da tela =====
  ('d717d84a-4eb5-4973-a6ee-3144d3f76407', '38389ad8-b67a-441f-8540-db72cbef1a72', 'filter', 1, NULL, 'demo-ana',   'pt', '3 days 6 hours'),
  ('d717d84a-4eb5-4973-a6ee-3144d3f76407', '38389ad8-b67a-441f-8540-db72cbef1a72', 'filter', 1, NULL, 'demo-bruno', 'pt', '2 days 2 hours'),
  ('d717d84a-4eb5-4973-a6ee-3144d3f76407', '38389ad8-b67a-441f-8540-db72cbef1a72', 'filter', 1, NULL, 'demo-fabio', 'es', '1 day 5 hours'),
  (NULL, '38389ad8-b67a-441f-8540-db72cbef1a72', 'form',   1, NULL, 'demo-carla',  'pt', '2 days 9 hours'),
  (NULL, '38389ad8-b67a-441f-8540-db72cbef1a72', 'form',   1, NULL, 'demo-diego',  'pt', '8 hours'),
  (NULL, 'd819ba8e-5db3-4a33-874a-d47c5f37476a', 'form',  -1, 'Não diz se a quantidade é em unidades ou em caixas.', 'demo-ana',   'pt', '2 days 10 hours'),
  (NULL, 'd819ba8e-5db3-4a33-874a-d47c5f37476a', 'form',  -1, 'No dice si la cantidad es por unidad o por caja.',    'demo-fabio', 'es', '1 day 7 hours'),
  ('d717d84a-4eb5-4973-a6ee-3144d3f76407', NULL, 'screen',  1, NULL, 'demo-ana',    'pt', '4 days'),
  ('d717d84a-4eb5-4973-a6ee-3144d3f76407', NULL, 'screen',  1, NULL, 'demo-bruno',  'pt', '3 days 3 hours'),
  ('d717d84a-4eb5-4973-a6ee-3144d3f76407', NULL, 'screen',  1, NULL, 'demo-carla',  'pt', '2 days 1 hour'),
  ('d717d84a-4eb5-4973-a6ee-3144d3f76407', NULL, 'screen',  1, NULL, 'demo-diego',  'en', '5 hours'),

  -- ===== Produtos, Kanban, Entregas, Projetos =====
  (NULL, '080f6449-abdc-424d-a659-7874b74f0afe', 'form',  -1, 'Precisa de um exemplo de link de imagem.', 'demo-ana',   'pt', '3 days 8 hours'),
  (NULL, '080f6449-abdc-424d-a659-7874b74f0afe', 'form',  -1, 'Posso subir o arquivo em vez de colar o link?', 'demo-bruno', 'pt', '2 days 7 hours'),
  (NULL, '080f6449-abdc-424d-a659-7874b74f0afe', 'form',  -1, NULL, 'demo-carla', 'pt', '1 day 2 hours'),
  ('80f249bc-ea47-4e53-a7e2-9b83e1ea8ab7', NULL, 'screen', 1, NULL, 'demo-ana',    'pt', '3 days 9 hours'),
  ('80f249bc-ea47-4e53-a7e2-9b83e1ea8ab7', NULL, 'screen', 1, NULL, 'demo-elisa',  'pt', '1 day 12 hours'),

  ('8ab269a0-354a-42aa-8409-d654af263ee6', NULL, 'screen', 1, NULL, 'demo-ana',    'pt', '4 days 5 hours'),
  ('8ab269a0-354a-42aa-8409-d654af263ee6', NULL, 'screen', 1, NULL, 'demo-bruno',  'pt', '2 days 9 hours'),
  ('8ab269a0-354a-42aa-8409-d654af263ee6', NULL, 'screen', 1, NULL, 'demo-diego',  'pt', '1 day 3 hours'),
  ('8ab269a0-354a-42aa-8409-d654af263ee6', NULL, 'screen', -1, 'Não achei como criar uma coluna nova no quadro.', 'demo-carla', 'pt', '11 hours'),
  (NULL, '391e936d-45c4-4feb-826e-fec852a01cd1', 'form',   1, NULL, 'demo-ana',    'pt', '2 days 2 hours'),
  (NULL, '391e936d-45c4-4feb-826e-fec852a01cd1', 'form',   1, NULL, 'demo-bruno',  'pt', '1 day 6 hours'),

  (NULL, '22ad7fe3-f180-438c-aba5-83b61eef9516', 'form',  -1, 'Não entendi de onde vem esse valor.', 'demo-diego', 'pt', '2 days 5 hours'),
  (NULL, '22ad7fe3-f180-438c-aba5-83b61eef9516', 'form',  -1, NULL, 'demo-elisa', 'en', '1 day 8 hours'),
  ('3df191be-07a8-462c-800d-0423cad7bc08', NULL, 'screen', 1, NULL, 'demo-fabio',  'es', '2 days 11 hours'),
  ('3df191be-07a8-462c-800d-0423cad7bc08', NULL, 'screen', 1, NULL, 'demo-ana',    'pt', '1 day 1 hour'),

  -- ===== Votos dados na Central de Ajuda (zona 'central'; levam a tela) =====
  ('d717d84a-4eb5-4973-a6ee-3144d3f76407', '3dd3f409-d711-4224-9c55-b9092bed62fd', 'central',  1, NULL, 'demo-bruno', 'pt', '2 days 2 hours'),
  ('d717d84a-4eb5-4973-a6ee-3144d3f76407', '3dd3f409-d711-4224-9c55-b9092bed62fd', 'central',  1, NULL, 'demo-carla', 'pt', '1 day 5 hours'),
  ('d717d84a-4eb5-4973-a6ee-3144d3f76407', '3dd3f409-d711-4224-9c55-b9092bed62fd', 'central', -1, 'Gostaria de ver aqui a lista completa de status.', 'demo-diego', 'pt', '9 hours'),
  ('33ccc6eb-072c-49be-add6-3228d71508ab', '23ffc613-bf8f-411b-89f9-60c4645baabe', 'central',  1, NULL, 'demo-elisa', 'en', '1 day 2 hours'),
  ('33ccc6eb-072c-49be-add6-3228d71508ab', NULL, 'central', 1, NULL, 'demo-fabio', 'es', '20 hours'),
  ('d717d84a-4eb5-4973-a6ee-3144d3f76407', NULL, 'central', 1, NULL, 'demo-ana', 'pt', '3 hours'),

  (NULL, 'cc6c72f2-7649-4d99-a27a-1a218fbfbd09', 'form',   1, NULL, 'demo-ana',    'pt', '3 days 2 hours'),
  (NULL, 'cc6c72f2-7649-4d99-a27a-1a218fbfbd09', 'form',   1, NULL, 'demo-bruno',  'pt', '2 days 6 hours'),
  (NULL, 'cc6c72f2-7649-4d99-a27a-1a218fbfbd09', 'form',   1, NULL, 'demo-carla',  'pt', '1 day 4 hours'),
  ('a819bb39-2a88-4a37-acda-b6432b2ec345', NULL, 'screen', 1, NULL, 'demo-diego',  'pt', '2 days 3 hours'),
  ('a819bb39-2a88-4a37-acda-b6432b2ec345', NULL, 'screen', 1, NULL, 'demo-elisa',  'en', '14 hours')
) AS t(screen_id, field_id, zone, vote, comment, user_ref, language, ago);

-- Conferência: votos de exemplo inseridos, por zona
SELECT zone, SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END) AS positivos, SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END) AS negativos, COUNT(*) AS total
  FROM mb_help_feedback WHERE user_ref LIKE 'demo-%' GROUP BY zone ORDER BY zone;

COMMIT;
