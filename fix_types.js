const fs = require('fs');

// 1. Fix BpmModals.tsx
let modals = fs.readFileSync('src/components/studio/bpm/modals/BpmModals.tsx', 'utf8');
modals = modals.replace('import RichTextEditor from "../../RichTextEditor";', 'import RichTextEditor from "../RichTextEditor";');
modals = modals.replace(/\(u\)/g, '(u: any)');
modals = modals.replace(/\(prev\)/g, '(prev: any)');
modals = modals.replace(/\(f\)/g, '(f: any)');
modals = modals.replace(/\(val\)/g, '(val: any)');
fs.writeFileSync('src/components/studio/bpm/modals/BpmModals.tsx', modals);

// 2. Fix ActionPropertiesPanel.tsx
let action = fs.readFileSync('src/components/studio/bpm/panels/ActionPropertiesPanel.tsx', 'utf8');
action = action.replace(
  'renderActionFilters, t, enums } = props;',
  'renderActionFilters, t, enums, cursorPos } = props;'
);
action = action.replace(/\(m\)/g, '(m: any)');
action = action.replace(/\(f\)/g, '(f: any)');
action = action.replace(/\(en\)/g, '(en: any)');
action = action.replace(/\(e\)/g, '(e: any)');
action = action.replace(/\(grupo\)/g, '(grupo: any)');
fs.writeFileSync('src/components/studio/bpm/panels/ActionPropertiesPanel.tsx', action);

// 3. Fix ConditionPropertiesPanel.tsx
let cond = fs.readFileSync('src/components/studio/bpm/panels/ConditionPropertiesPanel.tsx', 'utf8');
cond = cond.replace(/\(m\)/g, '(m: any)');
cond = cond.replace(/\(f\)/g, '(f: any)');
cond = cond.replace(/\(en\)/g, '(en: any)');
cond = cond.replace(/\(e\)/g, '(e: any)');
fs.writeFileSync('src/components/studio/bpm/panels/ConditionPropertiesPanel.tsx', cond);

// 4. Fix TriggerPropertiesPanel.tsx
let trig = fs.readFileSync('src/components/studio/bpm/panels/TriggerPropertiesPanel.tsx', 'utf8');
trig = trig.replace(/\(m\)/g, '(m: any)');
trig = trig.replace(/\(f\)/g, '(f: any)');
trig = trig.replace(/\(v\)/g, '(v: any)');
trig = trig.replace(/\(uc\)/g, '(uc: any)');
fs.writeFileSync('src/components/studio/bpm/panels/TriggerPropertiesPanel.tsx', trig);

// 5. Update BpmNodePropertiesSidebar.tsx to pass cursorPos
let sidebar = fs.readFileSync('src/components/studio/bpm/BpmNodePropertiesSidebar.tsx', 'utf8');
sidebar = sidebar.replace(
  'setTempEmailData={setTempEmailData}',
  'setTempEmailData={setTempEmailData}\n                cursorPos={props.cursorPos}'
);
fs.writeFileSync('src/components/studio/bpm/BpmNodePropertiesSidebar.tsx', sidebar);

console.log('Fixed implicit anys and props.');
