const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  const files = execSync('git grep -l "redirect(\'/\')" src/app').toString().split('\n').filter(Boolean);
  for (const f of files) {
    let c = fs.readFileSync(f, 'utf8');
    c = c.replace(/redirect\('\/'\)/g, "redirect('/auth/session-expired')");
    fs.writeFileSync(f, c);
    console.log('Updated ' + f);
  }
} catch (e) {
  console.log(e);
}
