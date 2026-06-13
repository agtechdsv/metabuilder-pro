import React, { useState } from 'react'
import { Plus, X, Calculator, Database, FunctionSquare, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'

export type FormulaToken = {
  id: string;
  type: 'operator' | 'field' | 'function' | 'number' | 'string';
  value: string;
  label: string;
}

interface FormulaBuilderProps {
  value: FormulaToken[];
  onChange: (tokens: FormulaToken[]) => void;
  availableFields: Array<{
    id: string;
    modelName: string;
    db_column_name: string;
    display_name: string;
    isRelation?: boolean;
  }>;
}

export default function FormulaBuilder({ value = [], onChange, availableFields = [] }: FormulaBuilderProps) {
  const [numberInput, setNumberInput] = useState('')

  const addToken = (type: FormulaToken['type'], val: string, label: string) => {
    const uniqueId = Math.random().toString(36).substring(2, 10);
    onChange([...value, { id: uniqueId, type, value: val, label }])
  }

  const removeToken = (id: string) => {
    onChange(value.filter(t => t.id !== id))
  }

  const operators = [
    { val: '+', label: '+' },
    { val: '-', label: '-' },
    { val: '*', label: '×' },
    { val: '/', label: '÷' },
    { val: '(', label: '(' },
    { val: ')', label: ')' },
    { val: '=', label: '=' },
    { val: '!=', label: '≠' },
    { val: '>', label: '>' },
    { val: '<', label: '<' },
    { val: ',', label: ',' },
  ]

  const functions = [
    { val: 'SOMA', label: 'SOMA' },
    { val: 'MEDIA', label: 'MÉDIA' },
    { val: 'COUNT', label: 'CONTAGEM' },
    { val: 'MAXIMO', label: 'MÁXIMO' },
    { val: 'MINIMO', label: 'MÍNIMO' },
    { val: 'ARREDONDAR', label: 'ARREDONDAR' },
    { val: 'ABS', label: 'ABS' },
    { val: 'SE', label: 'SE' }
  ]

  const getTokenColor = (type: string) => {
    switch (type) {
      case 'operator': return 'bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-bold border border-neutral-300 dark:border-neutral-700'
      case 'field': return 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
      case 'function': return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold'
      case 'number': return 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-mono'
      case 'string': return 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-mono'
      default: return 'bg-neutral-100 text-neutral-700'
    }
  }

  // Ghost Validator: Tests the formula syntax in real-time
  const isSyntaxValid = React.useMemo(() => {
    if (value.length === 0) return true;
    
    let expr = '';
    let varIdx = 0;
    value.forEach(t => {
      if (t.type === 'operator' || t.type === 'number') expr += ` ${t.value} `;
      else if (t.type === 'string') expr += ` "${t.value.replace(/"/g, '\\"')}" `;
      else if (t.type === 'function') expr += ` ${t.value} `;
      else if (t.type === 'field') expr += ` var_${varIdx++} `;
    });

    expr = expr.replace(/ , /g, ',');
    expr = expr.replace(/([^<>=!])=([^=])/g, '$1===$2');

    const context: any = {
      'SOMA': () => 1, 'MEDIA': () => 1, 'COUNT': () => 1, 'MAXIMO': () => 1, 
      'MINIMO': () => 1, 'ARREDONDAR': () => 1, 'ABS': () => 1, 'SE': () => 1
    };
    for(let i=0; i<varIdx; i++) context[`var_${i}`] = 1;

    try {
      const keys = Object.keys(context);
      const values = Object.values(context);
      // eslint-disable-next-line no-new-func
      const fn = new Function(...keys, `return ${expr}`);
      fn(...values);
      return true;
    } catch (e) {
      return false; // Syntax Error or Type Error caught
    }
  }, [value]);

  return (
    <div className="flex flex-col gap-4">
      {/* Quadro Negro (Display) */}
      <div className="relative min-h-[120px] p-4 pr-20 bg-white dark:bg-neutral-950 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl flex flex-wrap gap-2 items-start content-start shadow-inner">
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="absolute top-2 right-2 p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
            title="Limpar toda a fórmula"
          >
            <X className="w-3.5 h-3.5" /> Limpar
          </button>
        )}
        
        {value.length === 0 ? (
          <span className="text-xs text-neutral-400 italic mt-1">A fórmula está vazia. Adicione campos e operadores abaixo.</span>
        ) : (
          value.map((token) => (
            <div 
              key={token.id} 
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition-all group cursor-default",
                getTokenColor(token.type)
              )}
            >
              <span>{token.label}</span>
              <button 
                type="button"
                onClick={() => removeToken(token.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-all"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Warning Alerts */}
      {value.filter(t => t.value === '(').length !== value.filter(t => t.value === ')').length && (
        <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-700 dark:text-amber-400 text-xs font-medium flex items-center gap-2 shadow-sm">
          <span className="text-lg leading-none">⚠️</span>
          Aviso: Há parênteses abertos que não foram fechados corretamente.
        </div>
      )}

      {!isSyntaxValid && value.length > 0 && (
        <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-xs font-medium flex items-center gap-2 shadow-sm">
          <span className="text-lg leading-none">🚨</span>
          Erro de Sintaxe: A estrutura matemática da fórmula é inválida. Verifique a ordem dos operadores e funções.
        </div>
      )}

      {/* Barra de Ferramentas */}
      <div className="grid grid-cols-1 gap-4">
        
        {/* Operadores e Funções */}
        <div className="flex flex-col gap-2 p-3 bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-xl">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-neutral-500 tracking-wider mb-1">
            <Calculator className="w-3.5 h-3.5" /> Matemáticos & Lógicos
          </div>
          <div className="flex flex-wrap gap-1.5">
            {operators.map(op => (
              <button
                key={op.val}
                type="button"
                onClick={() => addToken('operator', op.val, op.label)}
                className="w-8 h-8 flex items-center justify-center bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs font-bold hover:border-indigo-500 hover:text-indigo-600 transition-colors shadow-sm"
              >
                {op.label}
              </button>
            ))}
          </div>

          <div className="w-full h-px bg-neutral-200 dark:bg-neutral-800 my-1" />

          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-500 tracking-wider mb-1">
            <FunctionSquare className="w-3.5 h-3.5" /> Funções
          </div>
          <div className="flex flex-wrap gap-1.5">
            {functions.map(fn => (
              <button
                key={fn.val}
                type="button"
                onClick={() => {
                  const id1 = Math.random().toString(36).substring(2, 10);
                  const id2 = Math.random().toString(36).substring(2, 10);
                  onChange([
                    ...value,
                    { id: id1, type: 'function', value: fn.val, label: fn.label },
                    { id: id2, type: 'operator', value: '(', label: '(' }
                  ]);
                }}
                className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 transition-colors shadow-sm"
              >
                {fn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Variáveis e Números */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 p-3 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-xl">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider mb-1">
              <Database className="w-3.5 h-3.5" /> Inserir Campo
            </div>
            <select
              className="w-full px-3 py-2 bg-white dark:bg-neutral-950 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs outline-none focus:ring-2 ring-indigo-500/50"
              onChange={(e) => {
                if (!e.target.value) return;
                const field = availableFields.find(f => f.id === e.target.value);
                if (field) {
                  addToken('field', field.db_column_name, `[${field.modelName}] ${field.display_name || field.db_column_name}`);
                }
                e.target.value = ''; // reset after insert
              }}
            >
              <option value="">Selecione para inserir...</option>
              
              {availableFields.some(f => (f as any).isVirtual) && (
                <optgroup label="Campos Calculados" className="font-bold text-indigo-600 dark:text-indigo-400">
                  {availableFields.filter(f => (f as any).isVirtual).map(f => (
                    <option key={f.id} value={f.id} className="text-neutral-700 dark:text-neutral-300 font-normal">
                      {f.modelName} → {f.display_name || f.db_column_name}
                    </option>
                  ))}
                </optgroup>
              )}

              {Object.entries(
                availableFields.filter(f => !(f as any).isVirtual).reduce((acc: any, f) => {
                  if (!acc[f.modelName]) acc[f.modelName] = [];
                  acc[f.modelName].push(f);
                  return acc;
                }, {})
              ).map(([modelName, fields]: [string, any]) => (
                <optgroup key={modelName} label={modelName.startsWith('Tabela:') || modelName.startsWith('Relação:') ? modelName : `Tabela: ${modelName}`} className="font-bold text-emerald-600 dark:text-emerald-400">
                  {fields.map((f: any) => (
                    <option key={f.id} value={f.id} className="text-neutral-700 dark:text-neutral-300 font-normal">
                      {f.display_name || f.db_column_name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2 p-3 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 rounded-xl">
            <label className="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider flex items-center gap-1">
              <Hash className="w-3 h-3" /> VALOR LIVRE
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-neutral-900 border border-amber-200 dark:border-amber-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                placeholder="Ex: 100 ou Cancelado"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value) {
                    const val = e.currentTarget.value.trim();
                    const isNum = !isNaN(Number(val)) && val !== '';
                    addToken(isNum ? 'number' : 'string', val, val);
                    e.currentTarget.value = '';
                  }
                }}
              />
              <button
                type="button"
                onClick={(e) => {
                  const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                  if (input.value) {
                    const val = input.value.trim();
                    const isNum = !isNaN(Number(val)) && val !== '';
                    addToken(isNum ? 'number' : 'string', val, val);
                    input.value = '';
                  }
                }}
                className="px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm font-bold rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
              >
                +
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
