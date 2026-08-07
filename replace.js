const fs = require('fs');

const f1 = 'src/app/checkout/page.tsx';
let c1 = fs.readFileSync(f1, 'utf8');
c1 = c1.replace(/'\/login\?redirect_to/g, "'/?redirect_to");
fs.writeFileSync(f1, c1);

const f2 = 'src/components/runtime/DynamicSidebar.tsx';
let c2 = fs.readFileSync(f2, 'utf8');
c2 = c2.replace(/\$\{finalBaseNavUrl\}\/login/g, "${finalBaseNavUrl}");
fs.writeFileSync(f2, c2);

const f3 = 'src/components/runtime/RuntimeLayoutClient.tsx';
let c3 = fs.readFileSync(f3, 'utf8');
c3 = c3.replace(/\$\{finalBaseNavUrl\}\/login/g, "${finalBaseNavUrl}");
fs.writeFileSync(f3, c3);

console.log('done');
