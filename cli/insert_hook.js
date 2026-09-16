
const fs = require('fs');
const path = require('path');
const idxPath = path.join(__dirname, 'index.js');
let content = fs.readFileSync(idxPath, 'utf8');

// Insert a hook right before Oracle execute to log the exact SQL to a file
const hook = 
          if (dbType === 'oracle') {
            fs.writeFileSync(require('path').join(__dirname, 'oracle_debug_sql.txt'), 'SQL:\\n' + sql + '\\n\\nPARAMS:\\n' + JSON.stringify(params));
            const oraRes = await oracleConnection.execute(sql, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
;
content = content.replace(/if\s*\(dbType\s*===\s*'oracle'\)\s*\{\s*const\s*oraRes\s*=\s*await\s*oracleConnection\.execute\([^)]+\);/m, hook);
fs.writeFileSync(idxPath, content);
console.log('Hook inserido no cli/index.js');

