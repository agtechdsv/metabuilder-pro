# Santo Graal — Sistema Central de Relacionamentos

## Objetivo

Criar uma fonte única de verdade para todos os relacionamentos entre tabelas do projeto.
Hoje cada caso de uso redefine os mesmos JOINs manualmente. Isso causa bugs, retrabalho e inconsistência.
Com o Santo Graal, o runtime resolve todos os JOINs automaticamente usando BFS (grafo de relações),
eliminando a necessidade do dev definir relacionamentos em cada caso de uso.

---

## O que muda na experiência do dev

| Antes | Depois |
|---|---|
| Abre o Wizard → define JOINs manualmente | Abre o Wizard → seleciona campos → sistema resolve JOINs sozinho |
| Define os mesmos JOINs em cada caso de uso | Define uma vez no Santo Graal |
| Joins incorretos causam erros de SQL | Path-finding com validação e alertas claros |
| Dev precisa conhecer a estrutura interna do banco | Dev trabalha só com nomes amigáveis dos campos |

---

## Arquitetura do Santo Graal

### Fonte de dados
A tabela `relations` no Supabase já existe e é alimentada pela introspecção do CLI.
Cada registro tem:
- `from_model_id` + `from_field_id` → chave estrangeira (ex: `itens_pedido.produto_id`)
- `to_model_id` + `to_field_id` → referência (ex: `produtos.id`)
- `relation_type` (ex: `many_to_one`)
- `name` (ex: `fk_itens_pedido_produtos`)
- `source` → **novo campo a adicionar**: `'cli'` | `'manual'` (distingue quem criou)

### Algoritmo de Path-Finding (BFS)
```
findJoinPath(relations, fromTable, toTable) → JoinStep[] | null
```

Exemplo: `departamento` → `categorias_produtos`
```
BFS encontra:
departamento → funcionario → pedido → itens_pedido → produto → categorias_produtos

Gera automaticamente:
LEFT JOIN funcionario      ON departamento.id    = funcionario.departamento_id
LEFT JOIN pedido           ON funcionario.id     = pedido.funcionario_id
LEFT JOIN itens_pedido     ON pedido.id          = itens_pedido.pedido_id
LEFT JOIN produto          ON itens_pedido.produto_id = produto.id
LEFT JOIN categorias_produtos ON produto.categoria_id = categorias_produtos.id
```

---

## Fases de Implementação

### Fase 1 — Sub-aba "Relacionamentos" no Studio

#### [MODIFY] [StudioDashboardClient.tsx](file:///c:/AgTech/Apps/metabuilder-pro/src/app/admin/%5Bworkspace_slug%5D/%5Bproject_slug%5D/studio/StudioDashboardClient.tsx)
- Dividir a aba `metadata` (atualmente "Tabela / Campos") em duas sub-abas:
  - **"Estrutura"** → componente `TableFieldsManager` atual (sem mudanças)
  - **"Relacionamentos"** → novo componente `RelationsManager`
- Adicionar botão de sub-aba no header quando `viewMode === 'metadata'`
- Passar `relations` como prop (buscar do Supabase junto com `models`)

#### [NEW] `src/components/studio/RelationsManager.tsx`
UI completa da sub-aba "Relacionamentos":

**Seção 1 — Relações do Banco (read-only)**
- Lista todas as relações com `source = 'cli'`
- Badge "CLI / Banco de Dados" em verde
- Colunas: Tabela Origem → Campo FK → Tabela Destino → Campo PK → Tipo
- Botão "ícone de cadeado" indica que não pode ser editado/excluído

**Seção 2 — Relações Manuais (editável)**
- Lista as relações com `source = 'manual'`
- Badge "Manual" em azul
- Botões de editar e excluir habilitados
- Botão "+ Adicionar Relação" abre modal/inline-form

**Modal de Adição de Relação Manual**
- Select: Tabela Origem → Select: Campo FK → `→` → Select: Tabela Destino → Select: Campo PK
- Tipo de relação: `many_to_one` | `one_to_many` | `many_to_many`
- Validação: impede duplicata de relação já existente
- Salva com `source: 'manual'` no Supabase

---

### Fase 2 — Migração da tabela `relations` no Supabase

#### [MODIFY] `src/app/api/metadata/sync/route.ts` e `apply-sync/route.ts`
- Adicionar campo `source: 'cli'` ao inserir relações vindas da introspecção
- Se o campo `source` não existir na tabela ainda, criar via migration

> **IMPORTANTE**: Relações com `source = 'cli'` nunca são deletadas por `sync` — apenas inseridas se não existirem.
> Relações com `source = 'manual'` nunca são tocadas pelo sync.

#### Migration SQL (executar manualmente via Supabase Dashboard):
```sql
ALTER TABLE relations ADD COLUMN IF NOT EXISTS source text DEFAULT 'cli';
UPDATE relations SET source = 'cli' WHERE source IS NULL;
```

---

### Fase 3 — Biblioteca de Path-Finding (BFS)

#### [NEW] `src/lib/relationPathFinder.ts`

```typescript
export interface Relation {
  from_model_id: string
  from_field_id: string
  to_model_id: string
  to_field_id: string
  from_table: string   // db_table_name já resolvido
  to_table: string
  from_field: string   // db_column_name já resolvido
  to_field: string
}

export interface JoinStep {
  fromTable: string
  fromField: string
  toTable: string
  toField: string
}

export function findJoinPath(
  relations: Relation[],
  fromTable: string,
  toTable: string
): JoinStep[] | null

export function resolveAllJoins(
  relations: Relation[],
  tables: string[]   // todas as tabelas que aparecem nos campos selecionados
): JoinStep[]       // JOINs necessários para cobrir todas as tabelas

export function buildJoinSql(steps: JoinStep[]): string
```

Detalhes do algoritmo:
- BFS com fila e conjunto de visitados (evita ciclos)
- Suporta relacionamentos bidirecionais (se A→B existe, pode ir de B para A também)
- Retorna `null` se sem caminho → UI exibe alerta claro
- `resolveAllJoins` resolve múltiplas tabelas de uma vez (árvore de spanning)

---

### Fase 4 — Consumo no Runtime

#### [MODIFY] `src/components/runtime/ViewContainer.tsx`
- Receber `projectRelations: Relation[]` como prop
- Substituir o bloco `buildJoinsSql` + `requiredTables` pela chamada a `resolveAllJoins`
- `resolveAllJoins` usa o Santo Graal em vez de heurísticas de nome de coluna
- Manter compatibilidade retroativa: se `projectRelations` estiver vazio, usa lógica antiga

#### [MODIFY] `src/components/runtime/AnalyticsDashboard.tsx`
- Receber `projectRelations: Relation[]` como prop
- Substituir o `processJoins` / `combinedJoins` por `resolveAllJoins(projectRelations, tablesUsed)`
- `tablesUsed` = tabela principal + tabelas referenciadas em `group_by` e `field`
- O widget não precisa mais de uma seção de "RELACIONAMENTOS (JOINS)" para funcionar

#### [MODIFY] `src/components/runtime/RecordForm.tsx`
- Receber `projectRelations: Relation[]` como prop
- `fetchSubDetailsForRecord`: usar `findJoinPath` para gerar os joins automaticamente
- Eliminação do auto-injector manual de joins (o bloco `linkField` / `fetchJoins.push`)

---

### Fase 5 — Consumo no Studio (Wizard)

#### [MODIFY] `src/components/studio/UseCaseBuilderWizard.tsx`
- Receber `projectRelations: Relation[]` como prop
- Ao selecionar campos com ponto (ex: `produtos.nome`), verificar se o caminho existe no Santo Graal
- Se existe → badge verde "Relação automática"
- Se não existe → alerta laranja "Adicione esta relação no Santo Graal"
- `JoinsEditor` passa a ser **seção de override avançado** (colapsada por padrão, para usuários experientes)

#### [MODIFY] `src/components/shared/BIWidgetEditor.tsx`
- A seção "RELACIONAMENTOS (JOINS)" do widget de BI vira opcional / avançado
- Por padrão, o sistema usa o Santo Graal para resolver os JOINs do widget automaticamente
- Se o dev quiser um comportamento diferente, expande a seção e sobrescreve

---

### Fase 6 — Propagação do Santo Graal via props

#### [MODIFY] `src/app/admin/[workspace_slug]/[project_slug]/studio/page.tsx`
- Buscar `relations` do Supabase junto com `models`
- Passar para `StudioDashboardClient` → `UseCaseBuilderWizard`

#### [MODIFY] `src/app/[workspace_slug]/[project_slug]/[view_slug]/page.tsx`
- Buscar `relations` do Supabase (query leve, filtrada por `project_id`)
- Passar para `ViewPageContent` → `ViewContainer` / `RecordForm` / `AnalyticsDashboard`

---

## Verificação de Plano

### Questões Abertas para Revisão

> [!IMPORTANT]
> **Ambiguidade de caminhos**: Quando existirem dois caminhos possíveis entre duas tabelas (ex: `departamento → cliente → pedido` E `departamento → funcionario → pedido`), o algoritmo BFS escolhe o mais curto. Isso é o comportamento desejado? Ou prefere que o Santo Graal permita o dev marcar um caminho como "preferido"?

> [!NOTE]
> **Migração de dados existentes**: Os casos de uso já criados têm joins salvos em `layout_config.joins`. A proposta é manter isso funcionando como fallback. O runtime vai preferir o Santo Graal mas se não encontrar caminho lá, usa o que está salvo no caso de uso. Isso garante zero breaking change.

> [!NOTE]
> **Mapa Mental, Kanban, Scheduler**: O consumo do Santo Graal nas Fases 4 e 5 cobre `ViewContainer` e `RecordForm`. Os widgets especializados (Mapa Mental, Kanban, Scheduler) têm seus próprios resolvedores em `CustomUseCaseRenderer.tsx` — esses precisariam de uma Fase 7 específica. Incluo agora ou fica como evolução?

---

## Plano de Verificação

### Testes de Path-Finding
1. Caminho direto: `pedidos → itens_pedido` (1 hop)
2. Caminho indireto: `pedidos → itens_pedido → produtos` (2 hops)
3. Caminho longo: `departamento → funcionario → pedido → itens_pedido → produto → categorias_produtos` (5 hops)
4. Sem caminho: tabelas sem relação → deve retornar `null` e UI exibe alerta
5. Ciclo no grafo: não deve travar em loop infinito

### Testes de UI
1. Sub-aba "Relacionamentos" exibe relações do CLI corretamente
2. Relações do CLI não podem ser editadas/excluídas
3. Relação manual pode ser criada, editada e excluída
4. Badge distingue `cli` de `manual` visualmente

### Testes de Runtime
1. Dashboard BI com `group_by = "produtos.nome"` resolve JOIN automaticamente sem configurar nada no widget
2. Master-Detail com título automático `produtos.nome` exibe o nome correto sem auto-injector manual
3. Caso de uso antigo (com joins salvos) continua funcionando (fallback)
