# Testes de ponta a ponta (Playwright)

Testam o **app exportado** de verdade: gera o app com o gerador do MetaBuilder, sobe o servidor, abre o Chrome e repete o que você faria à mão
(listar, filtrar, paginar, cadastrar, exportar, baixar, excluir...), contra um banco de testes com dados fixos.

## Rodar

```bash
cd e2e
npm install            # só na primeira vez
npm run gen            # gera o app (Node + Postgres) em .apps/pg-node, instala e compila
npm test               # recria o banco mb_e2e e roda todos os testes (Chrome instalado na máquina)
npm run test:ui        # modo interativo: ver cada passo, repetir, depurar
npm run report         # abre o relatório HTML da última rodada (com trace dos que falharam)
```

Depois de mudar o gerador, rode `npm run gen` de novo antes de `npm test`.

## Gravar um teste novo (sem escrever código)

```bash
cd e2e/.apps/pg-node && npx next start -p 3101      # em um terminal
cd e2e && npm run record                             # em outro: abre o Chrome gravando seus cliques e imprime o código
```

Cole o código gerado em `tests/<assunto>.spec.ts`.

## Como é montado

- `db/postgres.sql` — dados fixos (30 clientes, pedidos, itens, produtos). `npm test` recria o banco `mb_e2e` a cada rodada.
- `../src/lib/generator/__tests__/e2eGenerate.test.ts` — o "projeto do Studio" usado para gerar o app (telas, botões, autocomplete...). Só roda via `npm run gen`.
- `playwright.config.ts` — uma entrada em `projects` + `webServer` por combinação (banco + backend). Para somar Oracle ou Java, adicione a combinação ali e em `scripts/generate.mjs`; os mesmos testes valem para todas.
- `tests/*.spec.ts` — os testes.

Variáveis: `E2E_PG_ADMIN` (conexão usada para criar o banco; padrão `postgresql://crm:crm@localhost:5432/postgres`), `E2E_PG_DB` (nome do banco; padrão `mb_e2e`).

## Modo banco real (app exportado de verdade + banco crm do dia a dia)

Roda no app que a **IDE ejetou** (Vendas PG) apontando para o banco real, logando com um usuário robô (`e2e_robo@metabuilder.local`, grupo Administrador).

```bash
cd e2e
npm run real:robot      # 1x: cria o usuário robô no crm e grava a senha em e2e/.env.real (fora do git)
# IDE > Ejetar para uma pasta > C:\AgTech\Apps\e2e-vendas-pg  (Vendas PG, Node + Postgres crm, login via banco, gestão de acesso)
npm run real:prepare    # instala e compila o app ejetado (de novo a cada nova ejeção)
npm run real:test       # roda os testes (npm run real:ui para ver ao vivo)
```

Regras de segurança (`real/guard.ts`):
- só roda com `E2E_REAL=1` e se o banco do app e o da verificação forem **localhost** e estiverem em `E2E_REAL_ALLOWED_DBS` (padrão `crm`);
- tudo o que o teste cria leva o prefixo `E2E-` no nome; a limpeza só apaga linhas com esse prefixo (itens → pedidos → clientes);
- no fim, a contagem de linhas **sem** o prefixo (clientes, pedidos, itens, produtos, usuários) precisa ser igual à do início, senão a rodada falha.

Pasta do app ejetado: `E2E_REAL_APP_DIR` (padrão `C:\AgTech\Apps\e2e-vendas-pg`); porta `E2E_REAL_PORT` (padrão 3102).
