-- ==============================================================================
-- SCHEMA ERP EM PORTUGUÊS (PT-BR)
-- Este arquivo contém apenas a estrutura (DDL), sem os dados.
-- ==============================================================================


-- Limpeza: Deleta as tabelas em inglês (se existirem) e as tabelas em PT-BR para garantir que o schema nasça limpo.
-- DROP TABLE IF EXISTS public.user_roles, public.roles, public.users, public.tasks, public.projects, public.deliveries, public.order_items, public.products, public.product_categories, public.orders, public.employees, public.departments, public.customers CASCADE;
DROP TABLE IF EXISTS public.perfis_usuarios, public.perfis, public.usuarios, public.tarefas, public.projetos, public.entregas, public.itens_pedido, public.produtos, public.categorias_produtos, public.pedidos, public.funcionarios, public.departamentos, public.clientes CASCADE;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

-- 1. clientes (customers)
CREATE TABLE public.clientes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    nome_empresa text NOT NULL,
    cnpj_cpf text,
    email_contato text,
    status_lead text DEFAULT 'Novo'::text NOT NULL,
    latitude numeric(10,6),
    longitude numeric(10,6),
    criado_em timestamp with time zone DEFAULT now()
);

-- 2. departamentos (departments)
CREATE TABLE public.departamentos (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    nome text NOT NULL,
    criado_em timestamp with time zone DEFAULT now()
);

-- 3. funcionarios (employees)
CREATE TABLE public.funcionarios (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    departamento_id uuid REFERENCES public.departamentos(id),
    nome text NOT NULL,
    email text NOT NULL,
    cargo text NOT NULL,
    data_contratacao date DEFAULT CURRENT_DATE NOT NULL,
    criado_em timestamp with time zone DEFAULT now()
);

-- 4. pedidos (orders)
CREATE TABLE public.pedidos (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    cliente_id uuid REFERENCES public.clientes(id),
    funcionario_id uuid REFERENCES public.funcionarios(id),
    valor_total numeric(12,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'Pendente'::text NOT NULL,
    data_pedido timestamp with time zone DEFAULT now(),
    criado_em timestamp with time zone DEFAULT now()
);

-- 5. categorias_produtos (product_categories)
CREATE TABLE public.categorias_produtos (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    nome text NOT NULL,
    criado_em timestamp with time zone DEFAULT now()
);

-- 6. produtos (products)
CREATE TABLE public.produtos (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    categoria_id uuid REFERENCES public.categorias_produtos(id),
    nome text NOT NULL,
    descricao text,
    preco_base numeric(10,2) NOT NULL,
    estoque_atual integer DEFAULT 0 NOT NULL,
    url_imagem text,
    criado_em timestamp with time zone DEFAULT now()
);

-- 7. itens_pedido (order_items)
CREATE TABLE public.itens_pedido (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    pedido_id uuid REFERENCES public.pedidos(id),
    produto_id uuid REFERENCES public.produtos(id),
    quantidade integer DEFAULT 1 NOT NULL,
    preco_unitario numeric(10,2) NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    criado_em timestamp with time zone DEFAULT now()
);

-- 8. entregas (deliveries)
CREATE TABLE public.entregas (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    pedido_id uuid REFERENCES public.pedidos(id),
    motorista_id uuid REFERENCES public.funcionarios(id),
    status text DEFAULT 'Pendente'::text NOT NULL,
    lat_atual numeric(10,6),
    lng_atual numeric(10,6),
    data_estimada timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now()
);

-- 9. projetos (projects)
CREATE TABLE public.projetos (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    cliente_id uuid REFERENCES public.clientes(id),
    gerente_id uuid REFERENCES public.funcionarios(id),
    nome text NOT NULL,
    data_inicio date,
    data_fim date,
    status text DEFAULT 'Planejamento'::text NOT NULL,
    percentual_conclusao integer DEFAULT 0,
    criado_em timestamp with time zone DEFAULT now()
);

-- 10. tarefas (tasks)
CREATE TABLE public.tarefas (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    projeto_id uuid REFERENCES public.projetos(id),
    responsavel_id uuid REFERENCES public.funcionarios(id),
    titulo text NOT NULL,
    status text DEFAULT 'A Fazer'::text NOT NULL,
    data_vencimento date,
    prioridade text DEFAULT 'Média'::text NOT NULL,
    criado_em timestamp with time zone DEFAULT now()
);

-- 11. usuarios (users) - Sistema de Autenticação/Acesso Externo
CREATE TABLE public.usuarios (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    nome_completo text NOT NULL,
    email text NOT NULL,
    hash_senha text NOT NULL,
    ativo boolean DEFAULT true,
    criado_em timestamp with time zone DEFAULT now()
);

-- 12. perfis (roles)
CREATE TABLE public.perfis (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    nome text NOT NULL,
    descricao text,
    criado_em timestamp with time zone DEFAULT now()
);

-- 13. perfis_usuarios (user_roles)
CREATE TABLE public.perfis_usuarios (
    usuario_id uuid REFERENCES public.usuarios(id) NOT NULL,
    perfil_id uuid REFERENCES public.perfis(id) NOT NULL,
    atribuido_em timestamp with time zone DEFAULT now(),
    PRIMARY KEY (usuario_id, perfil_id)
);
