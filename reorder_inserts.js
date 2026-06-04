const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'supabase', 'migrations', 'erp_ptbr_data.sql');
let sql = fs.readFileSync(file, 'utf-8');

// The correct order of tables to satisfy Foreign Keys
const correctOrder = [
    'public.departamentos',
    'public.categorias_produtos',
    'public.clientes',
    'public.perfis',
    'public.usuarios',
    'public.funcionarios',
    'public.produtos',
    'public.pedidos',
    'public.projetos',
    'public.perfis_usuarios',
    'public.entregas',
    'public.itens_pedido',
    'public.tarefas'
];

// Group lines by table
const blocks = {};
correctOrder.forEach(t => blocks[t] = []);

const lines = sql.split('\n');
let currentTable = null;

for (let line of lines) {
    if (line.startsWith('INSERT INTO ')) {
        const match = line.match(/^INSERT INTO (public\.\w+)/);
        if (match) {
            currentTable = match[1];
            if (blocks[currentTable]) {
                blocks[currentTable].push(line);
            }
        }
    }
}

// Rebuild the file
let newSql = '-- DADOS DO ERP EM PORTUGUES (PT-BR) - ORDENADO POR DEPENDENCIA\n\n';

for (let table of correctOrder) {
    if (blocks[table].length > 0) {
        newSql += `-- Inserindo dados na tabela ${table}\n`;
        newSql += blocks[table].join('\n') + '\n\n';
    }
}

fs.writeFileSync(file, newSql, 'utf-8');
console.log('Arquivo ordenado com sucesso para evitar erro de Foreign Key!');
