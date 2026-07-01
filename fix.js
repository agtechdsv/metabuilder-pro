const fs = require('fs'); 
const file = 'src/app/actions/workspace.ts'; 
let content = fs.readFileSync(file, 'utf8'); 
content = content.replace(/\.reduce\(\(sum, r\)/g, '.reduce((sum: any, r: any)'); 
content = content.replace(/\.find\(([a-zA-Z]+) =>/g, '.find(($1: any) =>'); 
content = content.replace(/\.filter\(([a-zA-Z]+) =>/g, '.filter(($1: any) =>'); 
content = content.replace(/\.map\(([a-zA-Z]+) =>/g, '.map(($1: any) =>'); 
fs.writeFileSync(file, content);
