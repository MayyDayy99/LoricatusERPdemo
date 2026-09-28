'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useProjectTemplate, updateProjectTemplate, type ProjectTemplateStep } from '@/lib/hooks/use-project-templates';
import { WorkflowEditor } from '@/components/workflow-editor';
import type { Node, Edge } from 'reactflow';

/**
 * Workflow vizuális szerkesztő oldal — projekt sablonok munkafolyamatának
 * vizuális szerkesztésé ReactFlow alapú szerkesztővel.
 */
export default function WorkflowEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { template, isLoading, error, mutate } = useProjectTemplate(id ?? null);
  const [isSaving, setIsSaving] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="space-y-4 text-center py-20">
        <p className="text-gray-500">Template not found.</p>
        <Link href="/settings/project-templates" className="text-brand-600 hover:underline text-sm">
          Back to Templates
        </Link>
      </div>
    );
  }

  // Convert template steps to workflow nodes
  const initialNodes: Node[] = template.steps.map((step, idx) => ({
    id: `step-${step.sortIndex}`,
    data: {
      label: step.name,
      description: step.stepType,
    },
    position: {
      x: idx % 3 * 200,
      y: Math.floor(idx / 3) * 150,
    },
    type: step.stepType === 'task' ? 'task' : 'task',
  }));

  // Placeholder edges based on step dependencies
  const initialEdges: Edge[] = template.steps
    .filter((step) => step.dependsOnStepSortIndex !== undefined && step.dependsOnStepSortIndex !== null)
    .map((step, idx) => ({
      id: `edge-${idx}`,
      source: `step-${step.dependsOnStepSortIndex}`,
      target: `step-${step.sortIndex}`,
    }));

  const handleSave = async (nodes: Node[], edges: Edge[]) => {
    setIsSaving(true);
    try {
      // Update template with new workflow structure
      const updatedSteps: ProjectTemplateStep[] = nodes.map((node) => {
        const originalStep = template.steps.find((s) => s.sortIndex === Number(node.id.split('-')[1]));
        const edge = edges.find((e) => e.target === node.id);

        if (!originalStep) {
          throw new Error(`Step not found for node ${node.id}`);
        }

        return {
          ...originalStep,
          name: node.data.label,
          dependsOnStepSortIndex: edge ? Number(edge.source.split('-')[1]) : undefined,
        };
      });

      await updateProjectTemplate(id, {
        ...template,
        steps: updatedSteps,
      });

      await mutate();
      toast.success('Workflow saved successfully!');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save workflow');
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200">
        <Link href={`/settings/project-templates/${id}/edit`} className="p-1.5 text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">Workflow Editor — {template.name}</h1>
          <p className="text-xs text-gray-500 mt-0.5">Vizuális szerkesztés ReactFlow-val</p>
        </div>
      </div>

      {/* Workflow Canvas */}
      <div className="flex-1 overflow-hidden">
        <WorkflowEditor
          initialNodes={initialNodes}
          initialEdges={initialEdges}
          onSave={handleSave}
          workflowId={id}
        />
      </div>
    </div>
  );
}
