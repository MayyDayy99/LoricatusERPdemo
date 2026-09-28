'use client';

import React from 'react';
import { Handle, Position } from 'reactflow';
import { clsx } from 'clsx';

interface TaskNodeProps {
  data: { label: string; description?: string };
  selected?: boolean;
}

export default function TaskNode({ data, selected }: TaskNodeProps) {
  return (
    <div
      className={clsx(
        'px-4 py-3 rounded-lg shadow-md transition-all',
        'bg-white border-2',
        selected ? 'border-blue-500 shadow-lg' : 'border-gray-300',
      )}
    >
      <Handle type="target" position={Position.Top} />
      <div className="text-sm font-semibold text-gray-900">{data.label}</div>
      {data.description && (
        <div className="text-xs text-gray-500 mt-1 max-w-xs whitespace-normal">{data.description}</div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
