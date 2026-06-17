const fs = require('fs');

const recordFormPath = 'src/components/runtime/RecordForm.tsx';
let content = fs.readFileSync(recordFormPath, 'utf8');

// --- EXTRACT RecordFormField ---
const fieldStartStr = '  const renderField = (field: any) => {';
const fieldStart = content.indexOf(fieldStartStr);
const fieldEndStr = '\n    )\n  }\n\n  const renderDetailSection';
const fieldEnd = content.indexOf(fieldEndStr, fieldStart);

let fieldBodyCode = content.substring(fieldStart + fieldStartStr.length, fieldEnd + 6);

let componentFieldContent = `import React from 'react';
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
  getActionColorClasses
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
` + fieldBodyCode + `\n}\n`;

fs.writeFileSync('src/components/runtime/record-form/RecordFormField.tsx', componentFieldContent);

// --- EXTRACT RecordFormDetailSection ---
const detailStartStr = '  const renderDetailSection = (tableName: string, parentData: any = formData, titleNode?: any, hideToolbar?: boolean) => {';
const detailStart = content.indexOf(detailStartStr);
const detailEndStr = '\n      </div>\n    )\n  }\n\n  return (';
const detailEnd = content.indexOf(detailEndStr, detailStart);

let detailBodyCode = content.substring(detailStart + detailStartStr.length, detailEnd + 12);

let componentDetailContent = `import React from 'react';
import { Loader2, Pencil, Plus, Trash2, ChevronDown, ChevronUp, PanelRight, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getActionContexts } from '@/lib/customActionsHelper';
import { getActionIcon, getActionColorClasses, getFontFamily, getFontSize, applyMask, parseMaskedNumber } from './RecordFormUtils';
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
    detailsInterfaceTypes,
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
` + detailBodyCode + `\n}\n`;

// Since renderDetailSection is recursive, we must replace calls to `renderDetailSection` with `<RecordFormDetailSection ... />` inside `RecordFormDetailSection.tsx` itself.
componentDetailContent = componentDetailContent.replace(/renderDetailSection\(st, detail, \(([\s\S]*?)\)\)/g, 
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

fs.writeFileSync('src/components/runtime/record-form/RecordFormDetailSection.tsx', componentDetailContent);

// --- MODIFY RecordForm.tsx ---
// Remove utilities
const firstUtilityStart = content.indexOf('const getCaseInsensitiveValue');
const buildActionContextStart = content.indexOf('  const buildActionContext =');
const newTopImports = `import { RecordFormField } from './record-form/RecordFormField';
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
} from './record-form/RecordFormUtils';\n\n`;

const preUtils = content.substring(0, firstUtilityStart);
const postUtils = content.substring(buildActionContextStart);

let newRecordFormContent = preUtils + newTopImports + postUtils;

// Now remove the render functions
const renderFieldStart = newRecordFormContent.indexOf(fieldStartStr);
const renderDetailSectionEnd = newRecordFormContent.indexOf(detailEndStr) + detailEndStr.length;

newRecordFormContent = newRecordFormContent.substring(0, renderFieldStart) + newRecordFormContent.substring(renderDetailSectionEnd);

// Replace renderField() calls
newRecordFormContent = newRecordFormContent.replace(/renderField\(([^)]+)\)/g, `<RecordFormField 
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

fs.writeFileSync('src/components/runtime/RecordForm.tsx', newRecordFormContent);

console.log('Successfully extracted components and updated RecordForm.tsx');
