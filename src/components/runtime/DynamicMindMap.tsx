"use client"

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import { 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  ArrowLeft,
  Maximize2,
  Loader2,
  Eye,
  Edit,
  Trash2,
  Zap
} from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { formatFieldValue } from '@/lib/formatters'
import DynamicIcon from './DynamicIcon'

interface DynamicMindMapProps {
  data: any[]
  fields: any[]
  centralFieldId?: string
  mindmapLevels?: any[]
  primaryKeyName: string
  projectId?: string
  onView?: (row: any) => void
  onEdit?: (row: any) => void
  onEditLevel?: (levelIndex: number, row: any) => void
  onDelete?: (row: any) => void
  dictionary?: any
  models?: any[]
  project?: any
  tunnelChannel?: any
  isTunnelReady?: boolean
  relationalOptions?: Record<string, any[]>
  customActions?: any[]
  onCustomAction?: (action: any, rowData?: any) => Promise<void>
  refreshTrigger?: number
}

// Componente interno para Tooltip Estilizada (Multi-Tema)
const Tooltip = ({ children, text }: { children: React.ReactNode, text: string }) => {
  const [show, setShow] = useState(false)
  return (
    <div className="relative flex items-center" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, x: 10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 5, scale: 0.95 }}
            className="absolute right-full mr-3 px-3 py-1.5 bg-white/90 dark:bg-slate-900/90 border border-neutral-200 dark:border-white/10 rounded-lg backdrop-blur-xl shadow-2xl pointer-events-none whitespace-nowrap z-[100]"
          >
            <span className="text-[10px] font-bold text-neutral-800 dark:text-white uppercase tracking-wider">{text}</span>
            <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 rotate-45 bg-white dark:bg-slate-900 border-r border-t border-neutral-200 dark:border-white/10" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface MindMapNode {
  id: string;
  name: string;
  desc?: string;
  count: number;
  level: number;
  field?: any; // Para modo Pivot
  rawData?: any;
  children?: MindMapNode[];
  isLoading?: boolean;
}

export default function DynamicMindMap({
  data,
  fields,
  centralFieldId,
  mindmapLevels,
  primaryKeyName,
  projectId,
  onView,
  onEdit,
  onDelete,
  dictionary = {},
  models = [],
  project,
  tunnelChannel,
  isTunnelReady,
  relationalOptions = {},
  customActions = [],
  onCustomAction,
  onEditLevel,
  refreshTrigger
}: DynamicMindMapProps) {
  const { t, language } = useI18n()
  const localeStr = language === 'pt' ? 'pt-BR' : language === 'en' ? 'en-US' : 'es-ES'

  const formatValue = (value: any, fieldName: string, modelId: string | undefined) => {
    if (value === null || value === undefined) return value;
    const model = models.find(m => m.id === modelId);
    if (!model) return value;
    const field = model.fields?.find((f: any) => f.db_column_name === fieldName);
    if (!field) return value;
    return formatFieldValue(value, field, relationalOptions);
  };
  const supabase = createClient()
  const [zoom, setZoom] = useState(1)
  const [currentPath, setCurrentPath] = useState<number[]>([])
  const [loadingPath, setLoadingPath] = useState<string | null>(null)
  const [relationalTree, setRelationalTree] = useState<MindMapNode[]>([])
  const prevRootIdsRef = useRef<string>('');
  const controls = useAnimation()
  
  const isRelational = mindmapLevels && mindmapLevels.length > 0;
  
  // Sincronizar posição e escala
  useEffect(() => {
    controls.start({ 
      x: 0, 
      y: 0, 
      scale: zoom, 
      transition: { type: "spring", stiffness: 120, damping: 25 } 
    })
  }, [currentPath, zoom, controls])

  // 1. Processamento da Árvore (Modo Pivot Antigo)
  const pivotTreeData = useMemo(() => {
    if (isRelational || !data || data.length === 0 || !fields || fields.length === 0) return []
    let hierarchyFields = fields.filter(f => !f.hidden)
    const centralField = fields.find(f => f.id === centralFieldId)
    if (centralField) {
      hierarchyFields = [centralField, ...hierarchyFields.filter(f => f.id !== centralFieldId)]
    }

    const { extractRawValue } = require('@/lib/field-resolver');
    const getValue = (item: any, field: any) => {
      if (!item || !field) return undefined
      return extractRawValue(field.db_column_name, item, field)
    }

    const buildTree = (items: any[], level: number): MindMapNode[] => {
      if (level >= hierarchyFields.length) return []
      const currentField = hierarchyFields[level]
      const groups = new Map<string, any[]>()
      items.forEach(item => {
        const val = getValue(item, currentField)
        const keyStr = val !== undefined && val !== null && val !== '' ? String(val) : 'Unassigned'
        if (!groups.has(keyStr)) groups.set(keyStr, [])
        groups.get(keyStr)!.push(item)
      })
      return Array.from(groups.entries()).map(([name, groupItems], idx) => ({
        id: `lvl${level}-${idx}-${name}`,
        name,
        count: groupItems.length,
        level,
        field: currentField,
        rawData: groupItems[0],
        children: buildTree(groupItems, level + 1)
      }))
    }
    return buildTree(data, 0)
  }, [data, fields, centralFieldId, isRelational])

  // Inicialização do Modo Relacional
  useEffect(() => {
    if (!isRelational || !data || !mindmapLevels) return;
    
    const rootLevel = mindmapLevels[0];
    const uniqueMap = new Map();
    data.forEach((item, idx) => {
      const rawName = rootLevel.title_field ? item[rootLevel.title_field] : (item.name || item.nome || item.title || item.titulo || item.id);
      const name = formatValue(rawName, rootLevel.title_field || '', rootLevel.model_id);
      const rawDesc = rootLevel.desc_field ? item[rootLevel.desc_field] : undefined;
      const desc = rawDesc ? formatValue(rawDesc, rootLevel.desc_field || '', rootLevel.model_id) : undefined;
      
      const pk = primaryKeyName || 'id';
      const rowId = item[pk] !== undefined ? item[pk] : (item[pk.toUpperCase()] !== undefined ? item[pk.toUpperCase()] : (item.id !== undefined ? item.id : item.ID));
      const key = rowId !== undefined ? rowId : `root-${idx}`;
      
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, {
          id: key,
          name: String(name || 'Sem Título'),
          desc: desc ? String(desc) : undefined,
          count: 0,
          level: 0,
          rawData: item,
          children: mindmapLevels.length > 1 ? undefined : []
        });
      }
    });
    const newTree = Array.from(uniqueMap.values());
    const newRootIds = newTree.map(n => n.id).join(',');
    
    setRelationalTree(prevTree => {
      if (prevTree.length > 0 && prevTree.map(n => n.id).join(',') === newRootIds) {
        const updateNames = (nodes: any[]): any[] => {
          return nodes.map(n => {
            const modelId = mindmapLevels[n.level]?.model_id;
            const titleField = mindmapLevels[n.level]?.title_field;
            const descField = mindmapLevels[n.level]?.desc_field;
            const rawName = titleField ? n.rawData[titleField] : (n.rawData.name || n.rawData.nome || n.rawData.title || n.rawData.titulo || n.rawData.id);
            const name = formatValue(rawName, titleField || '', modelId);
            const rawDesc = descField ? n.rawData[descField] : undefined;
            const desc = rawDesc ? formatValue(rawDesc, descField || '', modelId) : undefined;
            return {
              ...n,
              name: String(name || 'Sem Título'),
              desc: desc ? String(desc) : undefined,
              children: n.children ? updateNames(n.children) : undefined
            };
          });
        };
        return updateNames(prevTree);
      }
      return newTree;
    });
    
    if (prevRootIdsRef.current !== newRootIds) {
      if (newTree.length === 1) {
        setCurrentPath([0]);
        if (newTree[0].children === undefined) {
          setTimeout(() => fetchChildren([0], newTree[0]), 50);
        }
      } else {
        setCurrentPath([]);
      }
      prevRootIdsRef.current = newRootIds;
    }
  }, [data, isRelational, mindmapLevels, isTunnelReady, localeStr])

  const treeData = isRelational ? relationalTree : pivotTreeData;

  const currentNode = useMemo(() => {
    let current = { children: treeData, id: 'virtual-root', name: 'Virtual Root', count: 0, level: -1 } as MindMapNode
    for (const index of currentPath) {
      if (current.children && current.children[index]) current = current.children[index]
    }
    return current
  }, [treeData, currentPath])

  const prevRefreshTriggerRef = useRef(refreshTrigger || 0);
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger !== prevRefreshTriggerRef.current) {
      prevRefreshTriggerRef.current = refreshTrigger;
      if (currentPath.length > 0 && currentNode && currentNode.id !== 'virtual-root') {
        // Se estamos visualizando um nó filho, disparamos o recarregamento dos dados dele
        fetchChildren(currentPath, currentNode);
      }
    }
  }, [refreshTrigger, currentPath, currentNode]);

  // Função Async para Carregar Filhos do Nível Inferior
  const fetchChildren = async (path: number[], node: MindMapNode) => {
    if (!isRelational || !mindmapLevels) return;
    const nextLevelIndex = node.level + 1;
    if (nextLevelIndex >= mindmapLevels.length) return; 
    
    const nextLevelConfig = mindmapLevels[nextLevelIndex];
    if (!nextLevelConfig.model_id) return;
    if (nextLevelConfig.relation_type === 'indirect') {
      if (!nextLevelConfig.through_table || !nextLevelConfig.through_local_fk || !nextLevelConfig.through_target_fk) return;
    } else if (nextLevelConfig.relation_type === 'multilevel') {
      if (!nextLevelConfig.relation_path || nextLevelConfig.relation_path.length === 0) return;
    } else {
      if (!nextLevelConfig.foreign_key) return;
    }

    const pathStr = path.join('-');
    setLoadingPath(pathStr);

    try {
      const modelData = models.find(m => m.id === nextLevelConfig.model_id);
      if (!modelData?.db_table_name) throw new Error('Model not found in project.models');

      const tableName = String(modelData.db_table_name);
      const schemaName = modelData.db_schema_name || project?.slug || 'public';
      
      const pk = primaryKeyName || 'id';
      const rawDataId = node.rawData ? (node.rawData[pk] !== undefined ? node.rawData[pk] : (node.rawData[pk.toUpperCase()] !== undefined ? node.rawData[pk.toUpperCase()] : (node.rawData.id !== undefined ? node.rawData.id : node.rawData.ID))) : undefined;
      const parentId = String(rawDataId !== undefined ? rawDataId : node.id).replace(/'/g, "''");
      
      let rawQuery = '';
      if (nextLevelConfig.relation_type === 'multilevel' && nextLevelConfig.relation_path) {
        const pathArray = nextLevelConfig.relation_path;
        let joins = '';
        for (let i = pathArray.length - 1; i >= 0; i--) {
          const hop = pathArray[i];
          const hopAlias = `th${i}`;
          if (i === pathArray.length - 1) {
            joins += ` INNER JOIN "${hop.table}" ${hopAlias} ON t."${hop.target_to_field}" = ${hopAlias}."${hop.target_from_field}"`;
          }
          if (i > 0) {
            const prevHopAlias = `th${i - 1}`;
            joins += ` INNER JOIN "${pathArray[i-1].table}" ${prevHopAlias} ON ${prevHopAlias}."${hop.from_field}" = ${hopAlias}."${hop.to_field}"`;
          }
        }
        const firstHop = pathArray[0];
        rawQuery = `SELECT DISTINCT t.* FROM "${tableName}" t ${joins} WHERE th0."${firstHop.to_field}" = '${parentId}'`;
      } else if (nextLevelConfig.relation_type === 'indirect' && nextLevelConfig.through_table) {
        rawQuery = `SELECT t.* FROM "${tableName}" t INNER JOIN "${nextLevelConfig.through_table}" th ON t.id = th."${nextLevelConfig.through_target_fk}" WHERE th."${nextLevelConfig.through_local_fk}" = '${parentId}'`;
      } else {
        rawQuery = `SELECT * FROM "${tableName}" WHERE "${nextLevelConfig.foreign_key}" = '${parentId}'`;
      }
      
      const queryId = crypto.randomUUID();
      const payload: any = {
        queryId,
        table: tableName,
        tableName: tableName,
        schemaName: schemaName,
        slug: project?.slug,
        action: 'select',
        query: rawQuery,
        sql: rawQuery,
        token: project?.secret_token || 'test-token'
      };

      const handleResult = (res: any) => {
        if (res.payload?.queryId === queryId) {
          console.log("[MetaBuilder:MindMap] 📡 fetchChildren response:", res.payload);
          if (!res.payload?.success) {
            console.error("[MetaBuilder:MindMap] ❌ fetchChildren Query Failed:", res.payload?.error);
          }
          const childrenData = res.payload.data;
          const uniqueChildren = new Map();
          (childrenData || []).forEach((item: any, idx: number) => {
            const rawName = nextLevelConfig.title_field ? item[nextLevelConfig.title_field] : (item.name || item.nome || item.title || item.titulo || item.id);
            const name = formatValue(rawName, nextLevelConfig.title_field || '', nextLevelConfig.model_id);
            const rawDesc = nextLevelConfig.desc_field ? item[nextLevelConfig.desc_field] : undefined;
            const desc = rawDesc ? formatValue(rawDesc, nextLevelConfig.desc_field || '', nextLevelConfig.model_id) : undefined;
            
            const pk = primaryKeyName || 'id';
            const rowId = item[pk] !== undefined ? item[pk] : (item[pk.toUpperCase()] !== undefined ? item[pk.toUpperCase()] : (item.id !== undefined ? item.id : item.ID));
            const key = rowId !== undefined ? rowId : `${node.id}-child-${idx}`;
            
            if (!uniqueChildren.has(key)) {
              uniqueChildren.set(key, {
                id: key,
                name: String(name || 'Sem Título'),
                desc: desc ? String(desc) : undefined,
                count: 0,
                level: nextLevelIndex,
                rawData: item,
                children: nextLevelIndex + 1 < mindmapLevels.length ? undefined : []
              });
            }
          });
          const newChildren = Array.from(uniqueChildren.values());
          newChildren.sort((a: any, b: any) => a.name.localeCompare(b.name, localeStr, { numeric: true }));

          setRelationalTree(prevTree => {
            const newTree = JSON.parse(JSON.stringify(prevTree)); 
            let curr: any = { children: newTree };
            for (const p of path) {
              curr = curr.children[p];
            }
            curr.children = newChildren;
            curr.count = newChildren.length;
            return newTree;
          });
          setLoadingPath(null);
        }
      };

      if (tunnelChannel && isTunnelReady) {
        tunnelChannel.on('broadcast', { event: `query_result_${queryId}` }, handleResult);
        tunnelChannel.on('broadcast', { event: 'sql_result' }, handleResult);
        tunnelChannel.send({
          type: 'broadcast',
          event: 'sql_query',
          payload
        });
        // Cleanup listener after 10s
        setTimeout(() => {
          try {
            const bindings = tunnelChannel.bindings?.broadcast;
            if (Array.isArray(bindings)) {
               tunnelChannel.bindings.broadcast = bindings.filter((b: any) => b.callback !== handleResult);
            }
          } catch (_) {}
          setLoadingPath(null);
        }, 10000);
      } else {
        const channelName = `tunnel:${project?.id}`;
        const channel = supabase.channel(channelName);
        channel.on('broadcast', { event: `query_result_${queryId}` }, handleResult);
        channel.on('broadcast', { event: 'sql_result' }, handleResult);
        channel.subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            channel.send({
              type: 'broadcast',
              event: 'sql_query',
              payload
            });
            setTimeout(() => {
              supabase.removeChannel(channel);
              setLoadingPath(null);
            }, 10000);
          }
        });
      }
    } catch (err) {
      console.error("Failed to fetch mindmap children:", err);
      setLoadingPath(null);
    }
  }

  const handleNodeClick = async (index: number) => {
    const nextPath = [...currentPath, index];
    const clickedNode = currentNode.children![index];

    if (isRelational) {
      if (clickedNode.children === undefined) {
        // Needs fetching
        await fetchChildren(nextPath, clickedNode);
        setCurrentPath(nextPath);
      } else if (clickedNode.children.length > 0) {
        setCurrentPath(nextPath);
      }
    } else {
      if (clickedNode.children && clickedNode.children.length > 0) {
        setCurrentPath(nextPath);
      }
    }
  }

  const handleGoBack = () => {
    if (currentPath.length > 0) setCurrentPath(currentPath.slice(0, -1))
  }

  const handleReset = () => {
    setZoom(1)
    setCurrentPath([])
    controls.start({ x: 0, y: 0, scale: 1, transition: { type: "spring", stiffness: 150, damping: 22 } })
  }

  const handleCenterView = () => {
    setZoom(1)
    controls.start({ x: 0, y: 0, scale: 1, transition: { type: "spring", stiffness: 150, damping: 22 } })
  }

  const renderValue = (field: any, val: any) => {
    if (!field) return String(val); // Relational mode fallback
    if (val === null || val === undefined) return '-'
    if (typeof val === 'boolean') return val ? 'Yes' : 'No'
    if (field?.data_type === 'uuid' && dictionary?.[val]) return dictionary[val]
    return String(val)
  }

  if (!treeData || treeData.length === 0) {
    return (
      <div className="py-20 text-center text-neutral-500 bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[2rem]">
        {t('runtime.no_results')}
      </div>
    )
  }

  return (
    <div className="relative w-full h-[750px] bg-slate-50 dark:bg-neutral-950 rounded-[3rem] overflow-hidden border border-neutral-200 dark:border-white/5 shadow-2xl group select-none transition-colors duration-500">
      {/* Background Decorativo Adaptativo */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.05),transparent_70%)] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.15),transparent_70%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] dark:opacity-10 mix-blend-soft-light pointer-events-none" />
      
      {/* Canvas Pannable */}
      <motion.div 
        className="relative w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
        drag
        dragConstraints={{ left: -1200, right: 1200, top: -1200, bottom: 1200 }}
        dragElastic={0.15}
        dragMomentum={true}
        animate={controls}
      >
        {/* Camada de Conexões */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible">
          <AnimatePresence>
            {currentNode.children?.map((child: MindMapNode, idx: number) => {
              const total = currentNode.children!.length
              const angle = (idx / total) * 360 - 90
              const radius = 260
              
              return (
                <motion.div
                  key={`conn-${child.id}`}
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: radius }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.8, delay: idx * 0.05 }}
                  style={{
                    position: 'absolute',
                    height: '2px',
                    transformOrigin: '0% 50%',
                    rotate: `${angle}deg`,
                    left: '50%',
                    top: '50%',
                    zIndex: 5
                  }}
                >
                  <svg width="100%" height="20" style={{ overflow: 'visible', position: 'absolute', top: -10 }}>
                    <path
                      d={`M 0 10 L ${radius} 10`}
                      className="stroke-indigo-500/30 dark:stroke-indigo-400/40"
                      strokeWidth="2"
                      strokeDasharray="4 6"
                    />
                  </svg>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        {/* Camada de Nós */}
        <div className="relative z-20 flex items-center justify-center w-full h-full">
          {/* Nó Central */}
          <motion.div
            key={`center-${currentNode.id}`}
            layoutId="centerNode"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="z-30 relative w-56 h-56 rounded-full bg-white/80 dark:bg-slate-900/60 border-2 border-indigo-500/20 dark:border-indigo-500/40 backdrop-blur-[40px] flex flex-col items-center justify-center p-8 text-center shadow-[0_0_80px_rgba(79,70,229,0.1)] dark:shadow-[0_0_80px_rgba(79,70,229,0.25)]"
          >
            <span className="text-[10px] uppercase font-black tracking-[0.4em] text-indigo-500 dark:text-indigo-400 mb-2 opacity-70">
              {isRelational ? (currentPath.length === 0 ? 'Workspace' : `${t('runtime.level', 'Nível')} ${currentNode.level + 1}`) : (currentNode.field?.display_name || 'Core')}
            </span>
            <h3 className="text-2xl font-black text-neutral-900 dark:text-white leading-tight break-words max-w-full">
              {renderValue(currentNode.field, currentNode.name)}
            </h3>
            {currentNode.desc && (
              <p className="text-[10px] text-neutral-500 mt-2">{currentNode.desc}</p>
            )}
            <div className="mt-4 px-4 py-1.5 bg-indigo-500/10 rounded-full border border-indigo-500/20">
              <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-200 uppercase tracking-widest">{currentNode.count || currentNode.children?.length || 0} records</span>
            </div>
          </motion.div>

          {/* Orbitais */}
          <AnimatePresence>
            {currentNode.children?.map((child: MindMapNode, idx: number) => {
              const total = currentNode.children!.length
              const angleRad = ((idx / total) * Math.PI * 2) - (Math.PI / 2)
              const radius = 260
              const x = Math.cos(angleRad) * radius
              const y = Math.sin(angleRad) * radius
              const hasChildren = child.children === undefined || child.children.length > 0;
              const isLoading = loadingPath === [...currentPath, idx].join('-');

              return (
                <motion.div
                  key={`child-${child.id}`}
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                  animate={{ x, y, opacity: 1, scale: 1 }}
                  exit={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                  whileHover={{ scale: 1.05, zIndex: 40 }}
                  transition={{ type: "spring", stiffness: 100, damping: 20, delay: idx * 0.05 }}
                  className={cn(
                    "absolute z-20 w-48 p-5 rounded-[2rem] border transition-all cursor-pointer overflow-hidden backdrop-blur-xl shadow-xl group/node",
                    hasChildren 
                      ? "bg-white/90 dark:bg-slate-900/80 border-neutral-200 dark:border-white/10 hover:border-indigo-500/60" 
                      : "bg-white/40 dark:bg-slate-900/40 border-neutral-200 dark:border-white/5 opacity-90 hover:opacity-100"
                  )}
                  onClick={() => handleNodeClick(idx)}
                >
                  <div className="flex flex-col gap-2 relative">
                    <span 
                      style={!isRelational ? {
                        fontFamily: (child.field?.config?.grid_config || child.field?.config)?.label?.font,
                        fontSize: (child.field?.config?.grid_config || child.field?.config)?.label?.size || '8px',
                        color: (child.field?.config?.grid_config || child.field?.config)?.label?.color,
                      } : {}}
                      className={cn(
                        "text-[8px] uppercase font-black tracking-[0.2em]",
                        (!isRelational && !(child.field?.config?.grid_config || child.field?.config)?.label?.color) && "text-neutral-400 dark:text-neutral-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400",
                        isRelational && "text-indigo-500 dark:text-indigo-400"
                      )}
                    >
                      {isRelational ? `${t('runtime.level', 'Nível')} ${child.level + 1}` : ((child.field?.config?.grid_config || child.field?.config)?.label?.text || child.field?.display_name || 'Level')}
                    </span>
                    <h4 
                      style={!isRelational ? {
                        fontFamily: (child.field?.config?.grid_config || child.field?.config)?.content?.font,
                        fontSize: (child.field?.config?.grid_config || child.field?.config)?.content?.size || '12px',
                        color: (child.field?.config?.grid_config || child.field?.config)?.content?.color,
                      } : {}}
                      className={cn(
                        "text-xs font-bold leading-tight",
                        (!isRelational && !(child.field?.config?.grid_config || child.field?.config)?.content?.color) && "text-neutral-800 dark:text-neutral-100",
                        isRelational && "text-neutral-800 dark:text-neutral-100"
                      )}
                    >
                      {renderValue(child.field, child.name)}
                    </h4>
                    {child.desc && (
                      <p className="text-[10px] text-neutral-500 truncate leading-tight">{child.desc}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-[1.5px] bg-neutral-200 dark:bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500/40 w-2/3" />
                      </div>
                      <span className="text-[9px] font-black text-neutral-400 dark:text-neutral-500">{child.children === undefined ? '?' : child.count || child.children.length}</span>
                    </div>
                  </div>
                  
                  {/* Hover Actions */}
                  {child.rawData && (
                    <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover/node:opacity-100 transition-opacity bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-1 rounded-lg border border-neutral-200 dark:border-white/10 shadow-sm z-50">
                      {onView && (
                        <Tooltip text={t('actions.view', 'Visualizar')}>
                          <button onClick={(e) => { e.stopPropagation(); onView({ ...child.rawData, __model_name: child.field?.model_name || child.rawData?.__model_name }) }} className="p-1 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-md transition-colors"><Eye className="w-3 h-3 text-neutral-500 hover:text-indigo-500" /></button>
                        </Tooltip>
                      )}
                      {(onEditLevel && mindmapLevels && mindmapLevels[child.level]?.edit_usecase_slug) ? (
                        <Tooltip text={t('actions.edit', 'Editar')}>
                          <button onClick={(e) => { e.stopPropagation(); onEditLevel(child.level, { ...child.rawData, __model_name: child.field?.model_name || child.rawData?.__model_name }) }} className="p-1 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-md transition-colors"><Edit className="w-3 h-3 text-neutral-500 hover:text-indigo-500" /></button>
                        </Tooltip>
                      ) : onEdit ? (
                        <Tooltip text={t('actions.edit', 'Editar')}>
                          <button onClick={(e) => { e.stopPropagation(); onEdit({ ...child.rawData, __model_name: child.field?.model_name || child.rawData?.__model_name }) }} className="p-1 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-md transition-colors"><Edit className="w-3 h-3 text-neutral-500 hover:text-indigo-500" /></button>
                        </Tooltip>
                      ) : null}
                      {onDelete && (
                        <Tooltip text={t('actions.delete', 'Excluir')}>
                          <button onClick={(e) => { e.stopPropagation(); onDelete({ ...child.rawData, __model_name: child.field?.model_name || child.rawData?.__model_name }) }} className="p-1 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-md transition-colors"><Trash2 className="w-3 h-3 text-neutral-500 hover:text-red-500" /></button>
                        </Tooltip>
                      )}
                      {customActions?.filter((action: any) => {
                        if (!isRelational) return true;
                        const levelStr = String(child.level + 1);
                        return action.placements?.some((p: any) => p.location === `mindmap:level:${levelStr}`);
                      }).map((action: any, i: number) => {
                        const handleClick = (e: React.MouseEvent) => {
                          e.stopPropagation();
                          // Constrói a lista de nós ancestrais a partir do currentPath + relationalTree
                          const ancestors: { level: number; rawData: any }[] = [];
                          if (isRelational && currentPath.length > 0) {
                            let cursor: any = { children: relationalTree };
                            for (let pi = 0; pi < currentPath.length; pi++) {
                              cursor = cursor.children?.[currentPath[pi]];
                              if (cursor && cursor.rawData) {
                                ancestors.push({ level: cursor.level + 1, rawData: cursor.rawData });
                              }
                            }
                          }
                          onCustomAction?.(action, {
                            ...child.rawData,
                            __mindmap_level__: child.level + 1,
                            __mindmap_ancestors__: ancestors
                          });
                        };
                        return (
                          <Tooltip key={i} text={action.label || 'Ação Customizada'}>
                             <button onClick={handleClick} className="p-1 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-md transition-colors">
                               <DynamicIcon icon={action.icon || 'Zap'} className="w-3 h-3 text-neutral-500 hover:text-amber-500" />
                             </button>
                          </Tooltip>
                        );
                      })}
                    </div>
                  )}
                  {hasChildren && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isLoading ? (
                        <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-indigo-500/60" />
                      )}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Toolbar Superior */}
      <div className="absolute top-8 left-8 z-50 flex items-center gap-4">
        {currentPath.length > 0 && (
          <Tooltip text={t('runtime.back_level', 'Voltar Nível')}>
            <button onClick={handleGoBack} className="p-4 bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-neutral-200 dark:border-white/10 rounded-2xl backdrop-blur-3xl transition-all active:scale-95 shadow-xl pointer-events-auto group">
              <ArrowLeft className="w-5 h-5 text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white" />
            </button>
          </Tooltip>
        )}
        <div className="px-6 py-4 bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl backdrop-blur-3xl shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[10px] font-black text-neutral-700 dark:text-white uppercase tracking-[0.3em] opacity-80">
              {currentPath.length === 0 ? 'Workspace' : (isRelational ? `${t('runtime.level', 'Nível')} ${currentNode.level + 1}` : (currentNode.field?.display_name || 'Level'))}
            </span>
          </div>
        </div>
      </div>

      {/* Controles Laterais */}
      <div className="absolute top-8 right-8 z-50 flex flex-col gap-2">
        <Tooltip text="Aumentar Zoom">
          <button onClick={() => setZoom(z => Math.min(z + 0.2, 2))} className="p-3 bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-neutral-200 dark:border-white/10 rounded-2xl backdrop-blur-3xl text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all pointer-events-auto shadow-xl"><ZoomIn className="w-5 h-5" /></button>
        </Tooltip>
        <Tooltip text="Diminuir Zoom">
          <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))} className="p-3 bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-neutral-200 dark:border-white/10 rounded-2xl backdrop-blur-3xl text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all pointer-events-auto shadow-xl"><ZoomOut className="w-5 h-5" /></button>
        </Tooltip>
        <div className="w-full h-px bg-neutral-200 dark:bg-white/5 my-1" />
        <Tooltip text="Resetar Tudo">
          <button onClick={handleReset} className="p-3 bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-neutral-200 dark:border-white/10 rounded-2xl backdrop-blur-3xl text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all pointer-events-auto shadow-xl"><RotateCcw className="w-5 h-5" /></button>
        </Tooltip>
        <Tooltip text="Centralizar Vista">
          <button onClick={handleCenterView} className="p-3 bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-neutral-200 dark:border-white/10 rounded-2xl backdrop-blur-3xl text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all pointer-events-auto shadow-xl"><Maximize2 className="w-5 h-5" /></button>
        </Tooltip>
      </div>

      {/* Barra de Status Inferior */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 px-8 py-3 bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-full backdrop-blur-3xl flex items-center gap-6 shadow-2xl z-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[9px] font-black text-neutral-600 dark:text-white uppercase tracking-[0.3em] opacity-60">Nexo Engine Active</span>
        </div>
        <div className="w-px h-3 bg-neutral-200 dark:bg-white/10" />
        <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{currentNode.children?.length || 0} Orbitals</span>
      </div>
    </div>
  )
}
