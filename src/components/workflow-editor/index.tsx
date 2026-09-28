'use client';

import React, { useCallback, useState } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  MiniMap,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Plus, Trash2, Save, Copy } from 'lucide-react';
import { toast } from 'sonner';
import TaskNode from './task-node';
import StartNode from './start-node';
import EndNode from './end-node';
import { clsx } from 'clsx';

const nodeTypes = {
  task: TaskNode,
  start: StartNode,
  end: EndNode,
};

interface WorkflowEditorProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onSave?: (nodes: Node[], edges: Edge[]) => Promise<void>;
  readOnly?: boolean;
  workflowId?: string;
}

export function WorkflowEditor({
  initialNodes = [],
  initialEdges = [],
  onSave,
  readOnly = false,
  workflowId,
}: WorkflowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [saving, setSaving] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges],
  );

  const addNode = useCallback(
    (type: 'start' | 'task' | 'end') => {
      if (readOnly) return;
      
      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        data: { label: type === 'start' ? 'Start' : type === 'end' ? 'End' : `Task ${nodes.filter(n => n.type === 'task').length + 1}` },
        position: {
          x: Math.random() * 400,
          y: Math.random() * 400,
        },
        type,
      };
      setNodes((nds) => [...nds, newNode]);
      toast.success(`${type} node added`);
    },
    [nodes, setNodes, readOnly],
  );

  const deleteNode = useCallback(() => {
    if (!selectedNodeId || readOnly) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
    toast.success('Node deleted');
  }, [selectedNodeId, setNodes, setEdges, readOnly]);

  const duplicateNode = useCallback(() => {
    if (!selectedNodeId || readOnly) return;
    const nodeToClone = nodes.find((n) => n.id === selectedNodeId);
    if (!nodeToClone) return;

    const newNode: Node = {
      ...nodeToClone,
      id: `${nodeToClone.id}-clone-${Date.now()}`,
      position: {
        x: nodeToClone.position.x + 50,
        y: nodeToClone.position.y + 50,
      },
    };
    setNodes((nds) => [...nds, newNode]);
    toast.success('Node duplicated');
  }, [selectedNodeId, nodes, setNodes, readOnly]);

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(nodes, edges);
      toast.success('Workflow saved');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full gap-4 bg-gray-50">
      {/* Left Sidebar - Node Palette */}
      {!readOnly && (
        <div className="w-48 bg-white border-r border-gray-200 p-4 overflow-y-auto">
          <h3 className="font-semibold text-gray-900 text-sm mb-4">Node Palette</h3>
          <div className="space-y-2">
            <button
              data-testid="node-type-start"
              onClick={() => addNode('start')}
              className={clsx(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition',
                'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100',
              )}
            >
              <Plus className="w-4 h-4" />
              Start
            </button>
            <button
              data-testid="node-type-task"
              onClick={() => addNode('task')}
              className={clsx(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition',
                'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100',
              )}
            >
              <Plus className="w-4 h-4" />
              Task
            </button>
            <button
              data-testid="node-type-end"
              onClick={() => addNode('end')}
              className={clsx(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition',
                'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100',
              )}
            >
              <Plus className="w-4 h-4" />
              End
            </button>
          </div>

          {/* Node Actions */}
          {selectedNodeId && (
            <div className="mt-6 pt-4 border-t border-gray-200 space-y-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase">Node Actions</h4>
              <button
                onClick={duplicateNode}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 transition"
              >
                <Copy className="w-4 h-4" />
                Duplicate
              </button>
              <button
                onClick={deleteNode}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-700 bg-red-50 hover:bg-red-100 transition"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          )}

          {/* Save Button */}
          {onSave && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={handleSave}
                disabled={saving}
                className={clsx(
                  'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition',
                  saving || readOnly
                    ? 'opacity-50 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700',
                )}
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Canvas */}
      <div
        data-testid="workflow-canvas"
        className="flex-1 border border-gray-200 rounded-lg overflow-hidden bg-white"
      >
        <ReactFlow
          nodes={nodes.map((n) => ({
            ...n,
            selected: n.id === selectedNodeId,
          }))}
          edges={edges}
          onNodesChange={readOnly ? undefined : onNodesChange}
          onEdgesChange={readOnly ? undefined : onEdgesChange}
          onConnect={readOnly ? undefined : onConnect}
          onNodeClick={(_, node) => !readOnly && setSelectedNodeId(node.id)}
          onPaneClick={() => !readOnly && setSelectedNodeId(null)}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background color="#aaa" gap={16} />
          {!readOnly && <Controls />}
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}
