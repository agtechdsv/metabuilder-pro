-- Esquema de ESTRESSE (Postgres): nomes fora de convenção de propósito.
-- Rode num banco de TESTE. Depois importe as tabelas no MetaBuilder e monte casos de uso (veja README.md).
DROP SCHEMA IF EXISTS stress CASCADE;
CREATE SCHEMA stress;

-- chave primária "CODIGO" (não "id"), colunas em CAIXA ALTA
CREATE TABLE stress."TB_CLI" (
  "CODIGO"       integer PRIMARY KEY,
  "RAZAO_SOCIAL" varchar(80) NOT NULL,
  "UF"           char(2)
);

-- DUAS chaves estrangeiras para a mesma tabela (cobrança e entrega); PK "NUM_PED"
CREATE TABLE stress."TB_PED" (
  "NUM_PED"      integer PRIMARY KEY,
  "CLI_COBRANCA" integer REFERENCES stress."TB_CLI"("CODIGO"),
  "CLI_ENTREGA"  integer REFERENCES stress."TB_CLI"("CODIGO"),
  "DT_PED"       date,
  "STATUS_PED"   varchar(20)
);

-- filha com PK "SEQ" e FK "COD_PED" (nome que não segue "tabela_id")
CREATE TABLE stress."TB_PED_ITM" (
  "SEQ"        serial PRIMARY KEY,
  "COD_PED"    integer NOT NULL REFERENCES stress."TB_PED"("NUM_PED"),
  "DESCR_ITEM" varchar(80),
  "QTD"        numeric(10,2),
  "VLR_UNIT"   numeric(12,2)
);

-- sem chave primária e sem nenhuma relação
CREATE TABLE stress."TB_SEM_REL" ("A" varchar(40), "B" varchar(40));

INSERT INTO stress."TB_CLI" VALUES (10,'ACME Ltda','MG'),(20,'Globex SA','SP'),(30,'Initech','RJ');
INSERT INTO stress."TB_PED" VALUES
  (1001,10,20,'2026-09-01','ABERTO'),
  (1002,10,10,'2026-09-05','FATURADO'),
  (1003,20,30,'2026-09-07','ABERTO');
INSERT INTO stress."TB_PED_ITM" ("COD_PED","DESCR_ITEM","QTD","VLR_UNIT") VALUES
  (1001,'Parafuso',10,1.5),(1001,'Porca',20,0.8),
  (1002,'Chave',1,35),(1003,'Martelo',2,42.9),(1003,'Prego',100,0.1);
INSERT INTO stress."TB_SEM_REL" VALUES ('x','y'),('z','w');
