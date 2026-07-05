'use client';

import Link from 'next/link';
import { clsx } from 'clsx';
import { MapPin, Calendar, ChevronRight } from 'lucide-react';
import type { Project, ProjectStatus } from '@/lib/hooks/use-projects';
import { ProjectStatusSelect } from './project-status-select';

const STATE_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  archived: 'bg-orange-100 text-orange-700',
};

export function ProjectCard({
  project, statuses, onStatusChanged,
}: {
  project: Project;
  statuses?: ProjectStatus[];
  onStatusChanged?: () => void;
}) {
  return (
    <Link href={`/projects/${project.id}`}>
      <div className="bg-white border border-gray-100 rounded-xl p-5 hover:shadow-md hover:border-brand-200 transition group cursor-pointer">
        <div className="flex items-start justify-between mb-3 gap-2">
          <h3 className="font-semibold text-gray-900 group-hover:text-brand-600 transition line-clamp-1">
            {project.name}
          </h3>
          <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium capitalize shrink-0', STATE_COLORS[project.state] ?? 'bg-gray-100 text-gray-600')}>
            {project.state}
          </span>
        </div>

        {project.description && (
          <p className="text-sm text-gray-500 line-clamp-2 mb-3">{project.description}</p>
        )}

        {statuses && statuses.length > 0 && (
          <div className="mb-3">
            <ProjectStatusSelect project={project} statuses={statuses} onChanged={onStatusChanged} />
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-gray-400 mt-auto">
          {project.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {project.location.city}
            </span>
          )}
          {project.startDate && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(project.startDate).toLocaleDateString()}
            </span>
          )}
          <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition" />
        </div>
      </div>
    </Link>
  );
}
