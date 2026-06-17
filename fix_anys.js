const fs = require('fs');

function fixAnys(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix openGroupUsersModal(grupo: any) -> openGroupUsersModal(grupo)
  content = content.replace('openGroupUsersModal(grupo: any)', 'openGroupUsersModal(grupo)');
  
  // Fix implicit anys: param =>
  const params = ['m', 'f', 'e', 'en', 'v', 'grupo', 'uc'];
  params.forEach(p => {
    // Regex matches " p =>" or "(p) =>"
    const regex1 = new RegExp(`([^a-zA-Z0-9_])\\b${p}\\s*=>`, 'g');
    content = content.replace(regex1, `$1(${p}: any) =>`);
  });

  fs.writeFileSync(filePath, content);
}

fixAnys('src/components/studio/bpm/panels/ActionPropertiesPanel.tsx');
fixAnys('src/components/studio/bpm/panels/ConditionPropertiesPanel.tsx');
fixAnys('src/components/studio/bpm/panels/TriggerPropertiesPanel.tsx');

// Fix BpmModals
let modals = fs.readFileSync('src/components/studio/bpm/modals/BpmModals.tsx', 'utf8');
const params = ['u', 'prev', 'f', 'val'];
params.forEach(p => {
  const regex1 = new RegExp(`([^a-zA-Z0-9_])\\b${p}\\s*=>`, 'g');
  modals = modals.replace(regex1, `$1(${p}: any) =>`);
});
fs.writeFileSync('src/components/studio/bpm/modals/BpmModals.tsx', modals);

console.log('Fixed implicit anys again.');
