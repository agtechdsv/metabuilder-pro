-- ERP Showcase: Gold Standard Demo Database
-- Este script cria um banco de dados completo de ERP para testes do MetaBuilderPRO
-- Autor: AntiGravity
-- Data: Jun 2026

-- 1. EXTENSIONS (Necessário para geração de UUID e dados randômicos mais avançados, se não existir)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. CRIAÇÃO DAS TABELAS (SCHEMAS)
-- ==============================================================================

CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID REFERENCES departments(id),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE product_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES product_categories(id),
    name TEXT NOT NULL,
    description TEXT,
    base_price NUMERIC(10,2) NOT NULL,
    current_stock INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name TEXT NOT NULL,
    tax_id TEXT,
    contact_email TEXT,
    lead_status TEXT NOT NULL DEFAULT 'New',
    latitude NUMERIC(10,6),
    longitude NUMERIC(10,6),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id),
    employee_id UUID REFERENCES employees(id),
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Pending',
    order_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(10,2) NOT NULL,
    subtotal NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id),
    manager_id UUID REFERENCES employees(id),
    name TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'Planning',
    completion_percentage INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    assignee_id UUID REFERENCES employees(id),
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'To Do',
    due_date DATE,
    priority TEXT NOT NULL DEFAULT 'Medium',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id),
    driver_id UUID REFERENCES employees(id),
    status TEXT NOT NULL DEFAULT 'Pending',
    current_lat NUMERIC(10,6),
    current_lng NUMERIC(10,6),
    estimated_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS básico para manter o padrão Supabase (Permitir TUDO para demonstração)
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow ALL on departments" ON departments FOR ALL USING (true);
CREATE POLICY "Allow ALL on employees" ON employees FOR ALL USING (true);
CREATE POLICY "Allow ALL on product_categories" ON product_categories FOR ALL USING (true);
CREATE POLICY "Allow ALL on products" ON products FOR ALL USING (true);
CREATE POLICY "Allow ALL on customers" ON customers FOR ALL USING (true);
CREATE POLICY "Allow ALL on orders" ON orders FOR ALL USING (true);
CREATE POLICY "Allow ALL on order_items" ON order_items FOR ALL USING (true);
CREATE POLICY "Allow ALL on projects" ON projects FOR ALL USING (true);
CREATE POLICY "Allow ALL on tasks" ON tasks FOR ALL USING (true);
CREATE POLICY "Allow ALL on deliveries" ON deliveries FOR ALL USING (true);


-- ==============================================================================
-- 3. GERAÇÃO DE DADOS MOCKADOS (HIGH VOLUME)
-- ==============================================================================

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
    INSERT INTO departments (name) VALUES ('Sales & CRM') RETURNING id INTO dep_sales;
    INSERT INTO departments (name) VALUES ('Operations') RETURNING id INTO dep_ops;
    INSERT INTO departments (name) VALUES ('Logistics') RETURNING id INTO dep_log;

    -- 3.2 Employees
    INSERT INTO employees (department_id, name, email, role, hire_date) VALUES (dep_sales, 'Sarah Jenkins', 'sarah@showcase.com', 'Account Executive', '2023-01-15') RETURNING id INTO emp_sales_1;
    INSERT INTO employees (department_id, name, email, role, hire_date) VALUES (dep_sales, 'Mike Ross', 'mike@showcase.com', 'Sales Rep', '2023-05-20') RETURNING id INTO emp_sales_2;
    INSERT INTO employees (department_id, name, email, role, hire_date) VALUES (dep_ops, 'Elena Rodriguez', 'elena@showcase.com', 'Project Manager', '2022-11-01') RETURNING id INTO emp_manager;
    INSERT INTO employees (department_id, name, email, role, hire_date) VALUES (dep_log, 'Tom Hardy', 'tom@showcase.com', 'Driver', '2024-02-10') RETURNING id INTO emp_driver_1;
    INSERT INTO employees (department_id, name, email, role, hire_date) VALUES (dep_log, 'Vin Diesel', 'vin@showcase.com', 'Driver', '2024-03-15') RETURNING id INTO emp_driver_2;

    -- 3.3 Categories
    INSERT INTO product_categories (name) VALUES ('Hardware') RETURNING id INTO cat_hw;
    INSERT INTO product_categories (name) VALUES ('Software Licenses') RETURNING id INTO cat_sw;
    INSERT INTO product_categories (name) VALUES ('Services') RETURNING id INTO cat_serv;

    -- 3.4 Products
    WITH inserted AS (
        INSERT INTO products (category_id, name, description, base_price, current_stock) VALUES
        (cat_hw, 'Enterprise Server Rack', '42U Standard Server Rack', 1200.00, 50),
        (cat_hw, 'Cloud Switch 48-port', 'High-performance network switch', 850.50, 120),
        (cat_hw, 'Storage Array 100TB', 'NVMe All-Flash Storage', 4500.00, 15),
        (cat_sw, 'ERP Cloud Platform', 'Annual license per user', 120.00, 9999),
        (cat_sw, 'Security Shield Pro', 'Advanced threat protection', 85.00, 9999),
        (cat_serv, 'Implementation Consulting', 'Expert deployment services per hour', 150.00, 0),
        (cat_serv, 'Premium Support SLA', '24/7 dedicated support team', 500.00, 0)
        RETURNING id
    )
    SELECT array_agg(id) INTO prod_ids FROM inserted;

    -- 3.5 Customers (Around 15 customers with locations)
    WITH inserted AS (
        INSERT INTO customers (company_name, tax_id, contact_email, lead_status, latitude, longitude) VALUES
        ('TechCorp Inc.', '12.345.678/0001-99', 'contact@techcorp.com', 'Closed Won', -23.5505, -46.6333),
        ('Global Logistics SA', '98.765.432/0001-11', '采购@globallog.com', 'Negotiation', -22.9068, -43.1729),
        ('AgroFarms Ltd', '45.123.890/0001-55', 'admin@agrofarms.com', 'Closed Won', -15.7942, -47.8822),
        ('NextGen Startups', '33.444.555/0001-22', 'hello@nextgen.com', 'Contacted', -19.9167, -43.9345),
        ('Finance Bank Co.', '11.222.333/0001-44', 'it@financebank.com', 'Closed Won', -25.4284, -49.2733),
        ('Retail Giant Group', '55.666.777/0001-88', 'b2b@retailgiant.com', 'New', -30.0346, -51.2177),
        ('HealthCare Plus', '77.888.999/0001-10', 'ops@healthcare.com', 'Closed Won', -12.9714, -38.5014),
        ('EduTech Academy', '22.333.444/0001-66', 'suporte@edutech.com', 'Negotiation', -8.0476, -34.8770),
        ('Energy Power grid', '88.999.000/0001-21', 'supply@energypower.com', 'Closed Won', -3.7319, -38.5267),
        ('Smart City Gov', '99.000.111/0001-32', 'licitacao@smartcity.gov', 'Contacted', -1.4550, -48.5024),
        ('Future Tech Industries', '12.222.333/0001-55', 'b2b@futuretech.com', 'Closed Won', -23.5615, -46.6553),
        ('Ocean Freight Ltd', '44.555.666/0001-77', 'logistics@oceanfreight.com', 'New', -22.8968, -43.1829),
        ('Green Energy Solutions', '88.777.666/0001-99', 'contact@greenenergy.com', 'Negotiation', -15.8042, -47.8922),
        ('Mega Retailers', '11.111.111/0001-11', 'purchasing@megaretailers.com', 'Closed Won', -19.9267, -43.9445),
        ('National Bank Corp', '22.222.222/0001-22', 'procurement@nationalbank.com', 'Contacted', -25.4384, -49.2833)
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
                WHEN random() > 0.8 THEN 'Pending'
                WHEN random() > 0.6 THEN 'Approved'
                WHEN random() > 0.4 THEN 'Shipped'
                WHEN random() > 0.1 THEN 'Delivered'
                ELSE 'Cancelled'
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

        -- Create Delivery if status is Shipped or Delivered
        IF (SELECT status FROM orders WHERE id = ord_id) IN ('Shipped', 'Delivered') THEN
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
            'Deployment Phase ' || i,
            CURRENT_DATE + (i * 5 - 30) * INTERVAL '1 day',
            CURRENT_DATE + (i * 5 + 30) * INTERVAL '1 day',
            CASE 
                WHEN i <= 5 THEN 'Completed'
                WHEN i <= 10 THEN 'In Progress'
                ELSE 'Planning'
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
        (proj_ids[i], emp_manager, 'Kickoff Meeting', 'Done', CURRENT_DATE + (i * 5 - 30) * INTERVAL '1 day', 'High'),
        (proj_ids[i], emp_sales_1, 'Requirements Gathering', CASE WHEN i <= 10 THEN 'Done' ELSE 'In Progress' END, CURRENT_DATE + (i * 5 - 20) * INTERVAL '1 day', 'High'),
        (proj_ids[i], emp_sales_2, 'Hardware Installation', CASE WHEN i <= 5 THEN 'Done' WHEN i <= 10 THEN 'In Progress' ELSE 'To Do' END, CURRENT_DATE + (i * 5 - 10) * INTERVAL '1 day', 'Medium'),
        (proj_ids[i], emp_driver_1, 'Delivery Logistics', CASE WHEN i <= 5 THEN 'Done' WHEN i <= 10 THEN 'In Progress' ELSE 'To Do' END, CURRENT_DATE + (i * 5) * INTERVAL '1 day', 'Medium'),
        (proj_ids[i], emp_manager, 'User Training', CASE WHEN i <= 5 THEN 'Done' ELSE 'To Do' END, CURRENT_DATE + (i * 5 + 10) * INTERVAL '1 day', 'Low'),
        (proj_ids[i], emp_manager, 'Go-Live Review', CASE WHEN i <= 5 THEN 'Done' ELSE 'To Do' END, CURRENT_DATE + (i * 5 + 20) * INTERVAL '1 day', 'High');

    END LOOP;

END $$;
