const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'supabase', 'migrations', 'erp_full.sql');
const outputFile = path.join(__dirname, 'supabase', 'migrations', 'erp_ptbr_data.sql');

const sql = fs.readFileSync(inputFile, 'utf-8');

// Extrair apenas as seções COPY ... \.
const copyBlocks = [];
let inCopy = false;
let currentBlock = [];

const lines = sql.split('\n');
for (let line of lines) {
    if (line.startsWith('COPY public.')) {
        inCopy = true;
    }
    
    if (inCopy) {
        currentBlock.push(line);
        if (line.trim() === '\\.') {
            copyBlocks.push(currentBlock.join('\n'));
            currentBlock = [];
            inCopy = false;
        }
    }
}

let resultData = copyBlocks.join('\n\n');

// Fazer o replace dos cabeçalhos das tabelas
const replacements = {
    'COPY public.customers (id, company_name, tax_id, contact_email, lead_status, latitude, longitude, created_at) FROM stdin;':
    'COPY public.clientes (id, nome_empresa, cnpj_cpf, email_contato, status_lead, latitude, longitude, criado_em) FROM stdin;',

    'COPY public.deliveries (id, order_id, driver_id, status, current_lat, current_lng, estimated_date, created_at) FROM stdin;':
    'COPY public.entregas (id, pedido_id, motorista_id, status, lat_atual, lng_atual, data_estimada, criado_em) FROM stdin;',

    'COPY public.departments (id, name, created_at) FROM stdin;':
    'COPY public.departamentos (id, nome, criado_em) FROM stdin;',

    'COPY public.employees (id, department_id, name, email, role, hire_date, created_at) FROM stdin;':
    'COPY public.funcionarios (id, departamento_id, nome, email, cargo, data_contratacao, criado_em) FROM stdin;',

    'COPY public.order_items (id, order_id, product_id, quantity, unit_price, subtotal, created_at) FROM stdin;':
    'COPY public.itens_pedido (id, pedido_id, produto_id, quantidade, preco_unitario, subtotal, criado_em) FROM stdin;',

    'COPY public.orders (id, customer_id, employee_id, total_amount, status, order_date, created_at) FROM stdin;':
    'COPY public.pedidos (id, cliente_id, funcionario_id, valor_total, status, data_pedido, criado_em) FROM stdin;',

    'COPY public.product_categories (id, name, created_at) FROM stdin;':
    'COPY public.categorias_produtos (id, nome, criado_em) FROM stdin;',

    'COPY public.products (id, category_id, name, description, base_price, current_stock, image_url, created_at) FROM stdin;':
    'COPY public.produtos (id, categoria_id, nome, descricao, preco_base, estoque_atual, url_imagem, criado_em) FROM stdin;',

    'COPY public.projects (id, customer_id, manager_id, name, start_date, end_date, status, completion_percentage, created_at) FROM stdin;':
    'COPY public.projetos (id, cliente_id, gerente_id, nome, data_inicio, data_fim, status, percentual_conclusao, criado_em) FROM stdin;',

    'COPY public.roles (id, name, description, created_at) FROM stdin;':
    'COPY public.perfis (id, nome, descricao, criado_em) FROM stdin;',

    'COPY public.tasks (id, project_id, assignee_id, title, status, due_date, priority, created_at) FROM stdin;':
    'COPY public.tarefas (id, projeto_id, responsavel_id, titulo, status, data_vencimento, prioridade, criado_em) FROM stdin;',

    'COPY public.user_roles (user_id, role_id, assigned_at) FROM stdin;':
    'COPY public.perfis_usuarios (usuario_id, perfil_id, atribuido_em) FROM stdin;',

    'COPY public.users (id, full_name, email, password_hash, active, created_at) FROM stdin;':
    'COPY public.usuarios (id, nome_completo, email, hash_senha, ativo, criado_em) FROM stdin;'
};

for (const [eng, ptbr] of Object.entries(replacements)) {
    resultData = resultData.replace(eng, ptbr);
}

fs.writeFileSync(outputFile, '-- DADOS DO ERP EM PORTUGUES (PT-BR)\n\n' + resultData, 'utf-8');
console.log('Gerado erp_ptbr_data.sql com sucesso!');
