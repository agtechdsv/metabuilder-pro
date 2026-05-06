-- MetaBuilderPRO: Arquitetura de Views (Casos de Uso)

-- 1. Tabela de Telas (Views / Casos de Uso)
-- Representa uma página inteira que o cliente cria no Studio.
CREATE TABLE public.ui_views (
  id uuid not null default extensions.uuid_generate_v4 (),
  project_id uuid not null,
  model_id uuid not null, -- A tabela principal que guia esta tela
  name text not null, -- Ex: 'Gerenciamento de Clientes'
  slug text not null, -- Ex: 'clientes' (Vai virar a URL /p/project_id/clientes)
  view_type text not null, -- Ex: 'crud_grid', 'kanban', 'master_detail', 'form'
  layout_config jsonb not null default '{}'::jsonb, -- Configurações visuais (paginação, filtros ativos)
  icon text null, -- Nome do ícone (ex: 'users', 'box')
  is_public boolean default false,
  created_at timestamp with time zone null default now(),
  constraint ui_views_pkey primary key (id),
  constraint ui_views_project_id_fkey foreign key (project_id) references projects(id) on delete cascade,
  constraint ui_views_model_id_fkey foreign key (model_id) references models(id) on delete cascade
);

-- 2. Tabela de Componentes da Tela
-- Representa como cada campo (coluna) se comporta dentro daquela View.
CREATE TABLE public.ui_components (
  id uuid not null default extensions.uuid_generate_v4 (),
  view_id uuid not null,
  field_id uuid not null, -- O campo real no banco de dados mapeado pelo Agente
  component_type text not null, -- Ex: 'text_input', 'date_picker', 'toggle', 'lookup_select'
  label text not null, -- O nome que o cliente escolheu mostrar na tela
  order_index integer not null default 0, -- Ordem na tabela ou no formulário
  is_visible boolean not null default true, -- Se a coluna/campo está visível
  is_readonly boolean not null default false, -- Se é apenas leitura
  is_required boolean not null default false, -- Validação de obrigatoriedade
  width_cols integer not null default 12, -- Para o formulário (ex: 6 = ocupa metade da tela, 12 = linha toda)
  config jsonb not null default '{}'::jsonb, -- Regras extras (ex: máscara de CPF, regex)
  created_at timestamp with time zone null default now(),
  constraint ui_components_pkey primary key (id),
  constraint ui_components_view_id_fkey foreign key (view_id) references ui_views(id) on delete cascade,
  constraint ui_components_field_id_fkey foreign key (field_id) references fields(id) on delete cascade
);

-- Segurança RLS (Row Level Security) - Básica
ALTER TABLE public.ui_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ui_components ENABLE ROW LEVEL SECURITY;

-- Exemplo de Políticas (Permitir acesso total temporário para MVP)
CREATE POLICY "Enable ALL for ui_views MVP" ON public.ui_views FOR ALL USING (true);
CREATE POLICY "Enable ALL for ui_components MVP" ON public.ui_components FOR ALL USING (true);
