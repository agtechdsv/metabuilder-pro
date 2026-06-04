const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'supabase', 'migrations', 'erp_ptbr_data.sql');
const sql = fs.readFileSync(targetFile, 'utf-8');

const lines = sql.split('\n');
let outSql = '-- DADOS DO ERP EM PORTUGUES (PT-BR) - USANDO INSERTS\n\n';

let inCopy = false;
let currentTable = null;
let currentCols = null;

for (let line of lines) {
    if (line.startsWith('COPY ')) {
        const match = line.match(/^COPY (public\.\w+) \((.*?)\) FROM stdin;/);
        if (match) {
            inCopy = true;
            currentTable = match[1];
            currentCols = match[2];
            continue;
        }
    }
    
    if (inCopy) {
        if (line.trim() === '\\.') {
            inCopy = false;
            currentTable = null;
            currentCols = null;
            outSql += '\n';
            continue;
        }
        
        const values = line.split('\t').map(v => {
            if (v === '\\N') return 'NULL';
            return "'" + v.replace(/'/g, "''") + "'";
        });
        
        outSql += `INSERT INTO ${currentTable} (${currentCols}) VALUES (${values.join(', ')});\n`;
    }
}

fs.writeFileSync(targetFile, outSql, 'utf-8');
console.log('Arquivo convertido para INSERTS com sucesso!');
