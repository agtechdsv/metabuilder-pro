const fs = require('fs');
const files = [
  'src/components/client/ClientSharedComponents.tsx',
  'src/components/client/ClientMetricsView.tsx',
  'src/components/client/ClientProductivityView.tsx',
  'src/components/client/ClientIClubView.tsx',
  'src/components/client/ClientSubscriptionView.tsx',
  'src/components/client/ClientCancelView.tsx',
  'src/components/client/ClientDashboardClient.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content.replace(/\\\$\{/g, '${');
  newContent = newContent.replace(/\\`/g, '`');
  if (content !== newContent) {
    fs.writeFileSync(file, newContent);
    console.log('Fixed:', file);
  }
}
