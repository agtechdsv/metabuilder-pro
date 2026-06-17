const fs = require('fs');

const recordFormPath = 'src/components/runtime/RecordForm.tsx';
const fieldPath = 'src/components/runtime/record-form/RecordFormField.tsx';

let content = fs.readFileSync(recordFormPath, 'utf8');

const fieldStart = content.indexOf('  const renderField = (field: any) => {');
if (fieldStart === -1) {
  console.log('Could not find renderField start');
  process.exit(1);
}

// Find the end of renderField (it ends with "  }\n\n  const renderDetailSection")
const fieldEndMatch = '\n  }\n\n  const renderDetailSection';
const fieldEnd = content.indexOf(fieldEndMatch, fieldStart);

if (fieldEnd === -1) {
  console.log('Could not find renderField end');
  process.exit(1);
}

let renderFieldBody = content.substring(fieldStart, fieldEnd + 4);

// Replace "const renderField = (field: any) => {" with component definition
let componentContent = `import React from 'react';
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

`;

// Extract the body inside `const renderField = ... {`
// Let's strip the `  const renderField = (field: any) => {\n` and `  }\n`
let bodyCode = renderFieldBody.replace('  const renderField = (field: any) => {\n', '');
bodyCode = bodyCode.substring(0, bodyCode.lastIndexOf('  }'));

componentContent += bodyCode;
componentContent += `\n}\n`;

fs.writeFileSync(fieldPath, componentContent);
console.log('Created RecordFormField.tsx');
