const fs = require('fs');
let content = fs.readFileSync('src/components/runtime/ViewPageContent.tsx', 'utf8');

// Show the analytics optgroup section (occurrence 10 at index ~52231)
const idx = 52231;
console.log(content.substring(idx - 400, idx + 600));
