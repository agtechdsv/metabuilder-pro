const fs = require('fs');

// Fix BpmCanvas
let bpm = fs.readFileSync('src/components/studio/bpm/BpmCanvas.tsx', 'utf8').split('\n');
bpm.pop(); // remove empty
if(bpm[bpm.length - 1] === '}') bpm.pop();
bpm.push('    </div>');
bpm.push('  );');
bpm.push('}');
fs.writeFileSync('src/components/studio/bpm/BpmCanvas.tsx', bpm.join('\n'));

// Fix ActionPropertiesPanel
let action = fs.readFileSync('src/components/studio/bpm/panels/ActionPropertiesPanel.tsx', 'utf8').split('\n');
while(action[action.length-1].trim() === '' || action[action.length-1].trim() === '}' || action[action.length-1].trim() === ');' || action[action.length-1].trim() === '</>' || action[action.length-1].trim() === ')}') {
  action.pop();
}
action.push('    </>');
action.push('  );');
action.push('}');
fs.writeFileSync('src/components/studio/bpm/panels/ActionPropertiesPanel.tsx', action.join('\n'));

// Fix ConditionPropertiesPanel
let cond = fs.readFileSync('src/components/studio/bpm/panels/ConditionPropertiesPanel.tsx', 'utf8').split('\n');
while(cond[cond.length-1].trim() === '' || cond[cond.length-1].trim() === '}' || cond[cond.length-1].trim() === ');' || cond[cond.length-1].trim() === '</>' || cond[cond.length-1].trim() === '})()}' || cond[cond.length-1].trim() === ')}') {
  cond.pop();
}
cond.push('    </>');
cond.push('  );');
cond.push('}');
fs.writeFileSync('src/components/studio/bpm/panels/ConditionPropertiesPanel.tsx', cond.join('\n'));

// Fix TriggerPropertiesPanel
let trig = fs.readFileSync('src/components/studio/bpm/panels/TriggerPropertiesPanel.tsx', 'utf8').split('\n');
while(trig[trig.length-1].trim() === '' || trig[trig.length-1].trim() === '}' || trig[trig.length-1].trim() === ');' || trig[trig.length-1].trim() === '</>' || trig[trig.length-1].trim() === '})()}' || trig[trig.length-1].trim() === ')}') {
  trig.pop();
}
trig.push('    </>');
trig.push('  );');
trig.push('}');
fs.writeFileSync('src/components/studio/bpm/panels/TriggerPropertiesPanel.tsx', trig.join('\n'));

console.log('Fixed syntax errors.');
