import React from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath, useReactFlow } from '@xyflow/react';
import { Trash2 } from 'lucide-react';

export default function ButtonEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onEdgeClick = (evt: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    evt.stopPropagation();
    setEdges((edges) => edges.filter((e) => e.id !== id));
  };

  // Highlights when selected
  const edgeStyle = {
    ...style,
    strokeWidth: selected ? 3 : (style.strokeWidth || 2),
    filter: selected ? 'drop-shadow(0px 0px 4px rgba(99, 102, 241, 0.8))' : 'none',
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 12,
            pointerEvents: 'all',
            opacity: selected ? 1 : 0, // Only show trash when edge is selected
            transition: 'opacity 0.2s',
            zIndex: 1000,
          }}
          className="nodrag nopan"
        >
          {selected && (
            <button
              onClick={onEdgeClick}
              className="w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-110 cursor-pointer"
              title="Excluir Linha"
            >
              <Trash2 className="w-[10px] h-[10px]" />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
