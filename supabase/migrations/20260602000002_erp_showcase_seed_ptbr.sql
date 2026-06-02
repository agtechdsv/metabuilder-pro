-- ERP Showcase: Gold Standard Demo Database (DADOS EM PT-BR)
-- Este script limpa os dados existentes e popula o banco com dados em Português do Brasil.
-- As tabelas e colunas permanecem em inglês para mercado internacional.

-- 1. LIMPEZA DOS DADOS EXISTENTES (CUIDADO: Apaga todos os dados das tabelas do ERP)
TRUNCATE TABLE deliveries, tasks, projects, order_items, orders, customers, products, product_categories, employees, departments CASCADE;

-- 2. GERAÇÃO DE DADOS MOCKADOS (HIGH VOLUME) - PORTUGUÊS BR
DO $$
DECLARE
    dep_sales UUID;
    dep_ops UUID;
    dep_log UUID;
    emp_sales_1 UUID;
    emp_sales_2 UUID;
    emp_manager UUID;
    emp_driver_1 UUID;
    emp_driver_2 UUID;
    cat_hw UUID;
    cat_sw UUID;
    cat_serv UUID;
    prod_ids UUID[];
    cust_ids UUID[];
    proj_ids UUID[];
    ord_id UUID;
    i INT;
    j INT;
    random_days INT;
    random_prod_idx INT;
    random_cust_idx INT;
    random_qty INT;
    unit_p NUMERIC(10,2);
    sum_total NUMERIC(12,2);
    tmp_proj_id UUID;
BEGIN
    -- 3.1 Departments
    INSERT INTO departments (name) VALUES ('Vendas & CRM') RETURNING id INTO dep_sales;
    INSERT INTO departments (name) VALUES ('Operações') RETURNING id INTO dep_ops;
    INSERT INTO departments (name) VALUES ('Logística') RETURNING id INTO dep_log;

    -- 3.2 Employees
    INSERT INTO employees (department_id, name, email, role, hire_date) VALUES (dep_sales, 'Carlos Silva', 'carlos@showcase.com', 'Executivo de Contas', '2023-01-15') RETURNING id INTO emp_sales_1;
    INSERT INTO employees (department_id, name, email, role, hire_date) VALUES (dep_sales, 'Mariana Costa', 'mariana@showcase.com', 'Representante de Vendas', '2023-05-20') RETURNING id INTO emp_sales_2;
    INSERT INTO employees (department_id, name, email, role, hire_date) VALUES (dep_ops, 'Roberto Alves', 'roberto@showcase.com', 'Gerente de Projetos', '2022-11-01') RETURNING id INTO emp_manager;
    INSERT INTO employees (department_id, name, email, role, hire_date) VALUES (dep_log, 'Fernando Souza', 'fernando@showcase.com', 'Motorista', '2024-02-10') RETURNING id INTO emp_driver_1;
    INSERT INTO employees (department_id, name, email, role, hire_date) VALUES (dep_log, 'Amanda Nunes', 'amanda@showcase.com', 'Motorista', '2024-03-15') RETURNING id INTO emp_driver_2;

    -- 3.3 Categories
    INSERT INTO product_categories (name) VALUES ('Equipamentos Físicos') RETURNING id INTO cat_hw;
    INSERT INTO product_categories (name) VALUES ('Licenças de Software') RETURNING id INTO cat_sw;
    INSERT INTO product_categories (name) VALUES ('Serviços Profissionais') RETURNING id INTO cat_serv;

    -- 3.4 Products
    WITH inserted AS (
        INSERT INTO products (category_id, name, description, base_price, current_stock) VALUES
        (cat_hw, 'Servidor Enterprise Rack', 'Servidor Padrão 42U de alta performance', 12000.00, 50),
        (cat_hw, 'Switch de Rede 48-portas', 'Switch inteligente para datacenters', 8500.50, 120),
        (cat_hw, 'Storage NAS 100TB', 'Armazenamento NVMe Ultra-rápido', 45000.00, 15),
        (cat_sw, 'Plataforma ERP Cloud', 'Licença anual por usuário', 1200.00, 9999),
        (cat_sw, 'Antivírus Corporativo Pro', 'Proteção avançada contra ameaças', 850.00, 9999),
        (cat_serv, 'Consultoria de Implantação', 'Hora técnica de especialistas sênior', 350.00, 0),
        (cat_serv, 'Suporte Premium 24/7', 'SLA dedicado de resolução em 1 hora', 5000.00, 0)
        RETURNING id
    )
    SELECT array_agg(id) INTO prod_ids FROM inserted;

    -- 3.5 Customers (Around 15 customers with locations)
    WITH inserted AS (
        INSERT INTO customers (company_name, tax_id, contact_email, lead_status, latitude, longitude) VALUES
        ('TechCorp Brasil', '12.345.678/0001-99', 'contato@techcorp.com.br', 'Fechado Ganho', -23.5505, -46.6333),
        ('Logística Global SA', '98.765.432/0001-11', 'compras@logistica.com.br', 'Em Negociação', -22.9068, -43.1729),
        ('Fazendas Agro Sul', '45.123.890/0001-55', 'admin@agrosul.com.br', 'Fechado Ganho', -15.7942, -47.8822),
        ('NextGen Startups', '33.444.555/0001-22', 'ola@nextgen.com.br', 'Contactado', -19.9167, -43.9345),
        ('Banco Financeiro', '11.222.333/0001-44', 'ti@bancofinanceiro.com.br', 'Fechado Ganho', -25.4284, -49.2733),
        ('Varejista Gigante', '55.666.777/0001-88', 'b2b@varejistagigante.com', 'Novo', -30.0346, -51.2177),
        ('Mais Saúde Clínicas', '77.888.999/0001-10', 'operacoes@maissaude.com.br', 'Fechado Ganho', -12.9714, -38.5014),
        ('Academia EduTech', '22.333.444/0001-66', 'suporte@edutech.com.br', 'Em Negociação', -8.0476, -34.8770),
        ('Rede de Energia', '88.999.000/0001-21', 'suprimentos@redeenergia.com.br', 'Fechado Ganho', -3.7319, -38.5267),
        ('Prefeitura Inteligente', '99.000.111/0001-32', 'licitacao@prefeiturainteligente.gov.br', 'Contactado', -1.4550, -48.5024),
        ('Futuro Tech Indústria', '12.222.333/0001-55', 'b2b@futurotech.com.br', 'Fechado Ganho', -23.5615, -46.6553),
        ('Fretes Marítimos', '44.555.666/0001-77', 'logistica@fretesmaritimos.com', 'Novo', -22.8968, -43.1829),
        ('Soluções de Energia Verde', '88.777.666/0001-99', 'contato@energiaverde.com.br', 'Em Negociação', -15.8042, -47.8922),
        ('Mega Varejistas S/A', '11.111.111/0001-11', 'compras@megavarejistas.com.br', 'Fechado Ganho', -19.9267, -43.9445),
        ('Banco Nacional S/A', '22.222.222/0001-22', 'compras@banconacional.com.br', 'Contactado', -25.4384, -49.2833)
        RETURNING id
    )
    SELECT array_agg(id) INTO cust_ids FROM inserted;

    -- 3.6 Generate 150 Orders for rich Analytics (Bigger Volume!)
    FOR i IN 1..150 LOOP
        random_cust_idx := floor(random() * array_length(cust_ids, 1) + 1);
        random_days := floor(random() * 180); -- Orders from the last 6 months
        
        INSERT INTO orders (customer_id, employee_id, status, order_date)
        VALUES (
            cust_ids[random_cust_idx],
            CASE WHEN random() > 0.5 THEN emp_sales_1 ELSE emp_sales_2 END,
            CASE 
                WHEN random() > 0.8 THEN 'Pendente'
                WHEN random() > 0.6 THEN 'Aprovado'
                WHEN random() > 0.4 THEN 'Enviado'
                WHEN random() > 0.1 THEN 'Entregue'
                ELSE 'Cancelado'
            END,
            CURRENT_DATE - random_days * INTERVAL '1 day'
        ) RETURNING id INTO ord_id;

        -- Order Items (1 to 5 items per order)
        sum_total := 0;
        FOR j IN 1..floor(random() * 5 + 1) LOOP
            random_prod_idx := floor(random() * array_length(prod_ids, 1) + 1);
            random_qty := floor(random() * 10 + 1);
            SELECT base_price INTO unit_p FROM products WHERE id = prod_ids[random_prod_idx];
            
            INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
            VALUES (ord_id, prod_ids[random_prod_idx], random_qty, unit_p, random_qty * unit_p);
            
            sum_total := sum_total + (random_qty * unit_p);
        END LOOP;

        -- Update order total
        UPDATE orders SET total_amount = sum_total WHERE id = ord_id;

        -- Create Delivery if status is Enviado or Entregue
        IF (SELECT status FROM orders WHERE id = ord_id) IN ('Enviado', 'Entregue') THEN
            INSERT INTO deliveries (order_id, driver_id, status, current_lat, current_lng, estimated_date)
            VALUES (
                ord_id,
                CASE WHEN random() > 0.5 THEN emp_driver_1 ELSE emp_driver_2 END,
                (SELECT status FROM orders WHERE id = ord_id),
                (SELECT latitude FROM customers WHERE id = cust_ids[random_cust_idx]) + (random() * 0.1 - 0.05),
                (SELECT longitude FROM customers WHERE id = cust_ids[random_cust_idx]) + (random() * 0.1 - 0.05),
                CURRENT_DATE - (random_days - 3) * INTERVAL '1 day'
            );
        END IF;
    END LOOP;

    -- 3.7 Create 15 Projects (Gantt)
    FOR i IN 1..15 LOOP
        random_cust_idx := floor(random() * array_length(cust_ids, 1) + 1);
        
        INSERT INTO projects (customer_id, manager_id, name, start_date, end_date, status, completion_percentage)
        VALUES (
            cust_ids[random_cust_idx],
            emp_manager,
            'Fase de Implantação ' || i,
            CURRENT_DATE + (i * 5 - 30) * INTERVAL '1 day',
            CURRENT_DATE + (i * 5 + 30) * INTERVAL '1 day',
            CASE 
                WHEN i <= 5 THEN 'Concluído'
                WHEN i <= 10 THEN 'Em Andamento'
                ELSE 'Planejamento'
            END,
            CASE 
                WHEN i <= 5 THEN 100
                WHEN i <= 10 THEN floor(random() * 80 + 10) -- Random between 10 and 90
                ELSE 0
            END
        ) RETURNING id INTO tmp_proj_id;
        
        proj_ids[i] := tmp_proj_id;

        -- Create Tasks for this project (Kanban & Calendar)
        INSERT INTO tasks (project_id, assignee_id, title, status, due_date, priority) VALUES
        (proj_ids[i], emp_manager, 'Reunião Inicial (Kickoff)', 'Feito', CURRENT_DATE + (i * 5 - 30) * INTERVAL '1 day', 'Alta'),
        (proj_ids[i], emp_sales_1, 'Levantamento de Requisitos', CASE WHEN i <= 10 THEN 'Feito' ELSE 'Em Andamento' END, CURRENT_DATE + (i * 5 - 20) * INTERVAL '1 day', 'Alta'),
        (proj_ids[i], emp_sales_2, 'Instalação de Equipamentos', CASE WHEN i <= 5 THEN 'Feito' WHEN i <= 10 THEN 'Em Andamento' ELSE 'A Fazer' END, CURRENT_DATE + (i * 5 - 10) * INTERVAL '1 day', 'Média'),
        (proj_ids[i], emp_driver_1, 'Logística de Entrega', CASE WHEN i <= 5 THEN 'Feito' WHEN i <= 10 THEN 'Em Andamento' ELSE 'A Fazer' END, CURRENT_DATE + (i * 5) * INTERVAL '1 day', 'Média'),
        (proj_ids[i], emp_manager, 'Treinamento de Usuários', CASE WHEN i <= 5 THEN 'Feito' ELSE 'A Fazer' END, CURRENT_DATE + (i * 5 + 10) * INTERVAL '1 day', 'Baixa'),
        (proj_ids[i], emp_manager, 'Revisão Pós-Implantação', CASE WHEN i <= 5 THEN 'Feito' ELSE 'A Fazer' END, CURRENT_DATE + (i * 5 + 20) * INTERVAL '1 day', 'Alta');

    END LOOP;

END $$;
