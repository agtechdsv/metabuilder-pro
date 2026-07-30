-- Oracle Database Migration Script
-- Convertido do PostgreSQL

-- Sequências
CREATE SEQUENCE mb_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NOCACHE;

-- Tabelas
CREATE TABLE mb_logs (
    id NUMBER DEFAULT mb_logs_id_seq.NEXTVAL NOT NULL,
    session_id VARCHAR2(36),
    type VARCHAR2(255) NOT NULL,
    action VARCHAR2(255),
    table_name VARCHAR2(255),
    schema_name VARCHAR2(255),
    message CLOB,
    sql_text CLOB,
    duration_ms NUMBER,
    row_count NUMBER,
    metadata CLOB,
    created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT mb_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE categorias_produtos (
    id VARCHAR2(36) DEFAULT SYS_GUID() NOT NULL,
    nome VARCHAR2(255) NOT NULL,
    criado_em TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT categorias_produtos_pkey PRIMARY KEY (id)
);

CREATE TABLE clientes (
    id VARCHAR2(36) DEFAULT SYS_GUID() NOT NULL,
    nome_empresa VARCHAR2(255) NOT NULL,
    cnpj_cpf VARCHAR2(20),
    email_contato VARCHAR2(255),
    status_lead VARCHAR2(50) DEFAULT 'Novo' NOT NULL,
    latitude NUMBER(10,6),
    longitude NUMBER(10,6),
    criado_em TIMESTAMP DEFAULT SYSTIMESTAMP,
    endereco CLOB,
    CONSTRAINT clientes_pkey PRIMARY KEY (id)
);

CREATE TABLE departamentos (
    id VARCHAR2(36) DEFAULT SYS_GUID() NOT NULL,
    nome VARCHAR2(255) NOT NULL,
    criado_em TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT departamentos_pkey PRIMARY KEY (id)
);

CREATE TABLE entregas (
    id VARCHAR2(36) DEFAULT SYS_GUID() NOT NULL,
    pedido_id VARCHAR2(36),
    motorista_id VARCHAR2(36),
    status VARCHAR2(50) DEFAULT 'Pendente' NOT NULL,
    lat_atual NUMBER(10,6),
    lng_atual NUMBER(10,6),
    data_estimada TIMESTAMP,
    criado_em TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT entregas_pkey PRIMARY KEY (id)
);

CREATE TABLE funcionarios (
    id VARCHAR2(36) DEFAULT SYS_GUID() NOT NULL,
    departamento_id VARCHAR2(36),
    nome VARCHAR2(255) NOT NULL,
    email VARCHAR2(255) NOT NULL,
    cargo VARCHAR2(255) NOT NULL,
    data_contratacao DATE DEFAULT TRUNC(SYSDATE) NOT NULL,
    criado_em TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT funcionarios_pkey PRIMARY KEY (id)
);

CREATE TABLE itens_pedido (
    id VARCHAR2(36) DEFAULT SYS_GUID() NOT NULL,
    pedido_id VARCHAR2(36),
    produto_id VARCHAR2(36),
    quantidade NUMBER DEFAULT 1 NOT NULL,
    preco_unitario NUMBER(10,2) NOT NULL,
    criado_em TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT itens_pedido_pkey PRIMARY KEY (id)
);

CREATE TABLE pedidos (
    id VARCHAR2(36) DEFAULT SYS_GUID() NOT NULL,
    cliente_id VARCHAR2(36),
    funcionario_id VARCHAR2(36),
    status VARCHAR2(50) DEFAULT 'Pendente' NOT NULL,
    data_pedido TIMESTAMP DEFAULT SYSTIMESTAMP,
    criado_em TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT pedidos_pkey PRIMARY KEY (id)
);

CREATE TABLE perfis (
    id VARCHAR2(36) DEFAULT SYS_GUID() NOT NULL,
    nome VARCHAR2(255) NOT NULL,
    descricao CLOB,
    criado_em TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT perfis_pkey PRIMARY KEY (id)
);

CREATE TABLE perfis_usuarios (
    usuario_id VARCHAR2(36) NOT NULL,
    perfil_id VARCHAR2(36) NOT NULL,
    atribuido_em TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT perfis_usuarios_pkey PRIMARY KEY (usuario_id, perfil_id)
);

CREATE TABLE produtos (
    id VARCHAR2(36) DEFAULT SYS_GUID() NOT NULL,
    categoria_id VARCHAR2(36),
    nome VARCHAR2(255) NOT NULL,
    descricao CLOB,
    preco_unitario NUMBER(10,2) NOT NULL,
    quantidade NUMBER DEFAULT 0 NOT NULL,
    url_imagem CLOB,
    criado_em TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT produtos_pkey PRIMARY KEY (id)
);

CREATE TABLE projetos (
    id VARCHAR2(36) DEFAULT SYS_GUID() NOT NULL,
    cliente_id VARCHAR2(36),
    gerente_id VARCHAR2(36),
    nome VARCHAR2(255) NOT NULL,
    data_inicio DATE,
    data_fim DATE,
    status VARCHAR2(50) DEFAULT 'Planejamento' NOT NULL,
    percentual_conclusao NUMBER DEFAULT 0,
    criado_em TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT projetos_pkey PRIMARY KEY (id)
);

CREATE TABLE tarefas (
    id VARCHAR2(36) DEFAULT SYS_GUID() NOT NULL,
    projeto_id VARCHAR2(36),
    responsavel_id VARCHAR2(36),
    titulo VARCHAR2(255) NOT NULL,
    status VARCHAR2(50) DEFAULT 'A Fazer' NOT NULL,
    data_vencimento DATE,
    prioridade VARCHAR2(50) DEFAULT 'Média' NOT NULL,
    criado_em TIMESTAMP DEFAULT SYSTIMESTAMP,
    tarefa_antecessora_id VARCHAR2(36),
    CONSTRAINT tarefas_pkey PRIMARY KEY (id)
);

CREATE TABLE usuarios (
    id VARCHAR2(36) DEFAULT SYS_GUID() NOT NULL,
    nome_completo VARCHAR2(255) NOT NULL,
    email VARCHAR2(255) NOT NULL,
    hash_senha VARCHAR2(255) NOT NULL,
    ativo VARCHAR2(5) DEFAULT 'true',
    criado_em TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT usuarios_pkey PRIMARY KEY (id)
);

-- Índices
CREATE INDEX idx_mb_logs_date ON mb_logs (created_at DESC);
CREATE INDEX idx_mb_logs_table ON mb_logs (table_name, created_at DESC);
CREATE INDEX idx_mb_logs_type ON mb_logs (type, created_at DESC);

-- Chaves Estrangeiras (Foreign Keys)
ALTER TABLE entregas ADD CONSTRAINT entregas_motorista_id_fk FOREIGN KEY (motorista_id) REFERENCES funcionarios(id);
ALTER TABLE entregas ADD CONSTRAINT entregas_pedido_id_fk FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE;

ALTER TABLE funcionarios ADD CONSTRAINT func_departamento_id_fk FOREIGN KEY (departamento_id) REFERENCES departamentos(id);

ALTER TABLE itens_pedido ADD CONSTRAINT itens_pedido_pedido_id_fk FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE;
ALTER TABLE itens_pedido ADD CONSTRAINT itens_pedido_produto_id_fk FOREIGN KEY (produto_id) REFERENCES produtos(id);

ALTER TABLE pedidos ADD CONSTRAINT pedidos_cliente_id_fk FOREIGN KEY (cliente_id) REFERENCES clientes(id);
ALTER TABLE pedidos ADD CONSTRAINT pedidos_funcionario_id_fk FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id);

ALTER TABLE perfis_usuarios ADD CONSTRAINT perf_usu_perfil_id_fk FOREIGN KEY (perfil_id) REFERENCES perfis(id);
ALTER TABLE perfis_usuarios ADD CONSTRAINT perf_usu_usuario_id_fk FOREIGN KEY (usuario_id) REFERENCES usuarios(id);

ALTER TABLE produtos ADD CONSTRAINT produtos_categoria_id_fk FOREIGN KEY (categoria_id) REFERENCES categorias_produtos(id);

ALTER TABLE projetos ADD CONSTRAINT projetos_cliente_id_fk FOREIGN KEY (cliente_id) REFERENCES clientes(id);
ALTER TABLE projetos ADD CONSTRAINT projetos_gerente_id_fk FOREIGN KEY (gerente_id) REFERENCES funcionarios(id);

ALTER TABLE tarefas ADD CONSTRAINT tarefas_projeto_id_fk FOREIGN KEY (projeto_id) REFERENCES projetos(id);
ALTER TABLE tarefas ADD CONSTRAINT tarefas_responsavel_id_fk FOREIGN KEY (responsavel_id) REFERENCES funcionarios(id);
ALTER TABLE tarefas ADD CONSTRAINT tarefas_tarefa_ant_id_fk FOREIGN KEY (tarefa_antecessora_id) REFERENCES tarefas(id) ON DELETE SET NULL;
