import React from 'react';
import { SqlStudioClient } from './SqlStudioClient';
import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';

export default async function SqlStudioPage({
  params
}: {
  params: Promise<{ workspace_slug: string, project_slug: string }>
}) {
  const resolvedParams = await params;
  const supabase = await createClient();
  
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('slug', resolvedParams.workspace_slug)
    .single();

  if (!workspace) return notFound();

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', resolvedParams.project_slug)
    .eq('workspace_id', workspace.id)
    .single();

  if (!project) return notFound();

  return (
    <div className="w-full h-full flex flex-col">
      <Breadcrumbs
        workspaceName={workspace.name}
        workspaceSlug={resolvedParams.workspace_slug}
        projectName={project.name}
        projectSlug={resolvedParams.project_slug}
      />
      <SqlStudioClient 
        workspaceSlug={resolvedParams.workspace_slug} 
        projectSlug={resolvedParams.project_slug} 
        project={project} 
      />
    </div>
  );
}
