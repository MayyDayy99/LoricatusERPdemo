'use client';

import React from 'react';
import { Handle, Position } from 'reactflow';
import { clsx } from 'clsx';
import { Play } from 'lucide-react';

interface StartNodeProps {
  data: { label: string };
  selected?: boolean;
}

export default function StartNode({ data, selected }: StartNodeProps) {
  return (
    <div
      className={clsx(
        'px-4 py-3 rounded-full shadow-md transition-all',
        'bg-green-100 border-2',
        selected ? 'border-green-600 shadow-lg' : 'border-green-400',
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-green-900">
        <Play className="w-4 h-4" />
        {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
