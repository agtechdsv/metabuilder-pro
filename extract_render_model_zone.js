const fs = require('fs');
const path = require('path');

const srcPath = path.join('src', 'components', 'studio', 'UseCaseBuilder', 'steps', 'StepLayout', 'index.tsx');
const lines = fs.readFileSync(srcPath, 'utf8').split('\n');

const start = lines.findIndex(l => l.includes('const renderModelZone ='));
let end = -1;
let braces = 0;
for(let i=start; i<lines.length; i++) {
  const line = lines[i];
  braces += (line.match(/\\{/g) || []).length;
  braces -= (line.match(/\\}/g) || []).length;
  if(braces === 0 && i > start) {
    end = i;
    break;
  }
}

const componentBody = lines.slice(start + 1, end).join('\n');

const imports = "import React from 'react';\\n" +
"import { Settings2, EyeOff, Eye, ChevronDown, ChevronUp, Plus, Maximize2, Layout } from 'lucide-react';\\n" +
"import { cn } from '@/lib/utils';\\n" +
"import { DroppableZone, SortableFieldChip } from './dnd';\\n" +
"import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';\\n" +
"import { getModelsWithRelations } from '@/lib/relationPathFinder';\\n\\n";

const interfaceProps = "export interface StepLayoutModelZoneProps {\\n" +
"  model: any;\\n" +
"  depth?: number;\\n" +
"  index?: number;\\n" +
"  config: any;\\n" +
"  setConfig: (config: any) => void;\\n" +
"  models: any[];\\n" +
"  relations: any[];\\n" +
"  hiddenDetails: Set<string>;\\n" +
"  setHiddenDetails: React.Dispatch<React.SetStateAction<Set<string>>>;\\n" +
"  retractedModels: Set<string>;\\n" +
"  setRetractedModels: React.Dispatch<React.SetStateAction<Set<string>>>;\\n" +
"  setEditingFieldId: (id: string | null) => void;\\n" +
"  setEditingTabId: (id: string | null) => void;\\n" +
"  setEditingFieldZone: (zone: string | null) => void;\\n" +
"  setDrawerActiveTab: (tab: 'geral' | 'estilos' | 'logica') => void;\\n" +
"  setIsDrawerOpen: (isOpen: boolean) => void;\\n" +
"  toggleField: (fieldId: string, zone: string) => void;\\n" +
"  getFieldMeta: (fid: string, zone?: string | null) => any;\\n" +
"  getFieldName: (id: string) => string;\\n" +
"  t: (key: string, defaultText?: string) => string;\\n" +
"}\\n\\n";

const funcStart = "export function StepLayoutModelZone(props: StepLayoutModelZoneProps) {\\n" +
"  const {\\n" +
"    model, depth = 0, index = 0,\\n" +
"    config, setConfig, models, relations,\\n" +
"    hiddenDetails, setHiddenDetails,\\n" +
"    retractedModels, setRetractedModels,\\n" +
"    setEditingFieldId, setEditingTabId, setEditingFieldZone, setDrawerActiveTab, setIsDrawerOpen,\\n" +
"    toggleField, getFieldMeta, getFieldName, t\\n" +
"  } = props;\\n\\n";

const replacementStr = '<StepLayoutModelZone key={child.id || cIdx} model={child} depth={depth + 1} index={cIdx} config={config} setConfig={setConfig} models={models} relations={relations} hiddenDetails={hiddenDetails} setHiddenDetails={setHiddenDetails} retractedModels={retractedModels} setRetractedModels={setRetractedModels} setEditingFieldId={setEditingFieldId} setEditingTabId={setEditingTabId} setEditingFieldZone={setEditingFieldZone} setDrawerActiveTab={setDrawerActiveTab} setIsDrawerOpen={setIsDrawerOpen} toggleField={toggleField} getFieldMeta={getFieldMeta} getFieldName={getFieldName} t={t} />';
const funcBody = componentBody.replace(/renderModelZone\(child, depth \+ 1, cIdx\)/g, replacementStr);

const componentContent = imports + interfaceProps + funcStart + funcBody + "\\n}\\n";

fs.writeFileSync(path.join('src', 'components', 'studio', 'UseCaseBuilder', 'steps', 'StepLayout', 'StepLayoutModelZone.tsx'), componentContent);
console.log('Created StepLayoutModelZone.tsx');

// Modify index.tsx to remove renderModelZone
const exclude = new Set();
for(let i=start; i<=end; i++) exclude.add(i);

const newLines = lines.filter((_, i) => !exclude.has(i));
let indexContent = newLines.join('\n');

indexContent = indexContent.replace(
  "import { DroppableZone, SortableFieldChip, DraggableItem, SortableWidgetCard, DraggableFieldCard, DraggableTableHeader } from './dnd'", 
  "import { DroppableZone, SortableFieldChip, DraggableItem, SortableWidgetCard, DraggableFieldCard, DraggableTableHeader } from './dnd'\\nimport { StepLayoutModelZone } from './StepLayoutModelZone'"
);

indexContent = indexContent.replace(
  "renderModelZone={renderModelZone}", 
  "relations={relations}\\n              hiddenDetails={hiddenDetails}\\n              setHiddenDetails={setHiddenDetails}\\n              retractedModels={retractedModels}\\n              setRetractedModels={setRetractedModels}\\n              setEditingTabId={setEditingTabId}\\n              setDrawerActiveTab={setDrawerActiveTab}"
);

fs.writeFileSync(srcPath, indexContent);
console.log('Modified index.tsx');

// Update FieldZones.tsx
const fzPath = path.join('src', 'components', 'studio', 'UseCaseBuilder', 'steps', 'StepLayout', 'FieldZones.tsx');
let fzContent = fs.readFileSync(fzPath, 'utf8');

fzContent = fzContent.replace(
  "import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'",
  "import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'\\nimport { StepLayoutModelZone } from './StepLayoutModelZone'"
);

// Add missing props to FieldZones
fzContent = fzContent.replace(
  "config, setConfig, models, toggleZone, hiddenZones, setHiddenZones, expandedZones, t, toggleField, setEditingFieldId, setEditingFieldZone, setIsDrawerOpen, getFieldMeta, getFieldName, formTree, renderModelZone",
  "config, setConfig, models, toggleZone, hiddenZones, setHiddenZones, expandedZones, t, toggleField, setEditingFieldId, setEditingFieldZone, setIsDrawerOpen, getFieldMeta, getFieldName, formTree, relations, hiddenDetails, setHiddenDetails, retractedModels, setRetractedModels, setEditingTabId, setDrawerActiveTab"
);

const renderNodeReplacement = "<StepLayoutModelZone key={node.id || nIdx} model={node} depth={0} index={nIdx} config={config} setConfig={setConfig} models={models} relations={relations} hiddenDetails={hiddenDetails} setHiddenDetails={setHiddenDetails} retractedModels={retractedModels} setRetractedModels={setRetractedModels} setEditingFieldId={setEditingFieldId} setEditingTabId={setEditingTabId} setEditingFieldZone={setEditingFieldZone} setDrawerActiveTab={setDrawerActiveTab} setIsDrawerOpen={setIsDrawerOpen} toggleField={toggleField} getFieldMeta={getFieldMeta} getFieldName={getFieldName} t={t} />";
fzContent = fzContent.replace(
  /formTree\.map\(\(node: any, nIdx: number\) => renderModelZone\(node, 0, nIdx\)\)/g,
  "formTree.map((node: any, nIdx: number) => " + renderNodeReplacement + ")"
);

fs.writeFileSync(fzPath, fzContent);
console.log('Modified FieldZones.tsx');
