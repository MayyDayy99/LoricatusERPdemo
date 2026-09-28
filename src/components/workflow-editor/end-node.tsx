'use client';

import React from 'react';
import { Handle, Position } from 'reactflow';
import { clsx } from 'clsx';
import { Square } from 'lucide-react';

interface EndNodeProps {
  data: { label: string };
  selected?: boolean;
}

export default function EndNode({ data, selected }: EndNodeProps) {
  return (
    <div
      className={clsx(
        'px-4 py-3 rounded-full shadow-md transition-all',
        'bg-red-100 border-2',
        selected ? 'border-red-600 shadow-lg' : 'border-red-400',
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-red-900">
        <Square className="w-4 h-4" />
        {data.label}
      </div>
      <Handle type="target" position={Position.Top} />
    </div>
  );
}
