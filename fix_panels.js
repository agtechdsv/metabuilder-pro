const fs = require('fs');

// 1. TriggerPropertiesPanel.tsx
let trigger = fs.readFileSync('src/components/studio/bpm/panels/TriggerPropertiesPanel.tsx', 'utf8');
trigger = trigger.replace('  return (\n    <>\n                  const triggerTypes', 
`  const triggerTypes`);
trigger = trigger.replace('                  const hasUpdate = triggerTypes.includes(\'update\');\n\n                  return (\n',
`  const hasUpdate = triggerTypes.includes('update');\n\n  return (\n    <>\n`);
// Remove trailing )})()
trigger = trigger.replace(/ \+\n                  }\)\(\)\}\n\n    <\/>\n  \);\n\}/g, ''); // Wait, let's just strip the last 5 lines and add clean ones.
let triggerLines = trigger.split('\n');
while(triggerLines.length > 0 && ['    </>', '  );', '}', '                  })()}'].includes(triggerLines[triggerLines.length - 1].trim()) || triggerLines[triggerLines.length - 1].trim() === '') {
  triggerLines.pop();
}
trigger = triggerLines.join('\n') + '\n    </>\n  );\n}\n';
fs.writeFileSync('src/components/studio/bpm/panels/TriggerPropertiesPanel.tsx', trigger);

// 2. ConditionPropertiesPanel.tsx
let condition = fs.readFileSync('src/components/studio/bpm/panels/ConditionPropertiesPanel.tsx', 'utf8');
condition = condition.replace('  return (\n    <>\n                  const groups',
`  const groups`);
condition = condition.replace('                  return (\n',
`  return (\n    <>\n`);
let conditionLines = condition.split('\n');
while(conditionLines.length > 0 && ['    </>', '  );', '}', '                  )}'].includes(conditionLines[conditionLines.length - 1].trim()) || conditionLines[conditionLines.length - 1].trim() === '') {
  conditionLines.pop();
}
condition = conditionLines.join('\n') + '\n    </>\n  );\n}\n';
fs.writeFileSync('src/components/studio/bpm/panels/ConditionPropertiesPanel.tsx', condition);

// 3. ActionPropertiesPanel.tsx
let action = fs.readFileSync('src/components/studio/bpm/panels/ActionPropertiesPanel.tsx', 'utf8');
let actionLines = action.split('\n');
while(actionLines.length > 0 && ['    </>', '  );', '}', '                  )}'].includes(actionLines[actionLines.length - 1].trim()) || actionLines[actionLines.length - 1].trim() === '') {
  actionLines.pop();
}
action = actionLines.join('\n') + '\n    </>\n  );\n}\n';
fs.writeFileSync('src/components/studio/bpm/panels/ActionPropertiesPanel.tsx', action);

console.log('Fixed syntax errors in panels.');
