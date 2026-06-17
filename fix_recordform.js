const fs = require('fs');

let content = fs.readFileSync('src/components/runtime/RecordForm.tsx', 'utf8');

// The original file is a mess because I mutated it in place with wrong indices.
// I will just use regex to strip out the old utilities and the old render methods.
// Actually, it's safer to re-read the original from the file before the mess or just remove them now.

const startUtils = 'const getCaseInsensitiveValue = (data: any, path: string) => {';
const endUtils = 'export default function RecordForm({';

if (content.includes(startUtils)) {
  const s = content.indexOf(startUtils);
  const e = content.indexOf(endUtils);
  content = content.substring(0, s) + content.substring(e);
}

const startRenderField = '  const renderField = (field: any) => {';
const endRenderField = '  const renderDetailSection = (tableName: string, parentData: any = formData, titleNode?: any, hideToolbar?: boolean) => {';

if (content.includes(startRenderField)) {
  const s = content.indexOf(startRenderField);
  const e = content.indexOf(endRenderField);
  content = content.substring(0, s) + content.substring(e);
}

const startRenderDetail = '  const renderDetailSection = (tableName: string, parentData: any = formData, titleNode?: any, hideToolbar?: boolean) => {';
const endRenderDetail = '\n    )\n  }\n\n  return (';

if (content.includes(startRenderDetail)) {
  const s = content.indexOf(startRenderDetail);
  const e = content.indexOf(endRenderDetail) + endRenderDetail.length;
  content = content.substring(0, s) + '  return (';
}

// Replace the JSX calls
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
  />}`
);

// Remove duplicate imports
content = content.replace(/import { RecordFormField } from '\.\/record-form\/RecordFormField';\nimport { RecordFormDetailSection } from '\.\/record-form\/RecordFormDetailSection';\nimport { \n  getCaseInsensitiveValue, \n  getActionIcon, \n  getFontFamily, \n  getFontSize, \n  applyMask, \n  parseMaskedNumber, \n  getActionColorClasses, \n  getBulkActionClasses,\n  parseFixedOptions\n} from '\.\/record-form\/RecordFormUtils';\n\n/g, '');

const finalImports = `import { RecordFormField } from './record-form/RecordFormField';
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

const parts = content.split('import { useRecordFormFormulas } from \'./hooks/useRecordFormFormulas\';\n\n');
if (parts.length > 1) {
  content = parts[0] + 'import { useRecordFormFormulas } from \'./hooks/useRecordFormFormulas\';\n\n' + finalImports + parts[1];
}

fs.writeFileSync('src/components/runtime/RecordForm.tsx', content);

console.log('Fixed RecordForm.tsx');
