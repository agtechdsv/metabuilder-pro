const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'supabase', 'migrations', 'erp_full.sql');
const outputFile = path.join(__dirname, 'supabase', 'migrations', 'erp_ptbr_data.sql');

const sql = fs.readFileSync(inputFile, 'utf-8');

// Mapeamento de tabelas e colunas em português
const tableMappings = {
    'public.customers': { table: 'public.clientes', cols: 'id, nome_empresa, cnpj_cpf, email_contato, status_lead, latitude, longitude, criado_em' },
    'public.deliveries': { table: 'public.entregas', cols: 'id, pedido_id, motorista_id, status, lat_atual, lng_atual, data_estimada, criado_em' },
    'public.departments': { table: 'public.departamentos', cols: 'id, nome, criado_em' },
    'public.employees': { table: 'public.funcionarios', cols: 'id, departamento_id, nome, email, cargo, data_contratacao, criado_em' },
    'public.order_items': { table: 'public.itens_pedido', cols: 'id, pedido_id, produto_id, quantidade, preco_unitario, subtotal, criado_em' },
    'public.orders': { table: 'public.pedidos', cols: 'id, cliente_id, funcionario_id, valor_total, status, data_pedido, criado_em' },
    'public.product_categories': { table: 'public.categorias_produtos', cols: 'id, nome, criado_em' },
    'public.products': { table: 'public.produtos', cols: 'id, categoria_id, nome, descricao, preco_base, estoque_atual, url_imagem, criado_em' },
    'public.projects': { table: 'public.projetos', cols: 'id, cliente_id, gerente_id, nome, data_inicio, data_fim, status, percentual_conclusao, criado_em' },
    'public.roles': { table: 'public.perfis', cols: 'id, nome, descricao, criado_em' },
    'public.tasks': { table: 'public.tarefas', cols: 'id, projeto_id, responsavel_id, titulo, status, data_vencimento, prioridade, criado_em' },
    'public.user_roles': { table: 'public.perfis_usuarios', cols: 'usuario_id, perfil_id, atribuido_em' },
    'public.users': { table: 'public.usuarios', cols: 'id, nome_completo, email, hash_senha, ativo, criado_em' }
};

let outSql = '-- DADOS DO ERP EM PORTUGUES (PT-BR) - USANDO INSERTS\n\n';

const lines = sql.split('\n');
let inCopy = false;
let currentTable = null;

for (let line of lines) {
    if (line.startsWith('COPY ')) {
        // Ex: COPY public.customers (id, ...) FROM stdin;
        const match = line.match(/^COPY (public\.\w+)/);
        if (match && tableMappings[match[1]]) {
            inCopy = true;
            currentTable = tableMappings[match[1]];
            continue;
        }
    }
    
    if (inCopy) {
        if (line.trim() === '\\.') {
            inCopy = false;
            currentTable = null;
            outSql += '\n';
            continue;
        }
        
        // Parse da linha separada por tabulação
        const values = line.split('\t').map(v => {
            if (v === '\\N') return 'NULL';
            // Escapa aspas simples do SQL e envolve em aspas
            return "'" + v.replace(/'/g, "''") + "'";
        });
        
        outSql += `INSERT INTO ${currentTable.table} (${currentTable.cols}) VALUES (${values.join(', ')});\n`;
    }
}

fs.writeFileSync(outputFile, outSql, 'utf-8');
console.log('Gerado erp_ptbr_data.sql usando INSERTS com sucesso!');
