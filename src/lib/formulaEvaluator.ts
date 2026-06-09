type FormulaToken = {
  id: string;
  type: 'operator' | 'field' | 'function' | 'number' | 'string';
  value: string;
  label: string;
};

// Helper to parse masked numbers (e.g. "1.350,00" -> 1350.00)
const parseNumericString = (val: any) => {
  if (typeof val === 'string') {
    if (val.match(/^[\d.,]+$/) && val.includes(',')) {
      const clean = val.replace(/\./g, '').replace(',', '.');
      return Number(clean);
    }
  }
  return Number(val);
};

// Safe evaluator using Function constructor with bound variables
const evaluateExpression = (expr: string, context: Record<string, any>) => {
  try {
    const fn = new Function(...Object.keys(context), `return ${expr}`);
    const result = fn(...Object.values(context));
    console.log('[MetaBuilder] Formula Evaluated:', { expr, context, result });
    return result;
  } catch (error: any) {
    console.warn("Formula Evaluation Incomplete/Invalid:", expr, error);
    return undefined;
  }
};

export const evaluateFormula = (
  tokens: FormulaToken[], 
  formData: Record<string, any>, 
  detailsData: Record<string, any[]>,
  currentRow?: any,
  currentTableName?: string
): any => {
  if (!tokens || tokens.length === 0) return null;

  let expression = '';
  const context: Record<string, any> = {};
  let contextIdx = 0;

  // Helpers for grouping functions
  context['SOMA'] = (arr: any[]) => Array.isArray(arr) ? arr.reduce((a, b) => Number(a || 0) + Number(b || 0), 0) : 0;
  context['MEDIA'] = (arr: any[]) => Array.isArray(arr) && arr.length ? context['SOMA'](arr) / arr.length : 0;
  context['COUNT'] = (arr: any[]) => Array.isArray(arr) ? arr.length : 0;
  context['MAXIMO'] = (arr: any[]) => Array.isArray(arr) && arr.length ? Math.max(...arr.map(v => Number(v) || 0)) : 0;
  context['MINIMO'] = (arr: any[]) => Array.isArray(arr) && arr.length ? Math.min(...arr.map(v => Number(v) || 0)) : 0;
  context['ARREDONDAR'] = (val: any) => Math.round(Number(val) || 0);
  context['ABS'] = (val: any) => Math.abs(Number(val) || 0);
  context['SE'] = (cond: boolean, trueVal: any, falseVal: any) => cond ? trueVal : falseVal;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type === 'operator' || token.type === 'number') {
      expression += ` ${token.value} `;
    } else if (token.type === 'string') {
      expression += ` "${token.value.replace(/"/g, '\\"')}" `;
    } else if (token.type === 'function') {
      expression += ` ${token.value}`;
    } else if (token.type === 'field') {
      const fieldPath = token.value; // e.g. "valor_frete" or "itens_pedido.subtotal"
      
      const varName = `var_${contextIdx++}`;
      expression += ` ${varName} `;

      if (currentRow && currentTableName && fieldPath.startsWith(`${currentTableName}.`)) {
        // We are evaluating a detail row's formula, and accessing a column from the SAME row
        const colName = fieldPath.split('.')[1];
        const val = currentRow[colName];
        const numVal = parseNumericString(val);
        context[varName] = val === '' || val === null || val === undefined ? 0 : (isNaN(numVal) ? val : numVal);
      } else if (formData[fieldPath] !== undefined) {
        const val = formData[fieldPath];
        const numVal = parseNumericString(val);
        context[varName] = val === '' || val === null || val === undefined ? 0 : (isNaN(numVal) ? val : numVal);
      } else if (fieldPath.includes('.')) {
        // It's a relational detail field (e.g., itens_pedido.subtotal)
        const [tableName, colName] = fieldPath.split('.');
        const childRows = detailsData[tableName] || [];
        // Map the array of values so grouping functions (like SOMA) can receive it
        context[varName] = childRows.map((row: any) => {
          const val = row[colName];
          const numVal = parseNumericString(val);
          return val === '' || val === null || val === undefined ? 0 : (isNaN(numVal) ? val : numVal);
        });
      } else {
        // It's a main form field
        const val = formData[fieldPath];
        const numVal = parseNumericString(val);
        context[varName] = val === '' || val === null || val === undefined ? 0 : (isNaN(numVal) ? val : numVal);
      }
    }
  }

  // Handle commas for function arguments, they are added as operator ','
  expression = expression.replace(/ , /g, ',');
  
  // Replace single equal signs with strict equality (so users can type '=' but JS evaluates '===')
  // We need to be careful not to replace >= or <= or ===
  expression = expression.replace(/([^<>=!])=([^=])/g, '$1===$2');

  console.log('[MetaBuilder] Formula Evaluator:', {
    expression,
    context
  });

  return evaluateExpression(expression, context);
};
