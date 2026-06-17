const fs = require('fs');

const renderFieldBodyFull = fs.readFileSync('field.txt', 'utf8');
const renderFieldLines = renderFieldBodyFull.split('\n');
renderFieldLines.shift(); // remove const renderField = ...
renderFieldLines.pop(); // remove }
const fieldBody = renderFieldLines.join('\n');

const componentFieldContent = `import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FileUploaderInput } from '@/components/runtime/FileUploaderInput';
import { getActionContexts, getActionGroupFields } from '@/lib/customActionsHelper';
import {
  getCaseInsensitiveValue,
  getActionIcon,
  getFontFamily,
  getFontSize,
  applyMask,
  parseMaskedNumber,
  getActionColorClasses,
  parseFixedOptions
} from './RecordFormUtils';

interface RecordFormFieldProps {
  field: any;
  formData: any;
  setFormData: (data: any) => void;
  mode: 'create' | 'edit' | 'view';
  relationalOptions: Record<string, any[]>;
  customActions?: any[];
  onCustomAction?: (action: any, context?: any) => void;
  buildActionContext: (masterData: any, parentData?: any, parentTableName?: string, detailData?: any, detailTableName?: string) => any;
  project?: any;
  masterModelId?: string;
  masterModelName?: string;
  logicType?: string;
  t: (key: string, defaultText?: string) => string;
}

export function RecordFormField(props: RecordFormFieldProps) {
  const {
    field,
    formData,
    setFormData,
    mode,
    relationalOptions,
    customActions = [],
    onCustomAction,
    buildActionContext,
    project,
    masterModelId,
    masterModelName,
    logicType,
    t
  } = props;

${fieldBody}
}
`;
fs.writeFileSync('src/components/runtime/record-form/RecordFormField.tsx', componentFieldContent);

const renderDetailBodyFull = fs.readFileSync('detail.txt', 'utf8');
const renderDetailLines = renderDetailBodyFull.split('\n');
renderDetailLines.shift(); // remove const renderDetailSection = ...
renderDetailLines.pop(); // remove }
let detailBody = renderDetailLines.join('\n');

// Replace recursive call
detailBody = detailBody.replace(/renderDetailSection\(st, detail, \(([\s\S]*?)\)\)/g, 
  `<RecordFormDetailSection 
    tableName={st} 
    parentData={detail} 
    titleNode={($1)} 
    expandedDetails={expandedDetails}
    setExpandedDetails={setExpandedDetails}
    loadingSubDetails={loadingSubDetails}
    setLoadingSubDetails={setLoadingSubDetails}
    fetchSubDetailsForRecord={fetchSubDetailsForRecord}
    formData={formData}
    setFormData={setFormData}
    fields={fields}
    customActions={customActions}
    onCustomAction={onCustomAction}
    relationalOptions={relationalOptions}
    project={project}
    detailsInterfaceTypes={detailsInterfaceTypes}
    detailsTabTitles={detailsTabTitles}
    dictionary={dictionary}
    detailsItemTitles={detailsItemTitles}
    onAddDetail={onAddDetail}
    onEditDetail={onEditDetail}
    onDeleteDetail={onDeleteDetail}
    buildActionContext={buildActionContext}
    tabsStyleConfig={tabsStyleConfig}
    t={t}
    mode={mode}
  />`
);

const componentDetailContent = `import React from 'react';
import { Loader2, Pencil, Plus, Trash2, ChevronDown, ChevronUp, PanelRight, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getActionContexts } from '@/lib/customActionsHelper';
import { getActionIcon, getActionColorClasses, getFontFamily, getFontSize, applyMask, parseMaskedNumber, parseFixedOptions } from './RecordFormUtils';
import { RecordFormField } from './RecordFormField';

interface RecordFormDetailSectionProps {
  tableName: string;
  parentData?: any;
  titleNode?: any;
  hideToolbar?: boolean;
  expandedDetails: any;
  setExpandedDetails: (val: any) => void;
  loadingSubDetails: any;
  setLoadingSubDetails: (val: any) => void;
  fetchSubDetailsForRecord: (record: any, table: string, pkCol: string, pkVal: any) => Promise<any>;
  formData: any;
  setFormData: (val: any) => void;
  fields: any[];
  customActions?: any[];
  onCustomAction?: (action: any, context?: any) => void;
  relationalOptions: Record<string, any[]>;
  project?: any;
  detailsInterfaceTypes: Record<string, string>;
  detailsTabTitles?: Record<string, string>;
  dictionary?: Record<string, string>;
  detailsItemTitles?: Record<string, string>;
  onAddDetail?: (tableName: string, parentId?: any) => void;
  onEditDetail?: (detail: any) => void;
  onDeleteDetail?: (detail: any) => void;
  buildActionContext: (masterData: any, parentData?: any, parentTableName?: string, detailData?: any, detailTableName?: string) => any;
  tabsStyleConfig?: any;
  t: (key: string, defaultText?: string) => string;
  mode: 'create' | 'edit' | 'view';
}

export function RecordFormDetailSection(props: RecordFormDetailSectionProps) {
  const {
    tableName,
    parentData = props.formData,
    titleNode,
    hideToolbar,
    expandedDetails,
    setExpandedDetails,
    loadingSubDetails,
    setLoadingSubDetails,
    fetchSubDetailsForRecord,
    formData,
    setFormData,
    fields,
    customActions = [],
    onCustomAction,
    relationalOptions,
    project,
    detailsInterfaceTypes = {},
    detailsTabTitles,
    dictionary = {},
    detailsItemTitles,
    onAddDetail,
    onEditDetail,
    onDeleteDetail,
    buildActionContext,
    tabsStyleConfig,
    t,
    mode
  } = props;

${detailBody}
}
`;
fs.writeFileSync('src/components/runtime/record-form/RecordFormDetailSection.tsx', componentDetailContent);

// NOW CLEANUP RecordForm.tsx
let content = fs.readFileSync('src/components/runtime/RecordForm.tsx', 'utf8');

// Replace util functions with imports. We know the exact start and end.
const utilStart = content.indexOf('// Helper para obter valores de forma insensível');
const utilEnd = content.indexOf('export default function RecordForm({');
const imports = `import { RecordFormField } from './record-form/RecordFormField';
import { RecordFormDetailSection } from './record-form/RecordFormDetailSection';
import { 
  getCaseInsensitiveValue, 
  getActionIcon, 
  getFontFamily, 
  getFontSize, 
  applyMask, 
  parseMaskedNumber, 
  getActionColorClasses, 
  getBulkActionClasses,
  parseFixedOptions
} from './record-form/RecordFormUtils';

`;

content = content.substring(0, utilStart) + imports + content.substring(utilEnd);

// Replace renderField and renderDetailSection with nothing
const renderFieldStart = content.indexOf('  const renderField = (field: any) => {');
const renderDetailEnd = content.indexOf('\n    )\n  }\n\n  return (', renderFieldStart) + '\n    )\n  }'.length;

content = content.substring(0, renderFieldStart) + content.substring(renderDetailEnd);

// Also there's a stray `parseFixedOptions` inside RecordForm.tsx around line 346.
// `const parseFixedOptions = (str: string) => { ... };` Let's replace it.
content = content.replace(/  const parseFixedOptions = \(str: string\) => \{[\s\S]*?  \};\n\n/g, '');

// Replace JSX Calls
content = content.replace(/renderField\(([^)]+)\)/g, `<RecordFormField 
  field={$1}
  formData={formData}
  setFormData={setFormData}
  mode={mode}
  relationalOptions={relationalOptions}
  customActions={customActions}
  onCustomAction={onCustomAction}
  buildActionContext={buildActionContext}
  project={project}
  masterModelId={masterModelId}
  masterModelName={masterModelName}
  logicType={logicType}
  t={t}
/>`);

content = content.replace(/\{renderDetailSection\(tableName, formData, \(([\s\S]*?)\)\)\}/g, 
  `<RecordFormDetailSection 
    tableName={tableName} 
    parentData={formData} 
    titleNode={($1)} 
    expandedDetails={expandedDetails}
    setExpandedDetails={setExpandedDetails}
    loadingSubDetails={loadingSubDetails}
    setLoadingSubDetails={setLoadingSubDetails}
    fetchSubDetailsForRecord={fetchSubDetailsForRecord}
    formData={formData}
    setFormData={setFormData}
    fields={fields}
    customActions={customActions}
    onCustomAction={onCustomAction}
    relationalOptions={relationalOptions}
    project={project}
    detailsInterfaceTypes={detailsInterfaceTypes || {}}
    detailsTabTitles={detailsTabTitles}
    dictionary={dictionary}
    detailsItemTitles={detailsItemTitles}
    onAddDetail={onAddDetail}
    onEditDetail={onEditDetail}
    onDeleteDetail={onDeleteDetail}
    buildActionContext={buildActionContext}
    tabsStyleConfig={tabsStyleConfig}
    t={t}
    mode={mode}
  />`
);

content = content.replace(/renderDetailSection\(activeTab, formData, undefined, true\)/g, 
  `<RecordFormDetailSection 
    tableName={activeTab} 
    parentData={formData} 
    hideToolbar={true} 
    expandedDetails={expandedDetails}
    setExpandedDetails={setExpandedDetails}
    loadingSubDetails={loadingSubDetails}
    setLoadingSubDetails={setLoadingSubDetails}
    fetchSubDetailsForRecord={fetchSubDetailsForRecord}
    formData={formData}
    setFormData={setFormData}
    fields={fields}
    customActions={customActions}
    onCustomAction={onCustomAction}
    relationalOptions={relationalOptions}
    project={project}
    detailsInterfaceTypes={detailsInterfaceTypes || {}}
    detailsTabTitles={detailsTabTitles}
    dictionary={dictionary}
    detailsItemTitles={detailsItemTitles}
    onAddDetail={onAddDetail}
    onEditDetail={onEditDetail}
    onDeleteDetail={onDeleteDetail}
    buildActionContext={buildActionContext}
    tabsStyleConfig={tabsStyleConfig}
    t={t}
    mode={mode}
  />`
);

content = content.replace(/\{renderOnlyDetail && renderDetailSection\(renderOnlyDetail\)\}/g, 
  `{renderOnlyDetail && <RecordFormDetailSection 
    tableName={renderOnlyDetail} 
    parentData={formData} 
    expandedDetails={expandedDetails}
    setExpandedDetails={setExpandedDetails}
    loadingSubDetails={loadingSubDetails}
    setLoadingSubDetails={setLoadingSubDetails}
    fetchSubDetailsForRecord={fetchSubDetailsForRecord}
    formData={formData}
    setFormData={setFormData}
    fields={fields}
    customActions={customActions}
    onCustomAction={onCustomAction}
    relationalOptions={relationalOptions}
    project={project}
    detailsInterfaceTypes={detailsInterfaceTypes || {}}
    detailsTabTitles={detailsTabTitles}
    dictionary={dictionary}
    detailsItemTitles={detailsItemTitles}
    onAddDetail={onAddDetail}
    onEditDetail={onEditDetail}
    onDeleteDetail={onDeleteDetail}
    buildActionContext={buildActionContext}
    tabsStyleConfig={tabsStyleConfig}
    t={t}
    mode={mode}
  />}`
);

fs.writeFileSync('src/components/runtime/RecordForm.tsx', content);
console.log('Successfully written components correctly!');
